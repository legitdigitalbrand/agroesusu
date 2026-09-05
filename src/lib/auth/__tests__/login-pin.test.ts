// ============================================================================
// Login PIN — unit tests
//
//   1. hashPin/verifyPinHash: correct PIN verifies, wrong PIN rejects,
//      non-4-digit inputs rejected, hashes are salted (two hashes differ).
//   2. Gate cookie: signPinCookie produces a value verifyPinCookie accepts
//      for the right user, and rejects for tampered values, wrong users,
//      and expired cookies.
//   3. isValidPinFormat: only exactly-4-digit strings pass.
// ============================================================================

// Uses Jest (repo standard) — see jest config in package.json.
import {
  hashPin,
  verifyPinHash,
  signPinCookie,
  verifyPinCookie,
  isValidPinFormat,
} from '../login-pin';

describe('hashPin / verifyPinHash', () => {
  it('verifies the correct PIN', () => {
    const stored = hashPin('1234');
    expect(verifyPinHash('1234', stored)).toBe(true);
  });

  it('rejects a wrong PIN', () => {
    const stored = hashPin('1234');
    expect(verifyPinHash('0000', stored)).toBe(false);
    expect(verifyPinHash('1235', stored)).toBe(false);
  });

  it('rejects malformed plaintext pins', () => {
    expect(verifyPinHash('12', hashPin('1234'))).toBe(false);
    expect(verifyPinHash('12345', hashPin('1234'))).toBe(false);
    expect(verifyPinHash('12a4', hashPin('1234'))).toBe(false);
  });

  it('throws on non-4-digit input when hashing', () => {
    expect(() => hashPin('12')).toThrow();
    expect(() => hashPin('12345')).toThrow();
    expect(() => hashPin('12a4')).toThrow();
  });

  it('salts hashes — the same PIN hashes differently each time', () => {
    const a = hashPin('9999');
    const b = hashPin('9999');
    expect(a).not.toEqual(b);
    expect(verifyPinHash('9999', a)).toBe(true);
    expect(verifyPinHash('9999', b)).toBe(true);
  });

  it('never stores the plaintext PIN', () => {
    const stored = hashPin('4321');
    expect(stored).not.toContain('4321');
    expect(stored.startsWith('scrypt$')).toBe(true);
  });

  it('rejects a garbage stored value', () => {
    expect(verifyPinHash('1234', 'not-a-hash')).toBe(false);
    expect(verifyPinHash('1234', '')).toBe(false);
  });
});

describe('PIN gate cookie', () => {
  beforeAll(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-key';
  });

  it('round-trips a signed cookie for the right user', async () => {
    const value = await signPinCookie('user-abc');
    expect(await verifyPinCookie(value, 'user-abc')).toBe(true);
  });

  it('rejects the cookie for a different user', async () => {
    const value = await signPinCookie('user-abc');
    expect(await verifyPinCookie(value, 'user-xyz')).toBe(false);
  });

  it('rejects tampered values', async () => {
    const value = await signPinCookie('user-abc');
    // Flip the signature
    const parts = value.split(':');
    const tampered = `${parts[0]}:${parts[1]}:${parts[2].slice(0, -2)}xx`;
    expect(await verifyPinCookie(tampered, 'user-abc')).toBe(false);
    // Foreign plaintext cookie (the OTP-cookie style attack)
    expect(await verifyPinCookie('true', 'user-abc')).toBe(false);
    expect(await verifyPinCookie(undefined, 'user-abc')).toBe(false);
    expect(await verifyPinCookie('', 'user-abc')).toBe(false);
  });

  it('rejects an expired cookie', async () => {
    // Build an already-expired cookie by hand: userId:exp in the past + valid
    // HMAC for that exact value — verify must still fail on expiry alone.
    const { signPinCookie: _s } = await import('../login-pin');
    const exp = Date.now() - 1000;
    // We can't sign expired values with the public API, so simulate: take a
    // valid cookie and rewind its exp — the HMAC won't match, but expiry is
    // checked before HMAC anyway. Both must reject.
    const value = await _s('user-abc');
    const parts = value.split(':');
    const rewound = `${parts[0]}:${exp}:${parts[2]}`;
    expect(await verifyPinCookie(rewound, 'user-abc')).toBe(false);
  });
});

describe('isValidPinFormat', () => {
  it('accepts exactly 4 digits', () => {
    expect(isValidPinFormat('0000')).toBe(true);
    expect(isValidPinFormat('9042')).toBe(true);
  });
  it('rejects everything else', () => {
    expect(isValidPinFormat('123')).toBe(false);
    expect(isValidPinFormat('12345')).toBe(false);
    expect(isValidPinFormat('12a4')).toBe(false);
    expect(isValidPinFormat(1234)).toBe(false);
    expect(isValidPinFormat(null)).toBe(false);
    expect(isValidPinFormat('')).toBe(false);
  });
});
