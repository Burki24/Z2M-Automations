import {validId} from './project.js';
export type EventCode = 'ready' | 'snapshotRead' | 'systemSelected' | 'languageChanged' | 'rejected' | 'projectRequest' | 'projectChanged' | 'credentialRequest' | 'projectFailed';
const operations = ['status', 'new', 'open', 'save', 'saveAs', 'export', 'restore', 'editing', 'edited', 'rename', 'broker', 'system', 'draft', 'storeCredentials', 'removeCredentials'] as const;
type Operation = typeof operations[number];
export interface DebugEvent { time: number; code: EventCode; request: number; system?: string; language?: string; operation?: Operation }
export class Diagnostics {
  private events: DebugEvent[] = [];
  private end = 0;
  private sequence = 0;
  private expired = false;
  constructor(private readonly clock: () => number = Date.now) {}
  record(code: EventCode, system?: string, language?: string, context?: {operation: Operation; request?: number}): number | undefined {
    if (!this.active()) return undefined;
    // Fixed fields only: never retain arbitrary renderer payloads or editor content.
    const request = context?.request;
    const event: DebugEvent = {time: this.clock(), code, request: request && Number.isSafeInteger(request) && request > 0 ? request : ++this.sequence};
    if (validId(system)) event.system = system;
    if (language === 'de' || language === 'en') event.language = language;
    if (context && operations.includes(context.operation)) event.operation = context.operation;
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
