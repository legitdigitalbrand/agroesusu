/**
 * Central place for AgroEsusu's monetization — the two real revenue levers
 * live here so they're easy to find and tune. Both are deducted server-side
 * (never trust a client-supplied fee).
 */

// Flat fee charged on top of a personal withdrawal, taken from the pot
// balance in addition to the amount transferred to the user's bank.
export const WITHDRAWAL_FEE_NGN = 50;

// Facilitation fee taken from an esusu group's pool before it's paid out
// to the current cycle's recipient (the traditional "ajo/esusu collector"
// fee, just automated).
export const GROUP_PAYOUT_FEE_PERCENT = 0.015; // 1.5%

export function calcGroupPayoutFee(poolAmount: number) {
  return Math.round(poolAmount * GROUP_PAYOUT_FEE_PERCENT * 100) / 100;
}
