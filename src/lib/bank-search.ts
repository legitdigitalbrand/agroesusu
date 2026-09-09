// ═════════════════════════════════════════════════════════════
// Bank search — ranked, alias-aware matching for bank pickers.
//
// The bank list comes straight from Safe Haven / NIBSS (~500 institutions,
// the majority tiny MFBs with inconsistent naming: trailing spaces, double
// spaces, ALL CAPS, PLC suffixes). A naive substring filter buries the bank
// the user is looking for under dozens of irrelevant matches ("access"
// matches 30+ entries; "gtb" matches nothing at all).
//
// This module scores every bank against the query and returns the most
// relevant first:
//   1. Exact name match
//   2. Name starts with the query ("guar" → Guaranty Trust Bank)
//   3. Any word in the name starts with the query ("zen" → Zenith Bank)
//   4. Acronym of the name's words equals/starts with the query
//      ("gtb" → Guaranty Trust Bank, "fcmb" → First City Monument Bank)
//   5. Alias expansion ("uba" → United Bank for Africa, "gt" → GTBank)
//   6. Plain substring anywhere (weakest)
// ═════════════════════════════════════════════════════════════

export interface BankOption {
  bankCode: string;
  bankName: string;
}

/**
 * Common short-hands users type that don't match the official bank names.
 * Each alias maps to substrings that appear in the official NIBSS name.
 */
const BANK_ALIASES: Record<string, string[]> = {
  // Guaranty Trust Bank (official name: "GUARANTY TRUST BANK" / "GTBANK...")
  gtbank: ['guaranty trust', 'gtbank'],
  gtb: ['guaranty trust', 'gtbank'],
  gt: ['guaranty trust', 'gtbank'],
  // United Bank for Africa — acronym of the full name is UBFA, not UBA
  uba: ['united bank for africa'],
  // First Bank of Nigeria — acronym FBN
  fbn: ['first bank of nigeria'],
  firstbank: ['first bank of nigeria'],
  'first bank': ['first bank of nigeria'],
  // Access Bank family
  accessbank: ['access bank'],
  // Ecobank
  eco: ['ecobank'],
  // Stanbic / Standard Chartered
  stanchart: ['standard chartered'],
  'standard chartered': ['standard chartered'],
  // Polaris (formerly Skye)
  skye: ['polaris', 'skye'],
  // Titan Trust
  ttf: ['titan trust'],
  titan: ['titan trust'],
  // Fintech wallets users search by short name
  opay: ['opay'],
  'o-pay': ['opay'],
  palmpay: ['palmpay'],
  palm: ['palmpay'],
  moniepoint: ['moniepoint'],
  monie: ['moniepoint'],
  kuda: ['kuda'],
  // Microfinance keyword everyone types
  mfb: ['microfinance'],
  // Jaiz (Islamic bank)
  jaiz: ['jaiz'],
  // Wema
  wemabank: ['wema bank'],
  // Union Bank
  unionbank: ['union bank of nigeria'],
  // Sterling
  sterling: ['sterling bank'],
  // Keystone
  keystone: ['keystone bank'],
  // Heritage
  heritage: ['heritage bank'],
  // Providus
  providus: ['providus'],
  // Suntrust
  suntrust: ['suntrust'],
  // Parallex
  parallex: ['parallex'],
  // Citibank
  citi: ['citibank', 'citi'],
  citibank: ['citibank'],
  // Fidelity
  fidelity: ['fidelity bank'],
  // Zenith
  zenith: ['zenith bank'],
  // Globus
  globus: ['globus'],
};

/** Lowercase, collapse whitespace, trim — the list is messy ("ABUCOOP  MFB "). */
function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** First letters of every word: "First City Monument Bank" → "fcmb". */
function acronymOf(name: string): string {
  return name
    .split(' ')
    .map((word) => word.charAt(0))
    .join('');
}

function scoreBank(normName: string, terms: string[], acronym: string): number {
  let best = 0;

  for (const term of terms) {
    if (term === normName) {
      best = Math.max(best, 100); // exact match
    } else if (normName.startsWith(term)) {
      best = Math.max(best, 90); // name begins with the query
    } else if (acronym === term) {
      best = Math.max(best, 80); // "fcmb" === First City Monument Bank
    } else if (acronym.startsWith(term)) {
      best = Math.max(best, 70); // "gt" matches GTBank's acronym
    } else if (normName.split(' ').some((word) => word.startsWith(term))) {
      best = Math.max(best, 60); // a word starts with the query
    } else if (normName.includes(term)) {
      best = Math.max(best, 30); // substring anywhere — weakest signal
    }
  }

  return best;
}

/**
 * Rank banks against a search query. Returns only banks that match,
 * best first (ties alphabetical). With an empty query, returns the full
 * list alphabetically. Near-duplicate names under different codes are kept
 * but ranked identically (e.g. ACCESS BANK vs ACCESS(DIAMOND) BANK are
 * genuinely distinct NIBSS entries).
 */
export function rankBanks<T extends BankOption>(banks: T[], query: string): T[] {
  const q = normalize(query);

  // Precompute normalized names + acronyms once
  const prepared = banks.map((bank) => {
    const normName = normalize(bank.bankName || '');
    return { bank, normName, acronym: acronymOf(normName) };
  });

  if (!q) {
    return [...prepared]
      .sort((a, b) => a.normName.localeCompare(b.normName))
      .map((p) => p.bank);
  }

  // Expand the query with aliases ("uba" also searches "united bank for africa")
  const terms = Array.from(new Set([q, ...(BANK_ALIASES[q] || []).map(normalize)]));

  const scored = prepared
    .map((p) => ({ ...p, score: scoreBank(p.normName, terms, p.acronym) }))
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score || a.normName.localeCompare(b.normName));

  return scored.map((p) => p.bank);
}
