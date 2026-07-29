"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Card, ScreenHeader, Button, LoadingState, ErrorState, EmptyState,
  StatusBadge, ProgressRing,
} from "@/components/yield";
import { Plus, Lock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface SavingsProduct {
  id: string;
  product_code: string;
  product_name: string;
  product_type: string;
  interest_rate: number;
  interest_calc_method: string;
  lock_period_days: number;
  min_amount: number;
  max_amount: number | null;
  is_withdrawable: boolean;
  description: string;
}

interface SavingsAccount {
  id: string;
  product_id: string;
  status: string;
  current_balance: number;
  interest_earned: number;
  target_amount: number | null;
  created_at: string;
  savings_products?: { product_name: string; interest_rate: number; lock_period_days: number; product_code: string; interest_calc_method: string };
}

export default function SavingsPage() {
  const [view, setView] = useState<"accounts" | "products">("accounts");

  const { data: accountsData, isLoading: accountsLoading, error: accountsError, refetch } = useQuery<{ accounts: SavingsAccount[] }>({
    queryKey: ["savings-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/savings/accounts");
      if (!res.ok) throw new Error("Failed to load accounts");
      return res.json();
    },
  });

  const { data: productsData, isLoading: productsLoading } = useQuery<{ products: SavingsProduct[] }>({
    queryKey: ["savings-products"],
    queryFn: async () => {
      const res = await fetch("/api/savings/products");
      if (!res.ok) throw new Error("Failed to load products");
      return res.json();
    },
  });

  const accounts = accountsData?.accounts || [];
  const products = productsData?.products || [];

  return (
    <div className="space-y-5">
      <ScreenHeader
        title="Savings"
        subtitle="Grow your money with purpose"
        action={
          <Link href="/savings/open">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New
            </Button>
          </Link>
        }
      />

      {/* Tab toggle */}
      <div className="flex gap-1 bg-parchment rounded-full p-1">
        <button
          onClick={() => setView("accounts")}
          className={`flex-1 py-2 rounded-full text-sm font-medium transition ${
            view === "accounts" ? "bg-indigo text-white" : "text-ink-soft"
          }`}
        >
          My Accounts
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

      {view === "accounts" ? (
        accountsLoading ? (
          <LoadingState message="Loading your accounts…" />
        ) : accountsError ? (
          <ErrorState message="Couldn't load your accounts" onRetry={refetch} />
        ) : accounts.length === 0 ? (
          <EmptyState
            title="No savings accounts yet"
            message="Open your first savings account and start earning interest."
            action={
              <Link href="/savings/open">
                <Button>Open account</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => {
              const product = account.savings_products;
              const progress = account.target_amount && account.target_amount > 0
                ? Math.min(100, (account.current_balance / account.target_amount) * 100)
                : null;
              const isLocked = account.status === "locked";

              return (
                <Link key={account.id} href={`/savings/accounts/${account.id}`}>
                  <Card className="hover:border-indigo/30 transition cursor-pointer">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-serif text-base text-ink">
                            {product?.product_name || "Savings Account"}
                          </p>
                          {isLocked && <Lock className="h-3.5 w-3.5 text-ink-soft" />}
                        </div>
                        <p className="text-xs text-ink-soft mt-0.5">
                          {product?.product_code} · {product?.interest_rate}% {product?.interest_calc_method}
                        </p>
                      </div>
                      <StatusBadge status={account.status} />
                    </div>

                    <div className="mt-4 flex items-end justify-between">
                      <div>
                        <p className="text-xs text-ink-soft">Balance</p>
                        <p className="font-mono text-xl text-ink">
                          {new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(account.current_balance)}
                        </p>
                        <p className="text-xs text-loam mt-0.5">
                          +{new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(account.interest_earned)} earned
                        </p>
                      </div>
                      {progress !== null && (
                        <ProgressRing progress={progress} size={56} strokeWidth={5} label={`${Math.round(progress)}%`} />
                      )}
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )
      ) : (
        productsLoading ? (
          <LoadingState message="Loading products…" />
        ) : products.length === 0 ? (
          <EmptyState title="No products available" />
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
                    <p className="text-xs text-ink-soft">{product.interest_calc_method}</p>
                  </div>
                </div>

                <p className="text-sm text-ink-soft mt-2">{product.description}</p>

                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {product.lock_period_days > 0 && (
                    <span className="bg-indigo/10 text-indigo rounded-full px-2.5 py-1">🔒 {product.lock_period_days} day lock</span>
                  )}
                  {product.lock_period_days === 0 && (
                    <span className="bg-loam/10 text-loam rounded-full px-2.5 py-1"> Flexible</span>
                  )}
                  <span className="bg-parchment text-ink-soft rounded-full px-2.5 py-1">
                    Min: {new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(product.min_amount)}
                  </span>
                  {product.max_amount && (
                    <span className="bg-parchment text-ink-soft rounded-full px-2.5 py-1">
                      Max: {new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(product.max_amount)}
                    </span>
                  )}
                </div>

                <Link href={`/savings/open?product=${product.id}`} className="block mt-4">
                  <Button size="sm" className="w-full">Open account</Button>
                </Link>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
}
