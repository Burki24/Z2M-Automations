import {createHash} from 'node:crypto';
import {isIP} from 'node:net';
import type {Project, ProjectSystem, Broker} from './project.js';
import type {MqttReader} from './mqtt-reader.js';

type LinkReader = Pick<MqttReader, 'current' | 'state'>;
type State = 'ok' | 'missing' | 'unknown';
interface Check {id: string; state: State; detail: string}
interface Suggestion {kind: 'peers' | 'acl' | 'bridge'; systemId: string; brokerId: string; text: string}
const meshTopic = 'z2ma/mesh/#';
// Matches the canonical schema's mesh-peer grammar, not general MQTT topic syntax.
const peerTopic = (topic: string) => topic.length <= 128 && (/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(topic) || /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(topic));
const hostname = (host: string) => isIP(host) === 6 ? new URL('mqtt://[' + host + ']').hostname : host.toLowerCase().replace(/\.$/, '');
const address = (broker: Broker) => isIP(broker.host) === 6 ? '[' + broker.host + ']:' + broker.port
  : /^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(broker.host) ? broker.host + ':' + broker.port : null;

function pair(project: Project, id: string, peerId: string): [ProjectSystem, ProjectSystem] {
  const first = project.systems.find(system => system.id === id);
  const second = project.systems.find(system => system.id === peerId);
  if (!first || !second || first.id === second.id) throw new Error('invalidRequest');
  return [first, second];
}

// Starts ordinary correlated reads only. Awaiting them inside the project queue would
// deadlock their observation callbacks, so completion is observed through linkPlan.
export function readSystemLink(project: Project, reader: Pick<MqttReader, 'refresh' | 'connected'>, id: string, peerId: string): void {
  for (const system of pair(project, id, peerId)) {
    if (reader.connected(system.brokerId)) void reader.refresh(system.id).catch(() => {});
  }
}

export function systemLinkPlan(project: Project, reader: LinkReader, id: string, peerId: string) {
  const selected = pair(project, id, peerId);
  const brokers = selected.map(system => project.brokers.find(broker => broker.id === system.brokerId)!);
  if (brokers.some(broker => !broker)) throw new Error('invalidRequest');
  const [local, remote] = brokers as [Broker, Broker];
  const topology = local.id === remote.id || hostname(local.host) === hostname(remote.host) && local.port === remote.port ? 'shared' : 'separate';
  const identities = selected.every(system => peerTopic(system.baseTopic)
    && project.systems.filter(other => other.baseTopic === system.baseTopic).length === 1);
  const state = reader.state();
  const checks: Check[] = [{id: 'topics', state: identities ? 'ok' : 'missing', detail: identities ? 'topicsUnique' : 'topicsInvalid'}];
  if (topology === 'separate') checks.push({id: 'address', state: address(remote) ? 'ok' : 'missing', detail: address(remote) ? 'addressKnown' : 'addressInvalid'});
  const systems = selected.map((system, index) => {
    const broker = brokers[index]!; const other = selected[1 - index]!;
    const observation = reader.current(system.id);
    const connection = state.brokers.find(item => item.id === broker.id);
    const current = state.systems.find(item => item.id === system.id);
    const connected = connection?.state === 'connected';
    const reading = current?.reading === true;
    const fresh = connected && !reading && !current?.error && observation?.fresh === true;
    const version = fresh ? observation.status.extensionVersion : '';
    const parsed = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
    const compatible = Boolean(parsed && (Number(parsed[1]) > 0 || Number(parsed[2]) > 2 || Number(parsed[2]) === 2 && Number(parsed[3]) >= 2));
    const localGrant = identities && system.configuration.mesh_peers.includes(other.baseTopic);
    const storedGrant = fresh && identities && observation.configuration.mesh_peers.includes(other.baseTopic);
    const activeGrant = storedGrant && observation.status.executing && observation.status.activeMatches;
    const checks: Check[] = [
      {id: 'connection', state: connected ? 'ok' : 'unknown', detail: connected ? 'connected' : 'disconnected'},
      {id: 'read', state: fresh ? 'ok' : 'unknown', detail: fresh ? 'readFresh' : reading ? 'reading' : 'readMissing'},
      {id: 'extension', state: !fresh ? 'unknown' : compatible ? 'ok' : 'missing', detail: !fresh ? 'readMissing' : compatible ? 'extensionReady' : 'extensionOld'},
      {id: 'local', state: localGrant ? 'ok' : 'missing', detail: localGrant ? 'localGranted' : system.configuration.mesh_peers.length >= 8 ? 'peerLimit' : 'localMissing'},
      {id: 'stored', state: !fresh ? 'unknown' : storedGrant ? 'ok' : 'missing', detail: !fresh ? 'readMissing' : storedGrant ? 'storedGranted' : 'storedMissing'},
      {id: 'runtime', state: !fresh || observation.status.executing && !observation.status.activeMatches ? 'unknown' : activeGrant ? 'ok' : 'missing',
        detail: !fresh ? 'readMissing' : activeGrant ? 'runtimeGranted' : !observation.status.executing ? 'runtimeStopped' : !storedGrant ? 'storedMissing' : 'runtimeDifferent'}
    ];
    const knownErrors = ['timeout', 'protocol', 'stale', 'disconnected', 'remoteError', 'readError', 'connectionError', 'tlsError', 'authentication', 'permission'];
    const error = current?.error || connection?.error || '';
    return {id: system.id, name: system.name, baseTopic: system.baseTopic, broker: {...broker}, partner: other.name,
      reading, extensionVersion: version, checks, error: knownErrors.includes(error) ? error : ''};
  });
  const suggestions: Suggestion[] = [];
  if (identities) {
    for (const [index, system] of selected.entries()) {
      // Add the peer to the existing list; never suggest replacing the full configuration.
      const peers = [...new Set([...system.configuration.mesh_peers, selected[1 - index]!.baseTopic])];
      if (peers.length <= 8 && peers.every(peerTopic)) suggestions.push({kind: 'peers', systemId: system.id, brokerId: system.brokerId,
        text: 'mesh_peers:\n' + peers.map(peer => '  - ' + JSON.stringify(peer)).join('\n') + '\n'});
      const acl = ['user REPLACE_Z2M_USER', 'topic readwrite ' + meshTopic];
      if (topology === 'separate') acl.push('', 'user REPLACE_BRIDGE_USER', 'topic readwrite ' + meshTopic);
      // Duplicate broker records with the same endpoint need only one ACL example.
      if (topology !== 'shared' || index === 0) suggestions.push({kind: 'acl', systemId: system.id, brokerId: system.brokerId, text: acl.join('\n') + '\n'});
    }
    if (topology === 'separate' && address(remote)) {
      const identity = createHash('sha256').update(JSON.stringify([project.id, [local.id, remote.id].sort()])).digest('hex').slice(0, 12);
      const bridge = ['connection z2ma-' + identity, 'address ' + address(remote),
        'local_clientid z2ma-' + identity + '-local', 'remote_clientid z2ma-' + identity,
        'local_username REPLACE_LOCAL_BRIDGE_USER', 'local_password REPLACE_LOCAL_BRIDGE_PASSWORD',
        'remote_username REPLACE_REMOTE_BRIDGE_USER', 'remote_password REPLACE_REMOTE_BRIDGE_PASSWORD',
        '', 'topic ' + meshTopic + ' both 0', 'try_private true', 'cleansession true', 'local_cleansession true',
        'notifications false', 'start_type automatic'];
      if (remote.tls) bridge.push('', 'bridge_cafile REPLACE_REMOTE_CA_FILE', 'bridge_insecure false',
        '# If the remote broker requires a client certificate, also configure:',
        '# bridge_certfile REPLACE_REMOTE_CLIENT_CERT_FILE', '# bridge_keyfile REPLACE_REMOTE_CLIENT_KEY_FILE');
      suggestions.push({kind: 'bridge', systemId: selected[0].id, brokerId: local.id, text: bridge.join('\n') + '\n'});
    }
  }
  return {projectId: project.id, systems, topology, checks, suggestions,
    reading: systems.some(system => system.reading),
    missing: [...checks, ...systems.flatMap(system => system.checks)].filter(check => check.state === 'missing').length,
    external: {accounts: 'unknown', rights: 'unknown', bridge: topology === 'shared' ? 'unneeded' : 'unknown', roundTrip: 'unknown'}};
}
