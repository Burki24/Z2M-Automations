import type {Protector} from './credentials.js';

interface StorageAPI extends Protector {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
}
/** Electron 45 async availability alone does not certify an OS-backed Linux key. */
export function osProtection(storage: StorageAPI, platform: string): Protector {
  return {
    isAsyncEncryptionAvailable: async () => platform === 'linux' ? storage.isEncryptionAvailable() : storage.isAsyncEncryptionAvailable(),
    getSelectedStorageBackend: () => storage.getSelectedStorageBackend(),
    encryptStringAsync: async value => platform === 'linux' ? storage.encryptString(value) : storage.encryptStringAsync(value),
    decryptStringAsync: async value => platform === 'linux' ? {result: storage.decryptString(value), shouldReEncrypt: false} : storage.decryptStringAsync(value)
  };
}
