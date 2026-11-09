import {parseDocument, stringify} from 'yaml';
import {resolve} from 'node:path';
import {checkedDocument} from './draft-validation.js';
import {boundedRead} from './project-files.js';
import type {DraftEditor, DesignerCommand} from './draft-editor.js';
import type {ProjectService} from './project-service.js';
import type {Configuration} from './project.js';
export function importDraft(bytes: Buffer): Configuration {
  if (bytes.length > 1048576) throw new Error('draftLimit');
  try {
    const source = new TextDecoder('utf-8', {fatal: true}).decode(bytes);
    const document = parseDocument(source, {version: '1.2', uniqueKeys: true, merge: false, strict: true});
    if (document.errors.length || document.warnings.length) throw new Error();
    return checkedDocument(document.toJS({maxAliasCount: 0}));
  } catch { throw new Error('draftSchema'); }
}
export function exportDraft(configuration: Configuration): Buffer {
  const bytes = Buffer.from(stringify(checkedDocument(configuration)), 'utf8');
  if (bytes.length > 1048576) throw new Error('draftLimit');
  return bytes;
}
export interface ExchangeDialogs {
  chooseImport(): Promise<string | null>;
  chooseExport(): Promise<string | null>;
  chooseBackup(): Promise<string | null>;
  confirm(summary: {oldRules: number; rules: number; sequences: number; peers: number}): Promise<boolean>;
}
export class DraftExchange {
  constructor(private readonly projects: ProjectService, private readonly editor: DraftEditor, private readonly dialogs: ExchangeDialogs) {}
  async command(command: DesignerCommand): Promise<{ok: true; canceled?: boolean}> {
    const system = this.editor.system(command);
    if (Object.keys(command.payload).length) throw new Error('invalidRequest');
    if (command.route === 'export') {
      const bytes = exportDraft(this.editor.export(command)); const path = await this.dialogs.chooseExport();
      if (!path) return {ok: true, canceled: true};
      this.editor.system(command); await this.projects.exportBytes(path, bytes); return {ok: true};
    }
    let source: string | null = null; let configuration: Configuration;
    if (command.route === 'adopt') {
      if (!system.stored) throw new Error('noStored');
      configuration = checkedDocument({...structuredClone(system.stored.configuration), revision: Math.max(1, system.stored.revision)});
    } else if (command.route === 'import') {
      source = await this.dialogs.chooseImport(); if (!source) return {ok: true, canceled: true};
      configuration = importDraft(await boundedRead(source, 1048576));
    } else throw new Error('invalidRequest');
    if (!await this.dialogs.confirm({oldRules: system.configuration.automations.length, rules: configuration.automations.length,
      sequences: configuration.sequences.length, peers: configuration.mesh_peers.length})) return {ok: true, canceled: true};
    const backup = await this.dialogs.chooseBackup(); if (!backup) return {ok: true, canceled: true};
    const canonical = (path: string) => process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path);
    if (source && canonical(source) === canonical(backup)) throw new Error('fileConflict');
    this.editor.system(command); await this.projects.backup(backup);
    configuration.automations.forEach(rule => { rule['enabled'] = false; });
    this.editor.save(system, configuration);
    if (command.route === 'adopt') this.projects.acceptStoredBase(system.id);
    return {ok: true};
  }
}
