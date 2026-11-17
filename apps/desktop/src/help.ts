import type {Language} from './contracts.js';

export const helpSections = ['concepts', 'installation', 'interface', 'project', 'broker', 'systems', 'connection', 'drafts', 'editor', 'motion', 'examples', 'check', 'transfer', 'operation', 'networks', 'files', 'advanced', 'updates', 'troubleshooting', 'checklist'] as const;
export interface HelpRequest {language: Language; section: typeof helpSections[number]}
export function validHelpRequest(value: unknown): value is HelpRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Object.keys(item).sort().join(',') === 'language,section' && (item['language'] === 'en' || item['language'] === 'de')
    && helpSections.some(section => section === item['section']);
}
export function helpURL(request: HelpRequest): string {
  if (!validHelpRequest(request)) throw new Error('Invalid help request.');
  return 'z2ma://app/help/' + request.language + '.html#' + request.section;
}
export function allowedHelpNavigation(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'z2ma:' && url.hostname === 'app' && !url.port && !url.username && !url.password && !url.search
      && /^\/help\/(?:en|de)\.html$/.test(url.pathname) && (!url.hash || /^#[a-z0-9-]+$/.test(url.hash));
  } catch { return false; }
}
