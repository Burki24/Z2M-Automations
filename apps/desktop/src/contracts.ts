import type {ProjectCommand} from './project-service.js';
import type {CredentialCommand} from './credentials.js';
import type {NetworkCommand} from './mqtt-reader.js';
import type {DesignerCommand} from './draft-editor.js';
export const channels = ['snapshot', 'select-system', 'language', 'diagnostics', 'recording', 'project', 'credential', 'network', 'designer'] as const;
export type Channel = typeof channels[number];
export type Language = 'de' | 'en';
export interface LanguageChange { language: Language; previousLanguage: Language; openEditor: boolean }
export interface DesktopBridge {
  snapshot(): Promise<unknown>;
  selectSystem(systemId: string): Promise<{ok: true}>;
  language(change: LanguageChange): Promise<{ok: true}>;
  diagnostics(): Promise<unknown>;
  recording(action: 'start' | 'stop'): Promise<unknown>;
  project(command: ProjectCommand): Promise<unknown>;
  credential(input: CredentialCommand): Promise<unknown>;
  network(input: NetworkCommand): Promise<unknown>;
  designer(input: DesignerCommand): Promise<unknown>;
}
