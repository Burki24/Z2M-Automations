export type EventCode = 'ready' | 'snapshotRead' | 'systemSelected' | 'languageChanged' | 'rejected';
export interface DebugEvent { time: number; code: EventCode; request: number; system?: string; language?: string }
export class Diagnostics {
  private events: DebugEvent[] = [];
  private end = 0;
  private sequence = 0;
  private expired = false;
  constructor(private readonly clock: () => number = Date.now) {}
  record(code: EventCode, system?: string, language?: string): void {
    if (!this.active()) return;
    // Fixed fields only: never retain arbitrary renderer payloads or editor content.
    const event: DebugEvent = {time: this.clock(), code, request: ++this.sequence};
    if (system && /^example-[ab]$/.test(system)) event.system = system;
    if (language === 'de' || language === 'en') event.language = language;
    this.events.push(event);
    if (this.events.length > 200) this.events.shift();
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
