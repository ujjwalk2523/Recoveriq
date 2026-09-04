import crypto from 'crypto';
import { getEnvConfig } from '@/lib/config/env';

export interface EncryptedSecretPayload {
  ref: string;
  ciphertext: string;
  iv: string;
  tag: string;
  algorithm: 'aes-256-gcm';
  version: number;
  updatedAt: string;
}

export class SecretStore {
  private static inMemoryStore = new Map<string, EncryptedSecretPayload>();

  /**
   * Derives a deterministic 32-byte key from API_ENCRYPTION_KEY
   */
  private static getEncryptionKey(): Buffer {
    const rawKey = process.env.RECOVERIQ_SECRET_ENCRYPTION_KEY || getEnvConfig().API_ENCRYPTION_KEY;
    return crypto.createHash('sha256').update(rawKey).digest();
  }

  /**
   * Encrypts plaintext string using AES-256-GCM
   */
  static encrypt(plaintext: string): { ciphertext: string; iv: string; tag: string } {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');

    return {
      ciphertext,
      iv: iv.toString('hex'),
      tag,
    };
  }

  /**
   * Decrypts ciphertext string using AES-256-GCM
   */
  static decrypt(ciphertext: string, iv: string, tag: string): string {
    const key = this.getEncryptionKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Stores a secret under a reference key.
   */
  static async setSecret(ref: string, plaintext: string): Promise<string> {
    const { ciphertext, iv, tag } = this.encrypt(plaintext);
    const payload: EncryptedSecretPayload = {
      ref,
      ciphertext,
      iv,
      tag,
      algorithm: 'aes-256-gcm',
      version: 1,
      updatedAt: new Date().toISOString(),
    };

    this.inMemoryStore.set(ref, payload);
    return ref;
  }

  /**
   * Retrieves and decrypts a secret by reference.
   */
  static async getSecret(ref: string): Promise<string | null> {
    const payload = this.inMemoryStore.get(ref);
    if (!payload) return null;

    try {
      return this.decrypt(payload.ciphertext, payload.iv, payload.tag);
    } catch (err: any) {
      throw new Error(`[SecretStore] Failed to decrypt secret reference '${ref}': authentication tag mismatch.`);
    }
  }

  /**
   * Deletes a secret from storage.
   */
  static async deleteSecret(ref: string): Promise<boolean> {
    return this.inMemoryStore.delete(ref);
  }

  /**
   * Rotates a secret, re-encrypting with new plaintext and incrementing version.
   */
  static async rotateSecret(ref: string, newPlaintext: string): Promise<EncryptedSecretPayload> {
    const existing = this.inMemoryStore.get(ref);
    const newVersion = existing ? existing.version + 1 : 1;

    const { ciphertext, iv, tag } = this.encrypt(newPlaintext);
    const payload: EncryptedSecretPayload = {
      ref,
      ciphertext,
      iv,
      tag,
      algorithm: 'aes-256-gcm',
      version: newVersion,
      updatedAt: new Date().toISOString(),
    };

    this.inMemoryStore.set(ref, payload);
    return payload;
  }

  /**
   * Clears in-memory vault (used in testing).
   */
  static clearForTesting() {
    this.inMemoryStore.clear();
  }
}
