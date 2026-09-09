import { redirect } from "next/navigation";

/**
 * /wallet/withdraw — RETIRED (2026-09-09).
 *
 * "Withdraw" and "Transfer" were two identical UIs over the same payout
 * engine (initiateWithdrawal → NIP transfer to an external bank). As a
 * fintech convention, the single external outflow is "Send" at
 * /wallet/transfer; "Withdraw" lives only in the savings context
 * (pot → wallet, /savings/[accountId]).
 *
 * This stub keeps saved links / old bookmarks working.
 */
export default function WithdrawRedirectPage() {
  redirect("/wallet/transfer");
}
