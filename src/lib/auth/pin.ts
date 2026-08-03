import crypto from 'crypto';

// Canonical PIN security parameters
const PBKDF2_ITERATIONS = 10000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = 'sha256';
const SALT_BYTES = 16;

/**
 * Validates whether a PIN string is exactly 4 digits.
 */
export function isValidPinFormat(pin: unknown): pin is string {
  return typeof pin === 'string' && /^\d{4}$/.test(pin);
}

/**
 * Hashes a 4-digit PIN using PBKDF2 with SHA-256.
 * Generates a new salt if one is not provided.
 */
export function hashPin(
  pin: string,
  salt?: string
): { pinHash: string; pinSalt: string } {
  const pinSalt = salt || crypto.randomBytes(SALT_BYTES).toString('hex');
  const pinHash = crypto
    .pbkdf2Sync(pin, pinSalt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST)
    .toString('hex');

  return { pinHash, pinSalt };
}

/**
 * Verifies a PIN against a stored hash and salt.
 * 
 * Safe against null/undefined inputs and timing attacks.
 * Fallbacks to checking colon-separated `hash:salt` inside `storedHash` if `storedSalt` is missing.
 */
export function verifyPin(
  pin: string | null | undefined,
  storedHash: string | null | undefined,
  storedSalt: string | null | undefined
): boolean {
  if (!pin || typeof pin !== 'string') return false;
  if (!storedHash || typeof storedHash !== 'string') return false;

  let hashToCompare = storedHash;
  let saltToUse = storedSalt;

  // Fallback: If salt is missing but storedHash is formatted as "hash:salt"
  if ((!saltToUse || typeof saltToUse !== 'string') && hashToCompare.includes(':')) {
    const parts = hashToCompare.split(':');
    if (parts.length === 2 && parts[0] && parts[1]) {
      hashToCompare = parts[0];
      saltToUse = parts[1];
    }
  }

  if (!saltToUse || typeof saltToUse !== 'string') {
    return false;
  }

  try {
    const computedHash = crypto
      .pbkdf2Sync(pin, saltToUse, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST)
      .toString('hex');

    const bufA = Buffer.from(computedHash, 'hex');
    const bufB = Buffer.from(hashToCompare, 'hex');

    if (bufA.length !== bufB.length) return false;

    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}
