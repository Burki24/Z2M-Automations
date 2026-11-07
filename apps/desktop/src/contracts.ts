export const channels = ['snapshot', 'select-system', 'language', 'diagnostics', 'recording'] as const;
export type Channel = typeof channels[number];
export type Language = 'de' | 'en';
export interface LanguageChange { language: Language; previousLanguage: Language; openEditor: boolean }
export interface DesktopBridge {
  snapshot(): Promise<unknown>;
  selectSystem(systemId: string): Promise<{ok: true}>;
  language(change: LanguageChange): Promise<{ok: true}>;
  diagnostics(): Promise<unknown>;
  recording(action: 'start' | 'stop'): Promise<unknown>;
}
