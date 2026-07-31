"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LoadingState, Button,
} from "@/components/yield";
import {
  TrendingUp, Shield,
} from "lucide-react";
import Link from "next/link";

// ════════════════════════════════════════════════════════════
// Mobile Investments — extends the established design system:
//   - Portfolio tab: active investments with current value
//   - Products tab: browse investment products with risk levels
//   - Risk disclosure indicator
//
// Design rules:
//   - Cards: border-line, rounded-2xl, bg-paper
//   - Product cards: icon + name + risk + rate (mono)
//   - Ochre for single accent (invest CTA)
//   - IBM Plex Mono for all monetary figures
// ════════════════════════════════════════════════════════════

interface InvestmentProduct {
  id: string;
  product_code: string;
  product_name: string;
  description: string;
  expected_return_rate: number;
  return_guarantee_type: string;
  risk_level: string;
  min_investment: number;
  term_months: number;
  is_active: boolean;
}

interface InvestmentAccount {
  id: string;
  status: string;
  principal_amount: number;
  current_value: number;
  product: { product_name: string; expected_return_rate: number; risk_level: string };
  maturity_date: string;
}

export default function InvestmentsPage() {
  const [activeTab, setActiveTab] = useState<"portfolio" | "products">("portfolio");

  const { data: accountsData, isLoading: acctsLoading } = useQuery<{ accounts: InvestmentAccount[] }>({
    queryKey: ["investment-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/investments/accounts");
      if (!res.ok) return { accounts: [] };
      return res.json();
    },
  });

  const { data: productsData, isLoading: prodsLoading } = useQuery<{ products: InvestmentProduct[] }>({
    queryKey: ["investment-products"],
    queryFn: async () => {
      const res = await fetch("/api/investments/products");
      if (!res.ok) return { products: [] };
      return res.json();
    },
  });

  const accounts = accountsData?.accounts || [];
  const products = productsData?.products || [];

  return (
    <div className="space-y-4">
      <h1 className="font-display text-[22px] font-medium text-ink">Investments</h1>

      {/* ─── Tabs ─── */}
      <div className="flex gap-1 bg-parchment rounded-xl p-1">
        <TabButton active={activeTab === "portfolio"} onClick={() => setActiveTab("portfolio")}>
          Portfolio
        </TabButton>
        <TabButton active={activeTab === "products"} onClick={() => setActiveTab("products")}>
          Browse
        </TabButton>
      </div>

      {/* ─── Portfolio tab ─── */}
      {activeTab === "portfolio" && (
        <>
          {acctsLoading ? (
            <LoadingState message="Loading your portfolio…" />
          ) : accounts.length === 0 ? (
            <div className="border border-line rounded-2xl p-8 text-center">
              <TrendingUp className="h-8 w-8 text-ink-soft mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-sm text-ink-soft mb-1">No investments yet</p>
              <p className="text-xs text-ink-soft mb-4">Start investing in agricultural pools from ₦10,000</p>
              <Button size="sm" onClick={() => setActiveTab("products")}>
                Browse products
              </Button>
            </div>
          ) : (
            <>
              {/* Portfolio summary */}
              <div className="bg-gradient-to-br from-indigo to-[indigo-deep] rounded-2xl p-[18px] text-white">
                <p className="text-xs text-white/60 mb-1">Total portfolio value</p>
                <p className="font-mono text-[26px] font-medium">
                  ₦{accounts.reduce((s, a) => s + a.current_value, 0).toLocaleString("en-NG", { minimumFractionDigits: 0 })}
                </p>
                <p className="text-[11px] text-white/50 mt-1">{accounts.length} active {accounts.length === 1 ? "investment" : "investments"}</p>
              </div>

              {/* Individual investments */}
              <div className="space-y-3">
                {accounts.map((acct) => (
                  <InvestmentCard key={acct.id} account={acct} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ─── Products tab ─── */}
      {activeTab === "products" && (
        <>
          {prodsLoading ? (
            <LoadingState message="Loading products…" />
          ) : products.length === 0 ? (
            <div className="border border-line rounded-2xl p-8 text-center">
              <p className="text-sm text-ink-soft">No investment products available</p>
            </div>
          ) : (
            <>
              {/* Risk disclosure notice */}
              <div className="flex items-start gap-2.5 bg-parchment border border-line rounded-2xl p-3.5">
                <Shield className="h-4 w-4 text-indigo flex-shrink-0 mt-0.5" strokeWidth={1.8} />
                <p className="text-[11px] text-ink-soft leading-relaxed">
                  All investments carry risk. You must accept the digital risk disclosure before subscribing.
                  Returns are not guaranteed unless explicitly stated.
                </p>
              </div>

              {/* Product cards */}
              <div className="space-y-3">
                {products.map((product) => (
                  <InvestmentProductCard key={product.id} product={product} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── Investment account card ───
function InvestmentCard({ account }: { account: InvestmentAccount }) {
  const fmtNGN = (v: number) => `₦${v.toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;
  const profit = account.current_value - account.principal_amount;
  const profitPct = account.principal_amount > 0 ? ((profit / account.principal_amount) * 100).toFixed(1) : "0";

  return (
    <div className="border border-line rounded-2xl p-4 bg-paper">
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="text-sm font-medium text-ink">{account.product?.product_name || "Investment"}</p>
          <p className="text-[11px] text-ink-soft mt-0.5">
            Matures {account.maturity_date ? new Date(account.maturity_date).toLocaleDateString("en-NG", { month: "short", year: "numeric" }) : "—"}
          </p>
        </div>
        <span className="text-[12px] px-2 py-0.5 rounded-full bg-loam-light text-loam capitalize">
          {account.status}
        </span>
      </div>
      <div className="flex justify-between items-end">
        <div>
          <p className="font-mono text-lg text-ink">{fmtNGN(account.current_value)}</p>
          <p className="text-xs text-loam mt-0.5">
            {profit >= 0 ? "+" : ""}{fmtNGN(profit)} ({profit >= 0 ? "+" : ""}{profitPct}%)
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[13px] text-loam">{account.product?.expected_return_rate || 0}%</p>
          <p className="text-[12px] text-ink-soft">exp. p.a.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Product card ───
function InvestmentProductCard({ product }: { product: InvestmentProduct }) {
  const fmtNGN = (v: number) => `₦${v.toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;
  const fmtRate = (rate: number) => rate.toFixed(1).replace(/\.0$/, "");

  const riskColors: Record<string, string> = {
    low: "bg-loam-light text-loam",
    moderate: "bg-ochre-light text-ink/60",
    high: "bg-clay-light text-clay",
  };

  const guaranteeLabels: Record<string, string> = {
    guaranteed: "Guaranteed",
    expected: "Expected",
    variable_pool: "Variable pool",
  };

  return (
    <div className="border border-line rounded-2xl p-4 bg-paper flex gap-3">
      <div className="h-[42px] w-[42px] rounded-xl bg-loam-light flex items-center justify-center flex-shrink-0">
        <TrendingUp className="h-[19px] w-[19px] text-indigo" strokeWidth={1.8} />
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-ink">{product.product_name}</p>
            <p className="text-[13px] text-ink-soft mt-0.5">{product.description || "Invest and earn returns"}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[13px] text-loam">{fmtRate(product.expected_return_rate)}%</p>
            <p className="text-[12px] text-ink-soft">p.a.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2.5">
          <span className={`text-[12px] px-2 py-0.5 rounded-full ${riskColors[product.risk_level] || "bg-parchment text-ink-soft"}`}>
            {product.risk_level} risk
          </span>
          <span className="text-[12px] text-ink-soft">
            {guaranteeLabels[product.return_guarantee_type] || product.return_guarantee_type}
          </span>
          <span className="text-[12px] text-ink-soft">·</span>
          <span className="text-[12px] text-ink-soft">From {fmtNGN(product.min_investment)}</span>
        </div>
        <Link href="/investments" className="inline-block mt-3 text-xs px-3.5 py-1.5 rounded-lg bg-indigo text-white">
          Invest now
        </Link>
      </div>
    </div>
  );
}

// ─── Tab button ───
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 text-xs font-medium px-3.5 py-2 rounded-lg transition ${
        active ? "bg-indigo text-white" : "text-ink-soft hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
