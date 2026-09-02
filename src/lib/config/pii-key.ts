/**
 * PII Encryption Key
 * 
 * Used by encrypt_pii() / decrypt_pii() PostgreSQL functions to encrypt
 * BVN and NIN at rest using pgcrypto's pgp_sym_encrypt/decrypt.
 * 
 * Set as Vercel environment variable: PII_ENCRYPTION_KEY
 */
export const PII_ENCRYPTION_KEY = process.env.PII_ENCRYPTION_KEY!;
