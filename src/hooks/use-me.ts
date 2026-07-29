"use client";

import { useQuery } from "@tanstack/react-query";

// ──────────────────────────────────────────────
// useMe — fetches /api/me (the bootstrap endpoint)
// Returns customer profile, wallet, and account summaries
// ──────────────────────────────────────────────

interface MeResponse {
  type: "customer" | "staff";
  profile: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string;
    bvn: string | null;
    nin: string | null;
    kyc_level: number;
    kyc_status: string;
    residential_address: string | null;
    state: string | null;
    lga: string | null;
    occupation: string | null;
    farm_type: string | null;
    primary_produce: string | null;
    nok_name: string | null;
    nok_phone: string | null;
    nok_relationship: string | null;
    created_at: string;
  };
  wallet: {
    id: string;
    status: string;
    available_balance: number;
    ledger_balance: number;
    reserved_balance: number;
    pending_balance: number;
    currency: string;
    account_number: string | null;
  } | null;
  summaries?: {
    savings: { count: number; total_balance: number; total_interest: number };
    loans: { count: number; total_outstanding: number; has_pending: boolean };
    investments: { count: number; total_value: number };
    cooperatives: Array<{
      cooperative_id: string;
      cooperative_name: string | null;
      role: string;
      joined_at: string;
    }>;
  };
  roles?: string[];
}

export function useMe() {
  return useQuery<MeResponse>({
    queryKey: ["me"],
    queryFn: async () => {
      let res = await fetch("/api/me");
      
      // If customer record doesn't exist, bootstrap it and retry
      if (res.status === 404) {
        const body = await res.json().catch(() => ({}));
        if (body.needsBootstrap) {
          await fetch("/api/bootstrap", { method: "POST" });
          res = await fetch("/api/me");
        }
      }
      
      if (!res.ok) {
        throw new Error("Failed to fetch profile");
      }
      return res.json() as Promise<MeResponse>;
    },
    staleTime: 60 * 1000, // 1 min
    retry: 1,
  });
}
