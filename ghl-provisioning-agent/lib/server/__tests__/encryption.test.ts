import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  encryptToken,
  decryptToken,
  generateEncryptionKey,
  isValidEncryptionKey,
} from '../encryption';

describe('Token Encryption', () => {
  let testKey: string;
  const originalEnv = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    // Generate a test key for each test
    testKey = generateEncryptionKey();
    process.env.ENCRYPTION_KEY = testKey;
  });

  afterEach(() => {
    // Restore original env
    if (originalEnv) {
      process.env.ENCRYPTION_KEY = originalEnv;
    } else {
      delete process.env.ENCRYPTION_KEY;
    }
  });

  describe('encryptToken', () => {
    it('should encrypt a plaintext string', () => {
      const plaintext = 'my-secret-token-123';
      const encrypted = encryptToken(plaintext);

      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toBe(plaintext);
      expect(typeof encrypted).toBe('string');
    });

    it('should produce different ciphertext for same plaintext (random IV)', () => {
      const plaintext = 'my-secret-token-123';
      const encrypted1 = encryptToken(plaintext);
      const encrypted2 = encryptToken(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should throw error for empty plaintext', () => {
      expect(() => encryptToken('')).toThrow('Plaintext cannot be empty');
    });

    it('should throw error if encryption key is missing', () => {
      delete process.env.ENCRYPTION_KEY;
      expect(() => encryptToken('test')).toThrow('ENCRYPTION_KEY environment variable is not set');
    });

    it('should throw error for invalid key length', () => {
      const invalidKey = Buffer.from('short-key').toString('base64');
      expect(() => encryptToken('test', invalidKey)).toThrow(
        'Encryption key must be 32 bytes'
      );
    });

    it('should accept custom encryption key', () => {
      const customKey = generateEncryptionKey();
      const plaintext = 'test-token';
      const encrypted = encryptToken(plaintext, customKey);

      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toBe(plaintext);
    });
  });

  describe('decryptToken', () => {
    it('should decrypt an encrypted token', () => {
      const plaintext = 'my-secret-token-123';
      const encrypted = encryptToken(plaintext);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle special characters and unicode', () => {
      const plaintext = 'token-with-special-chars-!@#$%^&*()_+-={}[]|:;<>?,./€£¥';
      const encrypted = encryptToken(plaintext);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle long strings', () => {
      const plaintext = 'a'.repeat(10000);
      const encrypted = encryptToken(plaintext);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw error for empty ciphertext', () => {
      expect(() => decryptToken('')).toThrow('Ciphertext cannot be empty');
    });

    it('should throw error for invalid ciphertext', () => {
      expect(() => decryptToken('invalid-ciphertext')).toThrow('Decryption failed');
    });

    it('should throw error with wrong encryption key', () => {
      const plaintext = 'my-secret-token';
      const encrypted = encryptToken(plaintext);

      const wrongKey = generateEncryptionKey();
      expect(() => decryptToken(encrypted, wrongKey)).toThrow('Decryption failed');
    });

    it('should throw error for corrupted ciphertext', () => {
      const plaintext = 'my-secret-token';
      const encrypted = encryptToken(plaintext);

      // Corrupt the ciphertext
      const corrupted = encrypted.slice(0, -5) + 'xxxxx';
      expect(() => decryptToken(corrupted)).toThrow('Decryption failed');
    });

    it('should use custom encryption key when provided', () => {
      const customKey = generateEncryptionKey();
      const plaintext = 'test-token';
      const encrypted = encryptToken(plaintext, customKey);
      const decrypted = decryptToken(encrypted, customKey);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('generateEncryptionKey', () => {
    it('should generate a valid 32-byte key', () => {
      const key = generateEncryptionKey();

      expect(key).toBeTruthy();
      expect(typeof key).toBe('string');

      const buffer = Buffer.from(key, 'base64');
      expect(buffer.length).toBe(32);
    });

    it('should generate different keys each time', () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();
      const key3 = generateEncryptionKey();

      expect(key1).not.toBe(key2);
      expect(key2).not.toBe(key3);
      expect(key1).not.toBe(key3);
    });

    it('should generate keys that work for encryption/decryption', () => {
      const key = generateEncryptionKey();
      const plaintext = 'test-token-123';

      const encrypted = encryptToken(plaintext, key);
      const decrypted = decryptToken(encrypted, key);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('isValidEncryptionKey', () => {
    it('should return true for valid 32-byte key', () => {
      const validKey = generateEncryptionKey();
      expect(isValidEncryptionKey(validKey)).toBe(true);
    });

    it('should return false for short key', () => {
      const shortKey = Buffer.from('short').toString('base64');
      expect(isValidEncryptionKey(shortKey)).toBe(false);
    });

    it('should return false for long key', () => {
      const longKey = Buffer.from('a'.repeat(64)).toString('base64');
      expect(isValidEncryptionKey(longKey)).toBe(false);
    });

    it('should return false for invalid base64', () => {
      expect(isValidEncryptionKey('not-valid-base64!!!')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidEncryptionKey('')).toBe(false);
    });
  });

  describe('Integration tests', () => {
    it('should support multiple encrypt/decrypt cycles', () => {
      const plaintext = 'my-token';

      const encrypted1 = encryptToken(plaintext);
      const decrypted1 = decryptToken(encrypted1);
      expect(decrypted1).toBe(plaintext);

      const encrypted2 = encryptToken(decrypted1);
      const decrypted2 = decryptToken(encrypted2);
      expect(decrypted2).toBe(plaintext);

      const encrypted3 = encryptToken(decrypted2);
      const decrypted3 = decryptToken(encrypted3);
      expect(decrypted3).toBe(plaintext);
    });

    it('should maintain data integrity across multiple operations', () => {
      const tokens = [
        'access-token-123',
        'refresh-token-456',
        'id-token-789',
        'oauth-token-abc',
      ];

      const encrypted = tokens.map((t) => encryptToken(t));
      const decrypted = encrypted.map((e) => decryptToken(e));

      expect(decrypted).toEqual(tokens);
    });

    it('should handle concurrent encryption operations', () => {
      const plaintext = 'concurrent-token';
      const promises = Array.from({ length: 100 }, () =>
        Promise.resolve(encryptToken(plaintext))
      );

      return Promise.all(promises).then((results) => {
        // All should be different (due to random IV)
        const unique = new Set(results);
        expect(unique.size).toBe(100);

        // All should decrypt to same plaintext
        const decrypted = results.map((r) => decryptToken(r));
        decrypted.forEach((d) => {
          expect(d).toBe(plaintext);
        });
      });
    });
  });

  describe('Security properties', () => {
    it('should use authenticated encryption (GCM)', () => {
      const plaintext = 'secure-token';
      const encrypted = encryptToken(plaintext);

      // Modify the ciphertext (simulate tampering)
      const buffer = Buffer.from(encrypted, 'base64');
      buffer[buffer.length - 1] ^= 0x01; // Flip one bit
      const tampered = buffer.toString('base64');

      // Decryption should fail due to authentication tag mismatch
      expect(() => decryptToken(tampered)).toThrow('Decryption failed');
    });

    it('should not leak plaintext in error messages', () => {
      const plaintext = 'secret-password-123';
      const encrypted = encryptToken(plaintext);

      try {
        decryptToken(encrypted, generateEncryptionKey());
      } catch (error) {
        const errorMessage = (error as Error).message.toLowerCase();
        expect(errorMessage).not.toContain('secret');
        expect(errorMessage).not.toContain('password');
        expect(errorMessage).not.toContain('123');
      }
    });

    it('should produce different ciphertext with same key and plaintext', () => {
      const plaintext = 'deterministic-check';
      const results = new Set();

      for (let i = 0; i < 10; i++) {
        results.add(encryptToken(plaintext));
      }

      // All ciphertexts should be unique (random IV)
      expect(results.size).toBe(10);
    });
  });
});
