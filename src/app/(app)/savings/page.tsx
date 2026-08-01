"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LoadingState, Button,
} from "@/components/yield";
import {
  Clock, Lock, X, Check, AlertCircle, PiggyBank, Calendar, Wallet,
} from "lucide-react";

// ════════════════════════════════════════════════════════════
// Savings Page — Clear products + real accounts + account creation
// Uses actual DB schema field names (interest_method, lock_period_days, etc.)
// ════════════════════════════════════════════════════════════

interface SavingsProduct {
  id: string;
  product_code: string;
  product_name: string;
  product_type: string;
  description: string;
  interest_rate: number;
  interest_method: string;
  interest_cadence: string;
  minimum_balance: number;
  minimum_deposit: number;
  withdrawal_allowed: boolean;
  lock_period_days: number;
  early_withdrawal_penalty_rate: number;
  early_withdrawal_allowed: boolean;
  term_days: number | null;
  is_active: boolean;
  is_featured: boolean;
}

interface SavingsAccount {
  id: string;
  status: string;
  current_balance?: number;
  target_amount?: number;
  maturity_date?: string | null;
  opened_at?: string | null;
  created_at: string;
  product?: {
    product_name: string;
    product_code: string;
    product_type: string;
    interest_rate: number;
    interest_method: string;
    term_days: number | null;
  };
}

const fmtNGN = (v: number) => `₦${(v || 0).toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;
const fmtRate = (rate: number) => rate.toFixed(1).replace(/\.0$/, "");

export default function SavingsPage() {
  const [activeTab, setActiveTab] = useState<"accounts" | "products">("accounts");
  const [openProduct, setOpenProduct] = useState<SavingsProduct | null>(null);
  const [successAccountId, setSuccessAccountId] = useState<string | null>(null);
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["savings-accounts"] });
      setSuccessAccountId(data.account?.id || null);
    },
  });

  const hasActiveFlexible = accounts.some(a => a.product?.product_type === 'flexible' && a.status === 'active');

  return (
    <div className="space-y-4">
      <h1 className="font-display text-[22px] font-medium text-ink">Savings</h1>

      <div className="flex gap-1 bg-parchment rounded-xl p-1">
        <TabButton active={activeTab === "accounts"} onClick={() => setActiveTab("accounts")}>
          My Accounts {accounts.length > 0 && `(${accounts.length})`}
        </TabButton>
        <TabButton active={activeTab === "products"} onClick={() => setActiveTab("products")}>
          Browse Products
        </TabButton>
      </div>

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
                <Link href={`/savings/${acct.id}`}><AccountCard account={acct} /></Link>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === "products" && (
        <>
          {prodsLoading ? (
            <LoadingState message="Loading products…" />
          ) : products.length === 0 ? (
            <div className="border border-line rounded-2xl p-8 text-center bg-paper">
              <p className="text-sm text-ink-soft">No products available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  hasActiveFlexible={hasActiveFlexible}
                  onOpen={() => {
                    setSuccessAccountId(null);
                    setOpenProduct(product);
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {openProduct && (
        <CreateAccountModal
          product={openProduct}
          onClose={() => {
            setOpenProduct(null);
            setSuccessAccountId(null);
          }}
          onCreate={(data) => createMutation.mutate(data)}
          isLoading={createMutation.isPending}
          error={createMutation.error?.message}
          isSuccess={createMutation.isSuccess && !!successAccountId}
          onViewAccount={() => {
            setOpenProduct(null);
            setSuccessAccountId(null);
            setActiveTab("accounts");
          }}
        />
      )}
    </div>
  );
}

// ─── Create Account Modal ───────────────────────────────────
function CreateAccountModal({
  product, onClose, onCreate, isLoading, error, isSuccess, onViewAccount,
}: {
  product: SavingsProduct;
  onClose: () => void;
  onCreate: (data: { product_id: string; target_amount?: number; initial_deposit?: number }) => void;
  isLoading: boolean;
  error?: string;
  isSuccess: boolean;
  onViewAccount: () => void;
}) {
  const [targetAmount, setTargetAmount] = useState("");
  const [initialDeposit, setInitialDeposit] = useState("");
  const isFixed = product.product_type === 'fixed_deposit';
  const minOpening = product.minimum_deposit || (isFixed ? 5000 : 1000);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-indigo-deep/40 backdrop-blur-sm p-4">
      <div className="bg-paper rounded-2xl border border-line w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-loam-light flex items-center justify-center">
              {isFixed
                ? <Lock className="h-5 w-5 text-indigo" strokeWidth={1.8} />
                : <Clock className="h-5 w-5 text-indigo" strokeWidth={1.8} />}
            </div>
            <div>
              <p className="font-display font-semibold text-[16px] text-ink">{product.product_name}</p>
              <p className="text-[12px] text-ink-soft">{fmtRate(product.interest_rate)}% p.a.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-parchment transition" aria-label="Close">
            <X className="w-5 h-5 text-ink-soft" />
          </button>
        </div>

        {isSuccess ? (
          <div className="p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-loam-light flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-loam" />
            </div>
            <h3 className="font-display font-semibold text-[18px] text-ink mb-2">Account opened!</h3>
            <p className="text-[14px] text-ink-soft mb-6">
              Your {product.product_name} is now active. You can start depositing right away.
            </p>
            <button
              onClick={onViewAccount}
              className="w-full py-3 bg-ochre text-indigo-deep rounded-xl font-semibold text-[15px] hover:opacity-90 transition"
            >
              View my accounts
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="bg-parchment rounded-xl p-3.5 space-y-1.5">
              <div className="flex justify-between text-[13px]">
                <span className="text-ink-soft">Interest rate</span>
                <span className="font-mono text-ink">{fmtRate(product.interest_rate)}% p.a.</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-ink-soft">Interest type</span>
                <span className="text-ink">{product.interest_method === "compound" ? "Compound" : "Flat"}</span>
              </div>
              {isFixed && (
                <div className="flex justify-between text-[13px]">
                  <span className="text-ink-soft">Lock period</span>
                  <span className="text-ink">{product.lock_period_days} days</span>
                </div>
              )}
              {isFixed && product.early_withdrawal_penalty_rate > 0 && (
                <div className="flex justify-between text-[13px]">
                  <span className="text-ink-soft">Early exit penalty</span>
                  <span className="text-clay">{product.early_withdrawal_penalty_rate}% of balance</span>
                </div>
              )}
            </div>

            {isFixed && (
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

            {error && (
              <div className="bg-clay-light rounded-xl p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-clay mt-0.5 flex-shrink-0" />
                <p className="text-[13px] text-clay">{error}</p>
              </div>
            )}

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
                `Open ${product.product_name}`
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Account card — shows specific details per account type ───
function AccountCard({ account }: { account: SavingsAccount }) {
  const productType = account.product?.product_type || 'flexible';
  const productName = account.product?.product_name || "Savings";
  const rate = account.product?.interest_rate || 0;
  const balance = account.current_balance || 0;
  const isLocked = productType === 'fixed_deposit' && account.status === 'active';
  const isMatured = account.status === 'matured';
  const isPending = account.status === 'pending';

  const daysRemaining = account.maturity_date
    ? Math.max(0, Math.ceil((new Date(account.maturity_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="border border-line rounded-2xl p-4 bg-paper">
      <div className="flex items-start gap-3">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isLocked ? 'bg-loam-light' : isMatured ? 'bg-ochre' : 'bg-parchment'
        }`}>
          {isLocked ? (
            <Lock className="h-[19px] w-[19px] text-indigo" strokeWidth={1.8} />
          ) : isMatured ? (
            <Check className="h-[19px] w-[19px] text-indigo-deep" strokeWidth={1.8} />
          ) : (
            <Clock className="h-[19px] w-[19px] text-indigo" strokeWidth={1.8} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-ink truncate">{productName}</p>
            <StatusBadge status={account.status} />
          </div>
          <p className="font-mono text-[20px] font-semibold text-ink mt-1.5">{fmtNGN(balance)}</p>

          {isLocked && daysRemaining !== null && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <Calendar className="w-3.5 h-3.5 text-ink-soft" />
              <p className="text-[12px] text-ink-soft">
                Matures in {daysRemaining} days · {new Date(account.maturity_date!).toLocaleDateString("en-NG", { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          )}

          {isMatured && account.maturity_date && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <Check className="w-3.5 h-3.5 text-loam" />
              <p className="text-[12px] text-loam">Matured — withdraw anytime</p>
            </div>
          )}

          {productType === 'flexible' && account.status === 'active' && (
            <p className="text-[12px] text-ink-soft mt-1.5">Withdraw anytime · {fmtRate(rate)}% p.a. compound</p>
          )}

          {isPending && (
            <p className="text-[12px] text-ink-soft mt-1.5">Make your first deposit to activate</p>
          )}
        </div>

        <div className="text-right flex-shrink-0">
          <p className="font-mono text-[13px] text-loam">{fmtRate(rate)}%</p>
          <p className="text-[12px] text-ink-soft">p.a.</p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-loam-light text-loam',
    pending: 'bg-parchment text-ink-soft',
    matured: 'bg-ochre text-indigo-deep',
    closed: 'bg-clay-light text-clay',
    dormant: 'bg-clay-light text-clay',
  };
  const labels: Record<string, string> = {
    active: 'Active',
    pending: 'Pending',
    matured: 'Matured',
    closed: 'Closed',
    dormant: 'Dormant',
  };
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${styles[status] || styles.pending}`}>
      {labels[status] || status}
    </span>
  );
}

// ─── Product card — self-explanatory ───
function ProductCard({ product, hasActiveFlexible, onOpen }: {
  product: SavingsProduct;
  hasActiveFlexible: boolean;
  onOpen: () => void;
}) {
  const isCooperative = product.product_type === 'esusu' || product.product_type === 'cooperative' || product.product_type === 'group';
  const isFlexible = product.product_type === 'flexible';
  const isFixed = product.product_type === 'fixed_deposit';

  if (isCooperative) {
    return (
      <div className="border border-line rounded-2xl p-5 bg-paper opacity-75">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-xl bg-parchment flex items-center justify-center flex-shrink-0">
            <PiggyBank className="h-5 w-5 text-ink-soft" strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[15px] font-semibold text-ink">{product.product_name}</p>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-parchment text-ink-soft border border-line">
                Coming Soon
              </span>
            </div>
            <p className="text-[13px] text-ink-soft mt-1">{product.description || 'Group savings with cooperative governance'}</p>
            <div className="mt-3 flex items-center gap-2 text-[12px] text-ink-soft">
              <Clock className="w-3.5 h-3.5" />
              <span>This feature is being built. Check back soon.</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-line rounded-2xl p-5 bg-paper">
      <div className="flex items-start gap-3 mb-4">
        <div className={`h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isFixed ? 'bg-loam-light' : 'bg-ochre'
        }`}>
          {isFixed ? (
            <Lock className="h-5 w-5 text-indigo" strokeWidth={1.8} />
          ) : (
            <Wallet className="h-5 w-5 text-indigo-deep" strokeWidth={1.8} />
          )}
        </div>
        <div className="flex-1">
          <p className="text-[15px] font-semibold text-ink">{product.product_name}</p>
          <p className="text-[13px] text-ink-soft mt-0.5">
            {isFlexible ? 'Perfect for everyday saving' : 'Lock your money for higher returns'}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[16px] text-loam font-semibold">{fmtRate(product.interest_rate)}%</p>
          <p className="text-[11px] text-ink-soft">per annum</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-[13px] mb-4">
        {isFlexible ? (
          <>
            <Detail label="Withdraw" value="Anytime" />
            <Detail label="Interest" value={`${fmtRate(product.interest_rate)}% compound daily`} />
            <Detail label="Minimum" value={fmtNGN(product.minimum_deposit || 0)} />
            <Detail label="Good for" value="Emergency fund" />
          </>
        ) : (
          <>
            <Detail label="Lock period" value={`${product.lock_period_days} days`} />
            <Detail label="Interest" value={`${fmtRate(product.interest_rate)}% ${product.interest_method}`} />
            <Detail label="Minimum" value={fmtNGN(product.minimum_deposit || 5000)} />
            <Detail label="Early exit" value={`${product.early_withdrawal_penalty_rate}% penalty`} />
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {isFlexible ? (
          <>
            <Tag>Emergency fund</Tag>
            <Tag>Farm inputs</Tag>
            <Tag>Business cash reserve</Tag>
          </>
        ) : (
          <>
            <Tag>High yield</Tag>
            <Tag>Harvest cycle</Tag>
            <Tag>Locked returns</Tag>
          </>
        )}
      </div>

      {hasActiveFlexible && isFlexible ? (
        <div className="w-full py-3 bg-parchment text-ink-soft rounded-xl font-medium text-[14px] text-center">
          ✓ You already have a Flexible Savings account
        </div>
      ) : (
        <button
          onClick={onOpen}
          className="w-full py-3 bg-ochre text-indigo-deep rounded-xl font-semibold text-[15px] hover:opacity-90 transition"
        >
          Open {product.product_name}
        </button>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-ink-soft">{label}</p>
      <p className="text-ink font-medium mt-0.5">{value}</p>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] px-2.5 py-1 rounded-full bg-parchment text-ink-soft border border-line">
      {children}
    </span>
  );
}

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
