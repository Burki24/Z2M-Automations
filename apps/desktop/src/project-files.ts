import {open, rename, unlink, lstat, realpath} from 'node:fs/promises';
import {randomUUID, createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {parseProject, projectBytes, maximumProjectBytes, type Project} from './project.js';

export const digest = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');
const missing = (error: unknown): boolean => (error as NodeJS.ErrnoException)?.code === 'ENOENT';
export async function boundedRead(path: string, max = maximumProjectBytes): Promise<Buffer> {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size > max) throw new Error('invalidProject');
  const handle = await open(path, 'r');
  try {
    const bytes = Buffer.alloc(max + 1);
    let total = 0;
    while (total <= max) {
      const {bytesRead} = await handle.read(bytes, total, max + 1 - total, total);
      if (bytesRead === 0) return bytes.subarray(0, total);
      total += bytesRead;
    }
    throw new Error('invalidProject');
  } finally { await handle.close(); }
}
export async function atomicWrite(path: string, bytes: Buffer): Promise<void> {
  const temporary = path + '.' + randomUUID() + '.tmp';
  let handle;
  try {
    handle = await open(temporary, 'wx', 0o600);
    await handle.writeFile(bytes); await handle.sync(); await handle.close(); handle = undefined;
    await rename(temporary, path);
  } finally {
    await handle?.close();
    await unlink(temporary).catch(error => { if (!missing(error)) throw error; });
  }
}
export class ProjectFile {
  private path: string | null = null;
  private hash: string | null = null;
  clear(): void { this.path = null; this.hash = null; }
  private async isCurrentPath(path: string): Promise<boolean> {
    if (!this.path) return false;
    const canonical = async (name: string): Promise<string> => {
      let normalized: string;
      try { normalized = await realpath(name); } catch (error) { if (!missing(error)) throw error; normalized = resolve(name); }
      return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
    };
    return await canonical(path) === await canonical(this.path);
  }
  async load(path: string): Promise<Project> {
    const bytes = await boundedRead(path); const project = parseProject(bytes);
    this.path = path; this.hash = digest(bytes); return project;
  }
  async save(project: Project, destination?: string): Promise<void> {
    const target = destination ?? this.path;
    if (!target) throw new Error('chooseFile');
    const bytes = projectBytes(project);
    let previous: Buffer | null = null;
    try { previous = await boundedRead(target); } catch (error) { if (!missing(error)) throw error; }
    if (await this.isCurrentPath(target) && (previous === null || digest(previous) !== this.hash)) throw new Error('fileConflict');
    // Preserve the previous version before replacing it, including when Save As overwrites a chosen file.
    if (previous) await atomicWrite(target + '.bak', previous);
    await atomicWrite(target, bytes);
    this.path = target; this.hash = digest(bytes);
  }
  hasPath(): boolean { return this.path !== null; }
  async export(project: Project, destination: string): Promise<void> {
    // Export must not bypass conflict detection for the currently open document.
    if (await this.isCurrentPath(destination)) throw new Error('fileConflict');
    await new ProjectFile().save(project, destination);
  }
  async restore(): Promise<Project> {
    if (!this.path) throw new Error('chooseFile');
    const bytes = await boundedRead(this.path + '.bak');
    // Restore only into memory. A later save preserves the current file as the next backup.
    return parseProject(bytes);
  }
}
