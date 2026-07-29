"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, LoadingState, ErrorState, StatusBadge } from "@/components/yield";
import { TrendingUp } from "lucide-react";

interface InvestmentProduct {
  id: string;
  product_code: string;
  name: string;
  return_rate: number;
  return_type: string;
  risk_level: string;
  status: string;
  minimum_amount: number;
}

export default function AdminInvestmentsPage() {
  const { data: productsData, isLoading, error, refetch } = useQuery<{ products: InvestmentProduct[] }>({
    queryKey: ["admin-investment-products"],
    queryFn: async () => {
      const res = await fetch("/api/investments/products");
      if (!res.ok) throw new Error("Failed to load products");
      return res.json();
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl text-ink">Investment Products</h1>
        <p className="text-sm text-ink-soft">Manage investment products and pool performance</p>
      </div>

      {isLoading ? (
        <LoadingState message="Loading investment products…" />
      ) : error ? (
        <ErrorState message="Couldn't load investment products" onRetry={() => refetch()} />
      ) : (
        <div className="grid gap-4">
          {(productsData?.products || []).map((p) => (
            <Card key={p.id} className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-parchment flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-loam" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-ink">{p.name}</p>
                <p className="text-xs text-ink-soft">
                  {p.product_code} • {p.return_rate}% {p.return_type} • {p.risk_level} risk
                </p>
                <p className="text-xs text-ink-soft mt-0.5">
                  Min: {new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(p.minimum_amount)}
                </p>
              </div>
              <StatusBadge status={p.status} />
            </Card>
          ))}
          {(!productsData?.products || productsData.products.length === 0) && (
            <Card className="text-center py-12 text-ink-soft">No investment products configured.</Card>
          )}
        </div>
      )}
    </div>
  );
}
