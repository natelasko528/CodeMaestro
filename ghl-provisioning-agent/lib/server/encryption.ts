import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const ENCODING = 'base64';
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 16; // 128 bits authentication tag
const KEY_LENGTH = 32; // 256 bits

/**
 * Get encryption key from environment variable
 * @throws Error if ENCRYPTION_KEY is not set or invalid length
 */
function getEncryptionKey(): Buffer {
  const keyBase64 = process.env.ENCRYPTION_KEY;

  if (!keyBase64) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  const key = Buffer.from(keyBase64, ENCODING);

  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `Encryption key must be ${KEY_LENGTH} bytes (256 bits). ` +
        `Current key is ${key.length} bytes. ` +
        `Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
    );
  }

  return key;
}

/**
 * Encrypt a plaintext string using AES-256-GCM
 * @param plaintext - The string to encrypt
 * @param encryptionKey - Optional encryption key (uses env var if not provided)
 * @returns Base64-encoded encrypted string (format: iv + tag + ciphertext)
 */
export function encryptToken(plaintext: string, encryptionKey?: string): string {
  if (!plaintext) {
    throw new Error('Plaintext cannot be empty');
  }

  const key = encryptionKey
    ? Buffer.from(encryptionKey, ENCODING)
    : getEncryptionKey();

  if (key.length !== KEY_LENGTH) {
    throw new Error(`Encryption key must be ${KEY_LENGTH} bytes (256 bits)`);
  }

  // Generate random initialization vector
  const iv = crypto.randomBytes(IV_LENGTH);

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  // Encrypt
  let encrypted = cipher.update(plaintext, 'utf8', ENCODING);
  encrypted += cipher.final(ENCODING);

  // Get authentication tag
  const tag = cipher.getAuthTag();

  // Combine: iv + tag + ciphertext
  const combined = Buffer.concat([
    iv,
    tag,
    Buffer.from(encrypted, ENCODING),
  ]);

  return combined.toString(ENCODING);
}

/**
 * Decrypt a ciphertext string using AES-256-GCM
 * @param ciphertext - Base64-encoded encrypted string
 * @param encryptionKey - Optional encryption key (uses env var if not provided)
 * @returns Decrypted plaintext string
 * @throws Error if decryption fails (wrong key, corrupted data, etc.)
 */
export function decryptToken(ciphertext: string, encryptionKey?: string): string {
  if (!ciphertext) {
    throw new Error('Ciphertext cannot be empty');
  }

  const key = encryptionKey
    ? Buffer.from(encryptionKey, ENCODING)
    : getEncryptionKey();

  if (key.length !== KEY_LENGTH) {
    throw new Error(`Encryption key must be ${KEY_LENGTH} bytes (256 bits)`);
  }

  try {
    // Decode from base64
    const buffer = Buffer.from(ciphertext, ENCODING);

    // Extract components
    const iv = buffer.subarray(0, IV_LENGTH);
    const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = buffer.subarray(IV_LENGTH + TAG_LENGTH);

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    // Decrypt
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
    throw new Error('Decryption failed: Unknown error');
  }
}

/**
 * Generate a random encryption key suitable for AES-256-GCM
 * @returns Base64-encoded 32-byte encryption key
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString(ENCODING);
}

/**
 * Validate that an encryption key is the correct length
 * @param keyBase64 - Base64-encoded encryption key
 * @returns true if valid, false otherwise
 */
export function isValidEncryptionKey(keyBase64: string): boolean {
  try {
    const key = Buffer.from(keyBase64, ENCODING);
    return key.length === KEY_LENGTH;
  } catch {
    return false;
  }
}
