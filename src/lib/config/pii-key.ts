/**
 * PII Encryption Key
 * 
 * Used by encrypt_pii() / decrypt_pii() PostgreSQL functions to encrypt
 * BVN and NIN at rest using pgcrypto's pgp_sym_encrypt/decrypt.
 * 
 * SECURITY: This should ideally be set as a Vercel environment variable
 * PII_ENCRYPTION_KEY. This file is a fallback for when the env var is not set.
 * 
 * TODO: Remove this fallback once PII_ENCRYPTION_KEY is set on Vercel.
 */
export const PII_ENCRYPTION_KEY = process.env.PII_ENCRYPTION_KEY || 'fn27nMlH1eQMEYkD80lZ6vPp456Qd7NBuUWNEAuG4p4=';
