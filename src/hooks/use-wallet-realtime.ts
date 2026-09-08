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
 * @param walletId — the wallet to watch; pass null/undefined to no-op.
 */
export function useWalletRealtime(walletId: string | null | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!walletId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`wallet-tx-${walletId}`)
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [walletId, queryClient]);
}
