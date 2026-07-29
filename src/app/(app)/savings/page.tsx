"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LoadingState, Button, ProgressRing,
} from "@/components/yield";
import {
  Clock, Lock,
} from "lucide-react";
import Link from "next/link";

// ════════════════════════════════════════════════════════════
// Mobile Savings — matches the approved mockup exactly:
//   - Title: "Savings products"
//   - Goal card: concentric progress ring (track behind ochre)
//   - Product list: icon + name + desc + rate (mono) + CTA
//
// Ochre accent rule: the progress ring fill is the single accent.
// ════════════════════════════════════════════════════════════

interface SavingsProduct {
  id: string;
  product_code: string;
  product_name: string;
  description: string;
  interest_rate: number;
  interest_type: string;
  min_term_days: number;
  is_locked: boolean;
}

interface SavingsAccount {
  id: string;
  status: string;
  current_balance: number;
  target_amount?: number;
  maturity_date?: string;
  product: { product_name: string; interest_rate: number };
}

export default function SavingsPage() {
  const [activeTab, setActiveTab] = useState<"accounts" | "products">("accounts");

  const { data: accountsData, isLoading: acctsLoading } = useQuery<{ accounts: SavingsAccount[] }>({
    queryKey: ["savings-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/savings/accounts");
      if (!res.ok) return { accounts: [] };
      return res.json();
    },
  });

  const { data: productsData, isLoading: prodsLoading } = useQuery<{ products: SavingsProduct[] }>({
    queryKey: ["savings-products"],
    queryFn: async () => {
      const res = await fetch("/api/savings/products");
      if (!res.ok) return { products: [] };
      return res.json();
    },
  });

  const accounts = accountsData?.accounts || [];
  const products = productsData?.products || [];

  return (
    <div className="space-y-4">
      {/* Title */}
      <h1 className="font-display text-[22px] font-medium text-ink">Savings products</h1>

      {/* ─── Goal card with progress ring ─── */}
      {accounts.length > 0 && activeTab === "accounts" && (
        <GoalCard account={accounts[0]} />
      )}

      {/* ─── Tabs ─── */}
      <div className="flex gap-1 bg-parchment rounded-xl p-1">
        <TabButton active={activeTab === "accounts"} onClick={() => setActiveTab("accounts")}>
          My Accounts
        </TabButton>
        <TabButton active={activeTab === "products"} onClick={() => setActiveTab("products")}>
          Browse Products
        </TabButton>
      </div>

      {/* ─── Accounts tab ─── */}
      {activeTab === "accounts" && (
        <>
          {acctsLoading ? (
            <LoadingState message="Loading your savings…" />
          ) : accounts.length === 0 ? (
            <div className="border border-line rounded-2xl p-8 text-center">
              <p className="text-sm text-ink-soft mb-3">No savings accounts yet</p>
              <Button size="sm" onClick={() => setActiveTab("products")}>
                Open your first account
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((acct) => (
                <AccountCard key={acct.id} account={acct} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── Products tab ─── */}
      {activeTab === "products" && (
        <>
          <p className="text-xs text-ink-soft">Browse products</p>
          {prodsLoading ? (
            <LoadingState message="Loading products…" />
          ) : products.length === 0 ? (
            <div className="border border-line rounded-2xl p-8 text-center">
              <p className="text-sm text-ink-soft">No products available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Goal card with concentric progress ring ───
function GoalCard({ account }: { account: SavingsAccount }) {
  const balance = account.current_balance || 0;
  const target = account.target_amount || 200000;
  const progress = Math.min(Math.round((balance / target) * 100), 100);
  const fmtNGN = (v: number) => `₦${v.toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;

  return (
    <div className="border border-line rounded-2xl p-4 flex items-center gap-3.5 bg-paper">
      {/* Progress ring — track behind ochre fill */}
      <ProgressRing progress={progress} size={88} strokeWidth={8} label={`${progress}%`} />
      <div>
        <p className="text-[15px] font-medium text-ink">{account.product?.product_name || "Savings goal"}</p>
        <p className="text-xs text-ink-soft mt-1">
          {account.maturity_date
            ? `Matures ${new Date(account.maturity_date).toLocaleDateString("en-NG", { month: "short", year: "numeric" })}`
            : "Flexible withdrawal"}
        </p>
        <p className="font-mono text-[14px] mt-1.5">
          <strong className="text-ink">{fmtNGN(balance)}</strong>{" "}
          <span className="text-ink-soft">of {fmtNGN(target)}</span>
        </p>
      </div>
    </div>
  );
}

// ─── Account card ───
function AccountCard({ account }: { account: SavingsAccount }) {
  const fmtNGN = (v: number) => `₦${v.toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;
  const isLocked = account.status === "locked";

  return (
    <Link href="/savings" className="block border border-line rounded-2xl p-4 bg-paper hover:shadow-sm transition">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-loam-light flex items-center justify-center flex-shrink-0">
          {isLocked ? <Lock className="h-[19px] w-[19px] text-indigo" strokeWidth={1.8} /> : <Clock className="h-[19px] w-[19px] text-indigo" strokeWidth={1.8} />}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-ink">{account.product?.product_name || "Savings"}</p>
          <p className="font-mono text-[15px] text-ink mt-0.5">{fmtNGN(account.current_balance)}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[13px] text-loam">{account.product?.interest_rate || 0}%</p>
          <p className="text-[12px] text-ink-soft">p.a.</p>
        </div>
      </div>
    </Link>
  );
}

// ─── Product card — matches mockup exactly ───
function ProductCard({ product }: { product: SavingsProduct }) {
  const fmtRate = (rate: number) => rate.toFixed(1).replace(/\.0$/, "");

  return (
    <div className="border border-line rounded-2xl p-4 bg-paper flex gap-3">
      <div className="h-[42px] w-[42px] rounded-xl bg-loam-light flex items-center justify-center flex-shrink-0">
        {product.is_locked
          ? <Lock className="h-[19px] w-[19px] text-indigo" strokeWidth={1.8} />
          : <Clock className="h-[19px] w-[19px] text-indigo" strokeWidth={1.8} />}
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-ink">{product.product_name}</p>
            <p className="text-[13px] text-ink-soft mt-0.5">{product.description || "Save and earn interest"}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[13px] text-loam">{fmtRate(product.interest_rate)}%</p>
            <p className="text-[12px] text-ink-soft">p.a.</p>
          </div>
        </div>
        <Link href="/savings" className="inline-block mt-3 text-xs px-3.5 py-1.5 rounded-lg bg-indigo text-white">
          Open account
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
