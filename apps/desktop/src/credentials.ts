import {mkdir, unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {atomicWrite, boundedRead} from './project-files.js';
import type {Broker} from './project.js';
import {exact} from './project.js';

export interface Protector {
  isAsyncEncryptionAvailable(): Promise<boolean>;
  getSelectedStorageBackend(): string;
  encryptStringAsync(value: string): Promise<Buffer>;
  decryptStringAsync(value: Buffer): Promise<{result: string; shouldReEncrypt: boolean}>;
}
export interface CredentialInput {brokerId: string; username: string; password: string; mode: 'protected' | 'session'}
export interface CredentialCommand {brokerId: string; mode: 'protected' | 'session' | 'remove'}
export async function readCredentialFile(path: string): Promise<{username: string; password: string}> {
  try {
    const bytes = await boundedRead(path, 16384);
    const value: unknown = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
    if (!exact(value, ['username', 'password']) || typeof value['username'] !== 'string' || value['username'].length > 256
      || /[\u0000-\u001f]/.test(value['username']) || typeof value['password'] !== 'string' || value['password'].length < 1 || value['password'].length > 4096) throw new Error();
    return {username: value['username'], password: value['password']};
  } catch { throw new Error('invalidCredentials'); }
}
interface Secret {binding: string; username: string; password: string}
export class Credentials {
  private session = new Map<string, Secret>();
  constructor(private readonly directory: string, private readonly protector: Protector, private readonly platform: string) {}
  async protectedAvailable(): Promise<boolean> {
    try {
      return await this.protector.isAsyncEncryptionAvailable() && (this.platform !== 'linux'
        || ['gnome_libsecret', 'kwallet', 'kwallet5', 'kwallet6'].includes(this.protector.getSelectedStorageBackend()));
    } catch { return false; }
  }
  private key(project: string, broker: Broker): string { return createHash('sha256').update(project + ':' + broker.id).digest('hex'); }
  private binding(broker: Broker): string { return JSON.stringify([broker.id, broker.host, broker.port, broker.tls]); }
  clearSession(): void { this.session.clear(); }
  async store(project: string, broker: Broker, input: CredentialInput): Promise<void> {
    const key = this.key(project, broker);
    const secret = {binding: this.binding(broker), username: input.username, password: input.password};
    if (input.mode === 'protected') {
      if (!await this.protectedAvailable()) throw new Error('protectionUnavailable');
      let encrypted: Buffer;
      try { encrypted = await this.protector.encryptStringAsync(JSON.stringify(secret)); } catch { throw new Error('protectionUnavailable'); }
      await mkdir(this.directory, {recursive: true, mode: 0o700});
      await atomicWrite(join(this.directory, key), encrypted);
      this.session.delete(key);
    } else {
      // A session-only choice must also remove older persistent credentials.
      await this.remove(project, broker);
      this.session.set(key, secret);
    }
  }
  async remove(project: string, broker: Broker): Promise<void> {
    const key = this.key(project, broker);
    await unlink(join(this.directory, key)).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; });
    this.session.delete(key);
  }
  // Main-process-only seam for the later MQTT adapter; no credential read IPC exists.
  async read(project: string, broker: Broker): Promise<Secret | null> {
    const key = this.key(project, broker);
    const memory = this.session.get(key);
    if (memory) return memory.binding === this.binding(broker) ? {...memory} : null;
    let bytes: Buffer;
    try { bytes = await boundedRead(join(this.directory, key), 16384); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw new Error('protectionUnavailable'); }
    if (!await this.protectedAvailable()) throw new Error('protectionUnavailable');
    try {
      const secret = JSON.parse((await this.protector.decryptStringAsync(bytes)).result) as Secret;
      if (typeof secret.username !== 'string' || typeof secret.password !== 'string' || secret.binding !== this.binding(broker)) return null;
      return secret;
    } catch { throw new Error('protectionUnavailable'); }
  }
  async status(project: string, broker: Broker): Promise<'none' | 'session' | 'protected' | 'locked'> {
    try {
      const secret = await this.read(project, broker);
      return !secret ? 'none' : this.session.has(this.key(project, broker)) ? 'session' : 'protected';
    } catch { return 'locked'; }
  }
}
