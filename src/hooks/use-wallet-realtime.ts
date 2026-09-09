"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/**
 * useWalletRealtime — subscribes to new wallet_transactions for a wallet
 * via Supabase Realtime and invalidates the affected queries so the balance
 * and history update the moment money lands (no manual refresh, no polling).
 *
 * RLS is enforced by Realtime: subscribers only receive rows they can SELECT
 * (wallet_tx_read_self / wallet_tx_read_staff policies).
 *
 * FAILURE-ISOLATED: Realtime is an enhancement, never a dependency. Every
 * subscribe step is wrapped so a Realtime hiccup can NEVER crash the page —
 * worst case the user refreshes manually, exactly like before this hook.
 *
 * @param walletId — the wallet to watch; pass null/undefined to no-op.
 */
export function useWalletRealtime(walletId: string | null | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!walletId) return;

    // Unique topic per mount. supabase.channel(topic) returns the CACHED
    // channel for a topic that already exists — if another page (e.g. the
    // wallet page) subscribed to the same topic and its unsubscribe is still
    // in flight during navigation, calling .on() on the already-subscribed
    // channel throws "cannot add postgres_changes callbacks after
    // subscribe()" and crashes the new page. A per-mount suffix guarantees
    // a fresh channel every time; duplicate events during the brief
    // navigation overlap are harmless (React Query dedupes refetches).
    const mountId = Math.random().toString(36).slice(2, 10);

    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;

    try {
      const supabase = createClient();

      channel = supabase.channel(`wallet-tx-${walletId}-${mountId}`);

      channel
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "wallet_transactions",
            filter: `wallet_id=eq.${walletId}`,
          },
          () => {
            // New wallet transaction → refresh everything money-related.
            queryClient.invalidateQueries({ queryKey: ["me"] });
            queryClient.invalidateQueries({ queryKey: ["wallet-transactions", walletId] });
            queryClient.invalidateQueries({ queryKey: ["wallet-transactions-statement", walletId] });
            queryClient.invalidateQueries({ queryKey: ["wallet-funding-details"] });
            queryClient.invalidateQueries({ queryKey: ["unread-notifications-count"] });
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "wallet_transactions",
            filter: `wallet_id=eq.${walletId}`,
          },
          () => {
            // Status transitions (pending → confirmed / failed / reversed).
            queryClient.invalidateQueries({ queryKey: ["me"] });
            queryClient.invalidateQueries({ queryKey: ["wallet-transactions", walletId] });
          }
        )
        .subscribe((status: string) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            // Non-fatal: remove the dead channel rather than retry-spamming.
            // The user still sees data via normal fetches; next mount
            // re-subscribes cleanly.
            try {
              if (channel) supabase.removeChannel(channel);
            } catch {
              /* already gone */
            }
          }
        });

      return () => {
        try {
          if (channel) supabase.removeChannel(channel);
        } catch {
          /* component unmounted mid-teardown — nothing to do */
        }
      };
    } catch (err) {
      // Realtime client construction/subscription blew up synchronously —
      // swallow it. The page MUST render; the user falls back to manual refresh.
      console.warn("[useWalletRealtime] non-fatal realtime setup failure:", err);
      try {
        if (channel) createClient().removeChannel(channel);
      } catch {
        /* nothing further */
      }
      return undefined;
    }
  }, [walletId, queryClient]);
}
