"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LoadingState, Button, ProgressRing,
} from "@/components/yield";
import {
  Clock, Lock, X, Check, AlertCircle, PiggyBank,
} from "lucide-react";


// ════════════════════════════════════════════════════════════
// Savings Page — products + accounts + account creation modal
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
  min_opening_amount?: number;
}

interface SavingsAccount {
  id: string;
  status: string;
  current_balance: number;
  target_amount?: number;
  maturity_date?: string;
  product: { product_name: string; interest_rate: number };
}

const fmtNGN = (v: number) => `₦${(v || 0).toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;

export default function SavingsPage() {
  const [activeTab, setActiveTab] = useState<"accounts" | "products">("accounts");
  const [openProduct, setOpenProduct] = useState<SavingsProduct | null>(null);
  const queryClient = useQueryClient();

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

  const createMutation = useMutation({
    mutationFn: async (data: { product_id: string; target_amount?: number; initial_deposit?: number }) => {
      const res = await fetch("/api/savings/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to open account");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings-accounts"] });
      setOpenProduct(null);
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="font-display text-[22px] font-medium text-ink">Savings</h1>

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
            <div className="border border-line rounded-2xl p-8 text-center bg-paper">
              <div className="w-12 h-12 rounded-full bg-parchment flex items-center justify-center mx-auto mb-3">
                <PiggyBank className="w-6 h-6 text-ink-soft" strokeWidth={1.5} />
              </div>
              <p className="font-medium text-[14px] text-ink mb-1">No savings accounts yet</p>
              <p className="text-[12px] text-ink-soft mb-4">Open an account to start earning interest</p>
              <Button size="sm" onClick={() => setActiveTab("products")}>
                Browse products
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
          {prodsLoading ? (
            <LoadingState message="Loading products…" />
          ) : products.length === 0 ? (
            <div className="border border-line rounded-2xl p-8 text-center bg-paper">
              <p className="text-sm text-ink-soft">No products available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} onOpen={() => setOpenProduct(product)} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── Account Creation Modal ─── */}
      {openProduct && (
        <CreateAccountModal
          product={openProduct}
          onClose={() => setOpenProduct(null)}
          onCreate={(data) => createMutation.mutate(data)}
          isLoading={createMutation.isPending}
          error={createMutation.error?.message}
          isSuccess={createMutation.isSuccess}
        />
      )}
    </div>
  );
}

// ─── Create Account Modal ───────────────────────────────────
function CreateAccountModal({
  product, onClose, onCreate, isLoading, error, isSuccess,
}: {
  product: SavingsProduct;
  onClose: () => void;
  onCreate: (data: { product_id: string; target_amount?: number; initial_deposit?: number }) => void;
  isLoading: boolean;
  error?: string;
  isSuccess: boolean;
}) {
  const [targetAmount, setTargetAmount] = useState("");
  const [initialDeposit, setInitialDeposit] = useState("");
  const fmtRate = (rate: number) => rate.toFixed(1).replace(/\.0$/, "");
  const minOpening = product.min_opening_amount || (product.is_locked ? 5000 : 1000);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-indigo-deep/40 backdrop-blur-sm p-4">
      <div className="bg-paper rounded-2xl border border-line w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-loam-light flex items-center justify-center">
              {product.is_locked
                ? <Lock className="h-5 w-5 text-indigo" strokeWidth={1.8} />
                : <Clock className="h-5 w-5 text-indigo" strokeWidth={1.8} />}
            </div>
            <div>
              <p className="font-display font-semibold text-[16px] text-ink">{product.product_name}</p>
              <p className="text-[12px] text-ink-soft">{fmtRate(product.interest_rate)}% p.a.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-parchment transition">
            <X className="w-5 h-5 text-ink-soft" />
          </button>
        </div>

        {/* Body */}
        {isSuccess ? (
          <div className="p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-loam-light flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-loam" />
            </div>
            <h3 className="font-display font-semibold text-[18px] text-ink mb-2">Account opened!</h3>
            <p className="text-[14px] text-ink-soft mb-6">Your {product.product_name} account is now active.</p>
            <button onClick={onClose} className="w-full py-3 bg-ochre text-indigo-deep rounded-xl font-semibold text-[15px]">
              View my accounts
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Product details */}
            <div className="bg-parchment rounded-xl p-3.5">
              <div className="flex justify-between text-[13px] mb-1">
                <span className="text-ink-soft">Interest rate</span>
                <span className="font-mono text-ink">{fmtRate(product.interest_rate)}% p.a.</span>
              </div>
              <div className="flex justify-between text-[13px] mb-1">
                <span className="text-ink-soft">Type</span>
                <span className="text-ink">{product.interest_type === "compound" ? "Compound" : "Flat"}</span>
              </div>
              {product.is_locked && (
                <div className="flex justify-between text-[13px]">
                  <span className="text-ink-soft">Lock period</span>
                  <span className="text-ink">{product.min_term_days} days</span>
                </div>
              )}
            </div>

            {/* Target amount */}
            {product.is_locked && (
              <div>
                <label className="text-[13px] text-ink-soft font-medium block mb-1.5">Savings target (optional)</label>
                <input
                  type="number"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  placeholder="e.g. 100000"
                  className="w-full px-4 py-3 border border-line rounded-xl text-[16px] bg-paper text-ink focus:outline-none focus:border-indigo"
                />
              </div>
            )}

            {/* Initial deposit */}
            <div>
              <label className="text-[13px] text-ink-soft font-medium block mb-1.5">
                Initial deposit (min {fmtNGN(minOpening)})
              </label>
              <input
                type="number"
                value={initialDeposit}
                onChange={(e) => setInitialDeposit(e.target.value)}
                placeholder={String(minOpening)}
                className="w-full px-4 py-3 border border-line rounded-xl text-[16px] bg-paper text-ink focus:outline-none focus:border-indigo"
              />
              <p className="text-[12px] text-ink-soft mt-1.5">Funds will be transferred from your wallet balance.</p>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-clay-light rounded-xl p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-clay mt-0.5 flex-shrink-0" />
                <p className="text-[13px] text-clay">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={() => onCreate({
                product_id: product.id,
                target_amount: targetAmount ? parseFloat(targetAmount) : undefined,
                initial_deposit: initialDeposit ? parseFloat(initialDeposit) : undefined,
              })}
              disabled={isLoading}
              className="w-full py-3 bg-ochre text-indigo-deep rounded-xl font-semibold text-[15px] disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-indigo-deep border-t-transparent rounded-full animate-spin" />
                  Opening account…
                </>
              ) : (
                "Open account"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Goal card with concentric progress ring ───
function GoalCard({ account }: { account: SavingsAccount }) {
  const balance = account.current_balance || 0;
  const target = account.target_amount || 200000;
  const progress = Math.min(Math.round((balance / target) * 100), 100);

  return (
    <div className="border border-line rounded-2xl p-4 flex items-center gap-3.5 bg-paper">
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
  const isLocked = account.status === "locked";

  return (
    <div className="border border-line rounded-2xl p-4 bg-paper">
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
    </div>
  );
}

// ─── Product card ───
function ProductCard({ product, onOpen }: { product: SavingsProduct; onOpen: () => void }) {
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
        <button
          onClick={onOpen}
          className="inline-block mt-3 text-xs px-3.5 py-1.5 rounded-lg bg-indigo text-white hover:bg-indigo-deep transition"
        >
          Open account
        </button>
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
