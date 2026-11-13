import type {RemoteStatus} from './mqtt-protocol.js';

// The extension persists the restart preference separately from its active intent.
// A confirmed 'stopped' intent cannot resume, even if the preference remains true.
export function runtimeStopped(status: RemoteStatus): boolean {
  return !status.executing && !status.execution?.runs.some(run => run.state === 'running')
    && (!status.resumeEnabled || status.recovery === 'stopped');
}

export function sameStoredStatus(a: RemoteStatus, b: RemoteStatus): boolean {
  return a.session === b.session && a.revision === b.revision && a.checksum === b.checksum && a.build === b.build;
}
