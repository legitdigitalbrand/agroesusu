import { rankBanks } from '../bank-search';

const NIBSS_SAMPLE = [
  { bankCode: '000014', bankName: 'ACCESS BANK' },
  { bankCode: '100052', bankName: 'ACCESS YELLO & BETA' },
  { bankCode: '000005', bankName: 'ACCESS(DIAMOND) BANK' },
  { bankCode: '090270', bankName: 'AB MICROFINANCE BANK ' }, // trailing space — real data
  { bankCode: '090424', bankName: 'ABUCOOP  MICROFINANCE BANK' }, // double space — real data
  { bankCode: '058', bankName: 'GUARANTY TRUST BANK' },
  { bankCode: '033', bankName: 'UNITED BANK FOR AFRICA PLC' },
  { bankCode: '011', bankName: 'FIRST BANK OF NIGERIA' },
  { bankCode: '214', bankName: 'FIRST CITY MONUMENT BANK' },
  { bankCode: '502', bankName: 'KUDA MICROFINANCE BANK' },
  { bankCode: '560', bankName: 'OPAY DIGITAL SERVICES LIMITED' },
  { bankCode: '090', bankName: 'MONIEPOINT MFB' },
  { bankCode: '999240', bankName: 'SAFE HAVEN MFB' },
  { bankCode: '082', bankName: 'KEYSTONE BANK' },
  { bankCode: '070', bankName: 'FIDELITY BANK' },
  { bankCode: '035', bankName: 'WEMA BANK' },
  { bankCode: '221', bankName: 'STANBIC IBTC BANK' },
  { bankCode: '322', bankName: 'TITAN TRUST BANK' },
  { bankCode: '057', bankName: 'ZENITH BANK PLC' },
  { bankCode: '990270', bankName: 'AB MICROFINANCE BANK' }, // near-duplicate under a different code
];

describe('rankBanks', () => {
  test('empty query returns the full list alphabetically', () => {
    const result = rankBanks(NIBSS_SAMPLE, '');
    expect(result.length).toBe(NIBSS_SAMPLE.length);
    expect(result[0].bankName).toBe('AB MICROFINANCE BANK '); // messy original name preserved
  });

  test('typing a bank name start ranks it first, junk last', () => {
    const result = rankBanks(NIBSS_SAMPLE, 'access');
    expect(result[0].bankName).toBe('ACCESS BANK');
    // All ACCESS entries rank above unrelated banks
    expect(result.map((b) => b.bankName).slice(0, 3)).toEqual([
      'ACCESS BANK',
      'ACCESS YELLO & BETA',
      'ACCESS(DIAMOND) BANK',
    ]);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  test('acronym "gtb" finds Guaranty Trust Bank (substring match finds nothing)', () => {
    const result = rankBanks(NIBSS_SAMPLE, 'gtb');
    expect(result[0].bankName).toBe('GUARANTY TRUST BANK');
  });

  test('alias "uba" finds United Bank for Africa (acronym UBFA does not match)', () => {
    const result = rankBanks(NIBSS_SAMPLE, 'uba');
    expect(result[0].bankName).toBe('UNITED BANK FOR AFRICA PLC');
  });

  test('acronym "fcmb" finds First City Monument Bank', () => {
    const result = rankBanks(NIBSS_SAMPLE, 'fcmb');
    expect(result[0].bankName).toBe('FIRST CITY MONUMENT BANK');
  });

  test('word match "zen" finds Zenith', () => {
    const result = rankBanks(NIBSS_SAMPLE, 'zen');
    expect(result[0].bankName).toBe('ZENITH BANK PLC');
  });

  test('"gt" ranks Guaranty Trust above banks merely containing the letters', () => {
    const result = rankBanks(NIBSS_SAMPLE, 'gt');
    expect(result[0].bankName).toBe('GUARANTY TRUST BANK');
  });

  test('handles messy whitespace in bank names (real NIBSS data)', () => {
    const result = rankBanks(NIBSS_SAMPLE, 'abuco');
    expect(result[0].bankName).toBe('ABUCOOP  MICROFINANCE BANK');
  });

  test('non-matching query returns nothing (no irrelevant banks popping up)', () => {
    const result = rankBanks(NIBSS_SAMPLE, 'zzzz');
    expect(result).toEqual([]);
  });

  test('irrelevant banks no longer bury the target: "monie" surfaces Moniepoint first', () => {
    const result = rankBanks(NIBSS_SAMPLE, 'monie');
    expect(result[0].bankName).toBe('MONIEPOINT MFB');
  });
});
