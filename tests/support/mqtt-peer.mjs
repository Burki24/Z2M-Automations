import net from 'node:net';
import tls from 'node:tls';
import packet from 'mqtt-packet';
import {randomUUID, createHash} from 'node:crypto';

export function remoteFixture(name = 'Synthetic remote rule') {
  const configuration = {schema_version: 1, revision: 3, automations: [{id: 'remote-rule', name, enabled: true,
    triggers: [{type: 'device', device: '0x0000000000000001', property: 'occupancy', operator: 'eq', value: true}],
    conditions: [], actions: [{type: 'set', target: {type: 'device', id: '0x0000000000000002'}, values: {state: 'ON'}}]}], sequences: [], mesh_peers: []};
  const yaml = '# Synthetic source retained byte-for-byte\r\n' + JSON.stringify(configuration) + '\r\n';
  const status = {protocol_version: 1, schema_version: 1, session: randomUUID(), state: 'ready', storage: 'ok', stored_revision: 3,
    checksum: createHash('sha256').update(yaml).digest('hex'), executing: true, extension_version: '0.1.0', catalog_version: 1};
  return {status, editor: {...status, editor_version: 1, configuration, yaml,
    devices: [{id: '0x0000000000000001', name: 'Synthetic sensor', properties: [{property: 'occupancy', label: 'Occupancy', type: 'binary', access: 1, values: [true, false]}]},
      {id: '0x0000000000000002', name: 'Synthetic light', properties: [{property: 'state', label: 'State', type: 'binary', access: 3, values: ['ON', 'OFF']},
        {property: 'brightness', label: 'Brightness', type: 'numeric', access: 3, minimum: 0, maximum: 254, step: 1, values: []}]}],
    groups: [{id: 1, name: 'Synthetic group'}], scenes: [{target: {type: 'device', id: '0x0000000000000002'}, id: 1, name: 'Synthetic scene', endpoint: 1, control_property: 'state'}]}};
}
/** Minimal independent MQTT 3.1.1 test peer. It implements no device or runtime actions. */
export async function startPeer({systems = new Map([['synthetic', remoteFixture()]]), secure, deny = false, auth = false, acknowledge = true, reply, bridge} = {}) {
  const sockets = new Set(); const clients = []; const publications = []; const subscriptions = [];
  const server = secure ? tls.createServer(secure) : net.createServer();
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); socket.on('error', () => {}); });
  server.on('tlsClientError', () => {});
  const send = (socket, value) => { if (!socket.destroyed) socket.write(packet.generate(value)); };
  server.on(secure ? 'secureConnection' : 'connection', socket => {
    const parser = packet.parser(); const topics = new Set();
    socket.on('data', bytes => parser.parse(bytes)); parser.on('error', () => socket.destroy());
    parser.on('packet', value => {
      if (value.cmd === 'connect') { clients.push(value); send(socket, {cmd: 'connack', sessionPresent: false, returnCode: auth ? 5 : 0}); }
      if (value.cmd === 'subscribe') {
        subscriptions.push(...value.subscriptions.map(subscription => subscription.topic));
        for (const subscription of value.subscriptions) topics.add(subscription.topic);
        if (acknowledge) send(socket, {cmd: 'suback', messageId: value.messageId, granted: value.subscriptions.map(() => deny ? 128 : 0)});
        for (const base of systems.keys()) for (const [suffix, data] of Object.entries(bridge ?? {})) {
          const topic = base + '/bridge/' + suffix;
          if (topics.has(topic)) send(socket, {cmd: 'publish', topic, payload: Buffer.from(JSON.stringify(data)), qos: 0, retain: true, dup: false});
        }
      }
      if (value.cmd === 'publish') {
        publications.push(value);
        const match = /^(.*)\/symcon\/automations\/request\/(status|editor|validate|store)$/.exec(value.topic)
          ?? /^(.*)\/bridge\/request\/extension\/save$/.exec(value.topic);
        if (!match || !systems.has(match[1])) return;
        let request; try { request = JSON.parse(value.payload.toString()); } catch { return; }
        const operation = match[2] ?? 'install'; const fixture = systems.get(match[1]);
        const responseTopic = match[1] + (operation === 'install' ? '/bridge/response/extension/save' : '/symcon/automations/response/' + operation);
        const response = {...(operation === 'install' ? {} : {protocol_version: 1}), transaction: request.transaction, status: 'ok', data: structuredClone(fixture[operation] ?? {})};
        const publish = (body = response, topic = responseTopic, retain = false) => {
          if (topics.has(topic)) send(socket, {cmd: 'publish', topic, payload: Buffer.from(JSON.stringify(body)), qos: 0, retain, dup: false});
        };
        if (reply) reply({operation, base: match[1], request, response, publish, socket}); else publish();
      }
      if (value.cmd === 'pingreq') send(socket, {cmd: 'pingresp'});
      if (value.cmd === 'disconnect') socket.end();
    });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return {port: server.address().port, clients, publications, subscriptions, systems,
    drop() { for (const socket of sockets) socket.destroy(); },
    async close() { for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)); }};
}
