import crypto from 'node:crypto';

/**
 * Generates a cryptographically secure random webhook secret.
 * Format: `whsec_<64 hex chars>` (256 bits of cryptographic entropy).
 */
export function generateSecret(): string {
  const bytes = crypto.randomBytes(32);
  return `whsec_${bytes.toString('hex')}`;
}

/**
 * Generates a non-secret unique connection key identifier.
 * Format: `conn_<24 hex chars>`.
 */
export function generateConnectionKey(): string {
  const bytes = crypto.randomBytes(12);
  return `conn_${bytes.toString('hex')}`;
}

/**
 * Hashes a webhook secret using scrypt with a unique cryptographically random salt.
 * Returns formatted string: `${saltHex}:${hashHex}`.
 */
export function hashSecret(secret: string): string {
  const salt = crypto.randomBytes(16);
  // scryptSync(password, salt, keylen, options)
  const derivedKey = crypto.scryptSync(secret, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
  });
  return `${salt.toString('hex')}:${derivedKey.toString('hex')}`;
}

/**
 * Verifies a supplied candidate secret against the stored `${saltHex}:${hashHex}`
 * using constant-time comparison to prevent timing attacks.
 */
export function verifySecret(candidateSecret: string, storedHash: string): boolean {
  if (!candidateSecret || !storedHash) return false;

  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;

  const [saltHex, expectedKeyHex] = parts;
  if (!saltHex || !expectedKeyHex) return false;

  try {
    const salt = Buffer.from(saltHex, 'hex');
    const expectedKey = Buffer.from(expectedKeyHex, 'hex');

    const derivedKey = crypto.scryptSync(candidateSecret, salt, expectedKey.length, {
      N: 16384,
      r: 8,
      p: 1,
    });

    if (derivedKey.length !== expectedKey.length) {
      return false;
    }

    return crypto.timingSafeEqual(derivedKey, expectedKey);
  } catch {
    return false;
  }
}
