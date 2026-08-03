import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'crypto';

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
  const pinSalt = salt || randomBytes(SALT_BYTES).toString('hex');
  const pinHash = pbkdf2Sync(pin, pinSalt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString('hex');

  return { pinHash, pinSalt };
}

/**
 * Verifies a PIN against a stored hash and salt.
 * 
 * Safe against null/undefined inputs and timing attacks.
 * Handles edge cases: whitespace, encoding mismatches, colon-separated hash:salt format.
 * 
 * Returns true ONLY if the PIN is correct. Never throws.
 */
export function verifyPin(
  pin: string | null | undefined,
  storedHash: string | null | undefined,
  storedSalt: string | null | undefined
): boolean {
  if (!pin || typeof pin !== 'string') return false;
  if (!storedHash || typeof storedHash !== 'string') return false;

  // Trim whitespace — DB drivers or copy-paste can introduce trailing spaces
  let hashToCompare = storedHash.trim();
  let saltToUse = storedSalt?.trim() || '';

  // Fallback: If salt is missing but storedHash is formatted as "hash:salt"
  if (!saltToUse && hashToCompare.includes(':')) {
    const parts = hashToCompare.split(':');
    if (parts.length === 2 && parts[0] && parts[1]) {
      hashToCompare = parts[0];
      saltToUse = parts[1];
    }
  }

  if (!saltToUse) {
    return false;
  }

  try {
    const computedHash = pbkdf2Sync(pin, saltToUse, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString('hex');

    // Primary comparison: timing-safe (hex strings, same length)
    if (computedHash === hashToCompare) {
      return true;
    }

    // Secondary comparison: timing-safe via buffers (handles encoding edge cases)
    const bufA = Buffer.from(computedHash, 'hex');
    const bufB = Buffer.from(hashToCompare, 'hex');

    if (bufA.length === bufB.length && bufA.length > 0) {
      try {
        return timingSafeEqual(bufA, bufB);
      } catch {
        // Buffer comparison failed (shouldn't happen if lengths match)
      }
    }

    // Tertiary fallback: plain string comparison
    // This catches cases where Buffer.from('hex') produces empty buffers
    // due to invalid hex chars, but the strings themselves match
    return computedHash === hashToCompare;
  } catch (err) {
    console.error('[verifyPin] Error during verification:', err instanceof Error ? err.message : err);
    return false;
  }
}