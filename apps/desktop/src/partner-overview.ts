import type {Project} from './project.js';
import type {MqttReader} from './mqtt-reader.js';

// This projection uses existing observations only; viewing permissions never starts MQTT.
export function partnerOverview(project: Project, reader: Pick<MqttReader, 'current'>) {
  return project.systems.flatMap(receiver => {
    const remote = reader.current(receiver.id);
    const stored = remote?.fresh ? remote.configuration : receiver.stored?.configuration ?? remote?.configuration;
    const configured = receiver.configuration.mesh_peers;
    return [...new Set([...configured, ...(stored?.mesh_peers ?? [])])].map(topic => {
      const sources = project.systems.filter(system => system.baseTopic === topic);
      const source = sources.length === 1 ? sources[0] : undefined;
      const receiverUnique = project.systems.filter(system => system.baseTopic === receiver.baseTopic).length === 1;
      const assigned = Boolean(source && source.id !== receiver.id && receiverUnique);
      const confirmed = remote?.fresh === true;
      return {
        source: source?.name ?? topic, sourceTopic: topic,
        sourceBroker: project.brokers.find(broker => broker.id === source?.brokerId)?.name ?? '',
        receiver: receiver.name, receiverTopic: receiver.baseTopic, receiverId: receiver.id,
        receiverBroker: project.brokers.find(broker => broker.id === receiver.brokerId)?.name ?? '',
        assigned, configured: configured.includes(topic), reciprocal: assigned && source!.configuration.mesh_peers.includes(receiver.baseTopic),
        stored: stored ? stored.mesh_peers.includes(topic) : null, confirmed,
        active: confirmed && remote.status.executing && remote.status.activeMatches ? true : confirmed && !remote.status.executing ? false : null
      };
    });
  });
}
