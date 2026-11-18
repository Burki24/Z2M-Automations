import type {Configuration, Json} from './project.js';

export interface DraftConflict {key: string; kind: string; id: string; name: string; local: Json; remote: Json; base: Json}
export interface MergeResult {configuration: Configuration; conflicts: DraftConflict[]}
export interface DraftBaseline {revision: number; checksum: string; configuration?: Configuration}
export interface DraftFile {format: 'z2m-automations-draft'; version: 1; system: {id: string; name: string; baseTopic: string}; configuration: Configuration; base: {revision: number; checksum: string | null; configuration: Configuration} | null}
const shared = require('./draft-merge.cjs') as {
  mergeConfigurations(local: Configuration, remote: Configuration, base?: Configuration | null, choices?: Record<string, string>): MergeResult;
  canonical(value: unknown): string;
  createDraftFile(system: DraftFile['system'], configuration: Configuration, base?: DraftBaseline | null, ids?: string[] | null): DraftFile;
  readDraftFile(value: unknown): DraftFile;
  fileDrafts(value: unknown): DraftFile[];
};
export const {mergeConfigurations, canonical, createDraftFile, readDraftFile, fileDrafts} = shared;
