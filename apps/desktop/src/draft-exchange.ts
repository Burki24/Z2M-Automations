import {parseDocument, stringify} from 'yaml';
import {resolve} from 'node:path';
import {checkedDocument} from './draft-validation.js';
import {boundedRead} from './project-files.js';
import type {DraftEditor, DesignerCommand} from './draft-editor.js';
import type {ProjectService} from './project-service.js';
import type {Configuration} from './project.js';
import {createDraftFile, readDraftFile, fileDrafts, mergeConfigurations, canonical} from './draft-merge.js';
import {exact, parseProject, validId, validConfiguration} from './project.js';
import type {Entry} from './draft-validation.js';
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
  chooseDraftExport?(): Promise<string | null>;
  chooseProjectExport?(): Promise<string | null>;
  confirm(summary: {oldRules: number; rules: number; sequences: number; peers: number}): Promise<boolean>;
}
export class DraftExchange {
  constructor(private readonly projects: ProjectService, private readonly editor: DraftEditor, private readonly dialogs: ExchangeDialogs) {}
  async fileCommand(command: DesignerCommand): Promise<Entry> {
    const system = this.editor.system(command); const payload = command.payload;
    if (!validId(payload['requestId']) || String(payload['requestId']).startsWith('example') || !['open', 'save', 'project', 'import'].includes(payload['action'])) throw new Error('invalidRequest');
    if (payload['action'] === 'open') {
      if (!exact(payload, ['requestId', 'action'])) throw new Error('invalidRequest');
      const path = await this.dialogs.chooseImport(); if (!path) return {ok: true, canceled: true};
      const bytes = await boundedRead(path, 8388608);
      let file: unknown;
      try { file = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes)); }
      catch { file = createDraftFile(system, importDraft(bytes)); }
      if ((file as Entry)?.['format'] === 'z2m-automations-project') file = parseProject(bytes);
      for (const draft of fileDrafts(file)) {
        if (!validConfiguration(draft.configuration) || draft.base?.configuration && !validConfiguration(draft.base.configuration, true)) throw new Error('draftSchema');
      }
      this.editor.system(command); return {ok: true, file};
    }
    if (payload['action'] === 'project') {
      if (!exact(payload, ['requestId', 'action'])) throw new Error('invalidRequest');
      const path = await this.dialogs.chooseProjectExport?.(); if (!path) return {ok: true, canceled: true};
      this.editor.system(command); await this.projects.backup(path); return {ok: true};
    }
    if (payload['action'] === 'save') {
      if (!exact(payload, ['requestId', 'action', 'file'])) throw new Error('invalidRequest');
      const file = readDraftFile(payload['file']);
      if (!validConfiguration(file.configuration) || file.base?.configuration && !validConfiguration(file.base.configuration, true)) throw new Error('draftSchema');
      const path = await this.dialogs.chooseDraftExport?.(); if (!path) return {ok: true, canceled: true};
      this.editor.system(command); await this.projects.exportBytes(path, Buffer.from(JSON.stringify(file, null, 2) + '\n')); return {ok: true};
    }
    if (!exact(payload, ['requestId', 'action', 'file', 'choices']) || !payload['choices'] || typeof payload['choices'] !== 'object' || Array.isArray(payload['choices'])) throw new Error('invalidRequest');
    const file = readDraftFile(payload['file']);
    if (!validConfiguration(file.configuration)) throw new Error('draftSchema');
    const incoming = structuredClone(file.configuration);
    incoming.mesh_peers = [...system.configuration.mesh_peers];
    const known = new Set(system.configuration.automations.map(rule => rule['id']));
    for (const rule of incoming.automations) if (!known.has(rule['id'])) rule['enabled'] = false;
    const choices = payload['choices'] as Record<string, string>;
    const plan = mergeConfigurations(system.configuration, incoming, null, choices);
    const unchosen = mergeConfigurations(system.configuration, incoming).conflicts;
    if (Object.keys(choices).some(key => !unchosen.some(item => item.key === key) || !['local', 'remote'].includes(choices[key] ?? ''))) throw new Error('invalidRequest');
    if (plan.conflicts.length) return {ok: true, applied: false, conflicts: plan.conflicts};
    const candidate = plan.configuration;
    if (!validConfiguration(candidate)) throw new Error('draftSchema');
    if (canonical({...candidate, revision: 0}) === canonical({...system.configuration, revision: 0})) return {ok: true, applied: true};
    await this.projects.backupDraft(system.id); this.editor.system(command); this.editor.save(system, candidate);
    this.projects.rememberFileImport(system);
    return {ok: true, applied: true};
  }
  async command(command: DesignerCommand): Promise<{ok: true; canceled?: boolean}> {
    const system = this.editor.system(command);
    if (Object.keys(command.payload).length) throw new Error('invalidRequest');
    if (command.route === 'export') {
      const bytes = exportDraft(system.configuration); const path = await this.dialogs.chooseExport();
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
    if (command.route === 'adopt') {
      await this.projects.reconcileStored(this.projects.data().id, this.projects.generation(), system.id, system.stored!);
      this.editor.showDraft(system.id);
      return {ok: true};
    }
    configuration.automations.forEach(rule => { rule['enabled'] = false; });
    this.editor.save(system, configuration);
    return {ok: true};
  }
}
