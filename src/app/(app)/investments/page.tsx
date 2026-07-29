"use client";
import { useState } from "react";

import { useQuery } from "@tanstack/react-query";
import {
  Card, ScreenHeader, Button, LoadingState, ErrorState, EmptyState,
  StatusBadge,
} from "@/components/yield";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

interface InvestmentProduct {
  id: string;
  product_code: string;
  product_name: string;
  return_guarantee: string;
  interest_rate: number;
  interest_calc_method: string;
  term_days: number | null;
  min_amount: number;
  max_amount: number | null;
  risk_level: string;
  requires_cooperative: boolean;
  description: string;
}

interface InvestmentAccount {
  id: string;
  status: string;
  current_value: number;
  product_id: string;
  created_at: string;
  investment_products?: { product_name: string; product_code: string; return_guarantee: string; interest_rate: number; risk_level: string; interest_calc_method: string };
}

const riskColors: Record<string, string> = {
  low: "text-loam bg-loam/10",
  moderate: "text-ochre bg-ochre/15",
  high: "text-clay bg-clay/10",
};

const guaranteeLabels: Record<string, string> = {
  guaranteed: "Guaranteed",
  variable_pool: "Variable Pool",
  expected: "Expected",
};

export default function InvestmentsPage() {
  const [view, setView] = useState<"portfolio" | "products">("portfolio");
  const { data: accountsData, isLoading: accountsLoading, error: accountsError, refetch } = useQuery<{ accounts: InvestmentAccount[] }>({
    queryKey: ["investment-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/investments/accounts");
      if (!res.ok) throw new Error("Failed to load portfolio");
      return res.json();
    },
  });

  const { data: productsData, isLoading: productsLoading } = useQuery<{ products: InvestmentProduct[] }>({
    queryKey: ["investment-products"],
    queryFn: async () => {
      const res = await fetch("/api/investments/products");
      if (!res.ok) throw new Error("Failed to load products");
      return res.json();
    },
  });

  const accounts = accountsData?.accounts || [];
  const products = productsData?.products || [];
  const totalValue = accounts.reduce((s, a) => s + Number(a.current_value || 0), 0);

  return (
    <div className="space-y-5">
      <ScreenHeader
        title="Investments"
        subtitle="Grow your money in agricultural pools"
      />

      {/* Tab toggle */}
      <div className="flex gap-1 bg-parchment rounded-full p-1">
        <button
          onClick={() => setView("portfolio")}
          className={`flex-1 py-2 rounded-full text-sm font-medium transition ${
            view === "portfolio" ? "bg-indigo text-white" : "text-ink-soft"
          }`}
        >
          Portfolio
        </button>
        <button
          onClick={() => setView("products")}
          className={`flex-1 py-2 rounded-full text-sm font-medium transition ${
            view === "products" ? "bg-indigo text-white" : "text-ink-soft"
          }`}
        >
          Products
        </button>
      </div>

      {view === "portfolio" ? (
        accountsLoading ? (
          <LoadingState message="Loading your portfolio…" />
        ) : accountsError ? (
          <ErrorState message="Couldn't load your portfolio" onRetry={refetch} />
        ) : accounts.length === 0 ? (
          <EmptyState
            title="No investments yet"
            message="Browse our investment products and start growing your money."
            action={
              <button onClick={() => setView("products")}>
                <Button>Browse products</Button>
              </button>
            }
          />
        ) : (
          <>
            {/* Portfolio total */}
            <Card variant="dark">
              <p className="text-xs text-white/60 uppercase tracking-wide">Total Portfolio Value</p>
              <p className="mt-1 font-mono text-3xl text-white">
                {new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(totalValue)}
              </p>
              <p className="mt-2 text-sm text-white/50">{accounts.length} active {accounts.length === 1 ? "investment" : "investments"}</p>
            </Card>

            {/* Account list */}
            <div className="space-y-3">
              {accounts.map((account) => {
                const product = account.investment_products;
                const guarantee = product?.return_guarantee || "expected";
                return (
                  <Link key={account.id} href={`/investments/accounts/${account.id}`}>
                    <Card className="hover:border-indigo/30 transition cursor-pointer">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-serif text-base text-ink">{product?.product_name || "Investment"}</p>
                          <p className="text-xs text-ink-soft mt-0.5">{product?.product_code}</p>
                        </div>
                        <StatusBadge status={account.status} />
                      </div>

                      <div className="mt-3 flex items-end justify-between">
                        <div>
                          <p className="text-xs text-ink-soft">Current value</p>
                          <p className="font-mono text-xl text-ink">
                            {new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(account.current_value)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-xs rounded-full px-2.5 py-1 ${guarantee === "guaranteed" ? "bg-loam/10 text-loam" : guarantee === "variable_pool" ? "bg-clay/10 text-clay" : "bg-indigo/10 text-indigo"}`}>
                            {guaranteeLabels[guarantee] || guarantee}
                          </span>
                          <span className="text-xs text-ink-soft">{product?.interest_rate}% {product?.interest_calc_method}</span>
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </>
        )
      ) : (
        productsLoading ? (
          <LoadingState message="Loading products…" />
        ) : products.length === 0 ? (
          <EmptyState title="No investment products available" />
        ) : (
          <div className="space-y-3">
            {products.map((product) => (
              <Card key={product.id}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-serif text-base text-ink">{product.product_name}</h3>
                    <p className="text-xs text-ink-soft mt-0.5">{product.product_code}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-lg text-ink">{product.interest_rate}%</p>
                    <p className="text-xs text-ink-soft">{guaranteeLabels[product.return_guarantee]}</p>
                  </div>
                </div>

                <p className="text-sm text-ink-soft mt-2">{product.description}</p>

                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className={`rounded-full px-2.5 py-1 capitalize ${riskColors[product.risk_level] || "bg-parchment text-ink-soft"}`}>
                    {product.risk_level} risk
                  </span>
                  {product.term_days && (
                    <span className="bg-parchment text-ink-soft rounded-full px-2.5 py-1">
                      {product.term_days} day term
                    </span>
                  )}
                  <span className="bg-parchment text-ink-soft rounded-full px-2.5 py-1">
                    Min: {new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(product.min_amount)}
                  </span>
                  {product.requires_cooperative && (
                    <span className="bg-indigo/10 text-indigo rounded-full px-2.5 py-1">Co-op required</span>
                  )}
                </div>

                {product.return_guarantee === "variable_pool" && (
                  <div className="mt-3 flex items-start gap-2 bg-clay/5 rounded-lg p-2.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-clay flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-clay">
                      Returns depend on actual pool performance — not guaranteed.
                    </p>
                  </div>
                )}

                <Link href={`/investments/subscribe?product=${product.id}`} className="block mt-4">
                  <Button size="sm" className="w-full">Invest now</Button>
                </Link>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
}

