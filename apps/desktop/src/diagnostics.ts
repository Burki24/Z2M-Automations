import {validId} from './project.js';
export type EventCode = 'ready' | 'snapshotRead' | 'systemSelected' | 'languageChanged' | 'rejected' | 'projectRequest' | 'projectChanged' | 'credentialRequest' | 'projectFailed' | 'mqttConnect' | 'mqttConnected' | 'mqttDisconnected' | 'mqttFailure' | 'mqttRead' | 'mqttReadComplete' | 'mqttTransfer' | 'mqttReply' | 'draftRequest' | 'draftCompleted' | 'draftRejected';
const operations = ['status', 'new', 'open', 'save', 'saveAs', 'export', 'restore', 'editing', 'edited', 'rename', 'broker', 'system', 'draft', 'storeCredentials', 'removeCredentials', 'read', 'connect', 'disconnect', 'validate', 'store', 'install'] as const;
type Operation = typeof operations[number];
const reasons = ['timeout', 'protocol', 'stale', 'disconnected', 'remoteError', 'readError', 'connectionError', 'tlsError', 'authentication', 'permission'] as const;
export interface DebugEvent { time: number; code: EventCode; request: number; system?: string; language?: string; operation?: Operation; transaction?: string; broker?: string; reason?: string }
export class Diagnostics {
  private events: DebugEvent[] = [];
  private end = 0;
  private sequence = 0;
  private expired = false;
  constructor(private readonly clock: () => number = Date.now) {}
  record(code: EventCode, system?: string, language?: string, context?: {operation: Operation; request?: number; transaction?: string; broker?: string; reason?: string}): number | undefined {
    if (!this.active()) return undefined;
    // Fixed fields only: never retain arbitrary renderer payloads or editor content.
    const request = context?.request;
    const event: DebugEvent = {time: this.clock(), code, request: request && Number.isSafeInteger(request) && request > 0 ? request : ++this.sequence};
    if (validId(system)) event.system = system;
    if (language === 'de' || language === 'en') event.language = language;
    if (context && operations.includes(context.operation)) event.operation = context.operation;
    if (context?.transaction && validId(context.transaction) && !context.transaction.startsWith('example')) event.transaction = context.transaction;
    if (context?.broker && validId(context.broker) && !context.broker.startsWith('example')) event.broker = context.broker;
    if (context?.reason && reasons.some(reason => reason === context.reason)) event.reason = context.reason;
    this.events.push(event);
    if (this.events.length > 200) this.events.shift();
    return event.request;
  }
  private active(): boolean {
    if (this.end && this.clock() >= this.end) { this.end = 0; this.expired = true; }
    return this.end > 0;
  }
  control(action: 'start' | 'stop'): ReturnType<Diagnostics['read']> {
    if (action === 'start' && !this.active()) { this.events = []; this.end = this.clock() + 60000; this.expired = false; }
    if (action === 'stop') { this.end = 0; this.expired = false; }
    return this.read();
  }
  read(): {active: boolean; end: number; expired: boolean; events: DebugEvent[]} {
    const active = this.active();
    return {active, end: this.end, expired: this.expired, events: structuredClone(this.events)};
  }
}
