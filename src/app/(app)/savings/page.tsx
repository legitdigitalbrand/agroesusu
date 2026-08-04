"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ScreenHeader,
  StatCard,
  Card,
  Button,
  StatusBadge,
  MoneyText,
  ProgressRing,
  LoadingState,
  ErrorState,
  EmptyState,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/yield";
import {
  PiggyBank,
  Clock,
  Lock,
  Users,
  Check,
  AlertCircle,
  TrendingUp,
  Calendar,
  Wallet,
  ChevronRight,
  ShieldCheck,
  Plus,
  Sprout,
  Tractor,
  Home,
  Wrench,
  GraduationCap,
  Heart,
  ShoppingBag,
  Info,
} from "lucide-react";

// ════════════════════════════════════════════════════════════
// Savings Page — Premium Fintech Design
// Rebuilt with Agriqcap Yield UI Primitives
// ════════════════════════════════════════════════════════════

export interface SavingsProduct {
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

export interface SavingsAccount {
  id: string;
  status: string;
  current_balance?: number;
  target_amount?: number;
  maturity_date?: string | null;
  opened_at?: string | null;
  created_at: string;
  pot_name?: string | null;
  pot_icon?: string | null;
  pot_color?: string | null;
  product?: {
    product_name: string;
    product_code: string;
    product_type: string;
    interest_rate: number;
    interest_method: string;
    term_days: number | null;
  };
}

const fmtNGN = (v: number) => {
  const n = v || 0;
  return `${n < 0 ? "-" : ""}₦${Math.abs(n).toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;
};
const fmtRate = (rate: number) => (rate || 0).toFixed(1).replace(/\.0$/, "");

function getProductIcon(productType: string) {
  switch (productType) {
    case "flexible":
      return <PiggyBank className="w-5 h-5 text-indigo" strokeWidth={1.8} />;
    case "target":
    case "daily":
      return <Clock className="w-5 h-5 text-indigo" strokeWidth={1.8} />;
    case "fixed_deposit":
      return <Lock className="w-5 h-5 text-indigo" strokeWidth={1.8} />;
    case "esusu":
    case "cooperative":
    case "group":
      return <Users className="w-5 h-5 text-indigo-deep" strokeWidth={1.8} />;
    default:
      return <Wallet className="w-5 h-5 text-indigo" strokeWidth={1.8} />;
  }
}

export default function SavingsPage() {
  const [openProduct, setOpenProduct] = useState<SavingsProduct | null>(null);
  const [successAccountId, setSuccessAccountId] = useState<string | null>(null);
  const [showCreatePot, setShowCreatePot] = useState(false);
  const queryClient = useQueryClient();

  const {
    data: accountsData,
    isLoading: acctsLoading,
    isError: acctsError,
    refetch: refetchAccounts,
  } = useQuery<{ accounts: SavingsAccount[] }>({
    queryKey: ["savings-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/savings/accounts");
      if (!res.ok) throw new Error("Failed to load savings accounts");
      return res.json();
    },
  });

  const {
    data: productsData,
    isLoading: prodsLoading,
    isError: prodsError,
    refetch: refetchProducts,
  } = useQuery<{ products: SavingsProduct[] }>({
    queryKey: ["savings-products"],
    queryFn: async () => {
      const res = await fetch("/api/savings/products");
      if (!res.ok) throw new Error("Failed to load savings products");
      return res.json();
    },
  });

  const rawAccounts = accountsData?.accounts || [];
  const rawProducts = productsData?.products || [];

  // Deduplicate accounts by id
  const seenIds = new Set<string>();
  const accounts = rawAccounts.filter((acct) => {
    if (!acct.id || seenIds.has(acct.id)) return false;
    seenIds.add(acct.id);
    return true;
  });

  // Sort products so esusu / group savings appear first
  const products = [...rawProducts].sort((a, b) => {
    const aIsEsusu =
      a.product_type === "esusu" || a.product_type === "cooperative" || a.product_type === "group";
    const bIsEsusu =
      b.product_type === "esusu" || b.product_type === "cooperative" || b.product_type === "group";
    if (aIsEsusu && !bIsEsusu) return -1;
    if (!aIsEsusu && bIsEsusu) return 1;
    return 0;
  });

  const createMutation = useMutation({
    mutationFn: async (data: {
      product_id: string;
      target_amount?: number;
      initial_deposit?: number;
    }) => {
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


  // Create pot mutation
  const createPotMutation = useMutation({
    mutationFn: async (data: {
      pot_name: string;
      pot_icon?: string;
      pot_color?: string;
      lock_type: "flexible" | "locked";
      lock_until_date?: string | null;
      target_amount?: number;
      initial_deposit?: number;
    }) => {
      const res = await fetch("/api/savings/pots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to create pot");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings-accounts"] });
      setShowCreatePot(false);
      setPotSuccess(true);
      setTimeout(() => setPotSuccess(false), 3000);
    },
  });

  const [potSuccess, setPotSuccess] = useState(false);

  const hasActiveFlexible = accounts.some(
    (a) => a.product?.product_type === "flexible" && a.status === "active"
  );

  const isLoading = acctsLoading || prodsLoading;
  const isError = acctsError || prodsError;

  if (isLoading) {
    return <LoadingState message="Loading savings and investment products…" />;
  }

  if (isError) {
    return (
      <ErrorState
        message="Unable to load your savings information."
        onRetry={() => {
          refetchAccounts();
          refetchProducts();
        }}
      />
    );
  }

  const totalBalance = accounts.reduce((sum, a) => sum + (a.current_balance || 0), 0);
  const activeAccountsCount = accounts.filter((a) => a.status === "active").length;
  const maxInterestRate =
    products.length > 0 ? Math.max(...products.map((p) => p.interest_rate || 0)) : 0;

  const hasAccounts = accounts.length > 0;

  return (
    <div className="space-y-8 pb-12">
      {/* Screen Header */}
      <ScreenHeader
        title="Savings & Yield"
        subtitle="Grow your wealth with competitive interest rates tailored for agricultural cycles."
      />


      {/* Savings Explainer */}
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-loam-light/20 border border-loam/20">
        <Info className="w-4 h-4 text-loam shrink-0 mt-0.5" />
        <p className="text-xs text-ink-soft leading-relaxed">
          <span className="font-semibold text-ink">Money you've set aside from your Wallet.</span>{" "}
          Locked pots can't be touched until your chosen date. Create unlimited pots for different goals.
        </p>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Total Savings Balance"
          value={<MoneyText amount={totalBalance} size="2xl" />}
          variant="dark"
          icon={<Wallet className="w-5 h-5" />}
          subtitle={`${activeAccountsCount} active ${activeAccountsCount === 1 ? "account" : "accounts"}`}
        />
        <StatCard
          title="Active Accounts"
          value={activeAccountsCount}
          icon={<PiggyBank className="w-5 h-5" />}
          subtitle="Performing savings plans"
        />
        <StatCard
          title="Max Annual Yield"
          value={`${fmtRate(maxInterestRate)}% p.a.`}
          variant="ochre"
          icon={<TrendingUp className="w-5 h-5" />}
          subtitle="Highest available yield"
        />
      </div>


      {/* Create New Pot */}
      <div className="flex justify-end">
        <Button
          variant="primary"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setShowCreatePot(true)}
        >
          Create New Pot
        </Button>
      </div>

      {/* Active Accounts Section */}
      {hasAccounts && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold text-ink">My Savings Accounts</h2>
              <p className="text-xs text-ink-soft mt-0.5">
                Manage your active deposits, view earnings, and make quick transfers.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-parchment text-ink border border-line">
              {accounts.length} {accounts.length === 1 ? "Account" : "Accounts"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accounts.map((acct) => (
              <ActiveAccountCard key={acct.id} account={acct} />
            ))}
          </div>
        </section>
      )}

      {/* Products Showcase Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">
              {hasAccounts ? "Open Another Account" : "Available Savings Products"}
            </h2>
            <p className="text-xs text-ink-soft mt-0.5">
              {hasAccounts
                ? "Explore additional high-yield options to accelerate your savings goals."
                : "Choose a savings plan that aligns with your financial timeline and returns."}
            </p>
          </div>
        </div>

        {products.length === 0 ? (
          <EmptyState
            title="No Products Available"
            message="Check back soon for new high-yield savings plans."
            icon={<PiggyBank className="w-6 h-6 text-ink-soft" />}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {products.map((product) => (
              <ProductShowcaseCard
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
      </section>

      {/* Create Account Modal */}
      {openProduct && (
        <CreateAccountDialog
          product={openProduct}
          isOpen={!!openProduct}
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
          }}
        />
      )}

      {/* Create Pot Dialog */}
      {showCreatePot && (
        <CreatePotDialog
          isOpen={showCreatePot}
          onClose={() => setShowCreatePot(false)}
          onCreate={(data) => createPotMutation.mutate(data)}
          isLoading={createPotMutation.isPending}
          error={createPotMutation.error?.message}
        />
      )}

      {/* Pot Success Animation */}
      <AnimatePresence>
        {potSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-loam text-white px-5 py-3 rounded-2xl shadow-lg flex items-center gap-2"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: "spring" }}
            >
              <Check className="w-5 h-5" strokeWidth={2.5} />
            </motion.div>
            <span className="text-sm font-semibold">Pot created successfully!</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Active Account Card ───────────────────────────────────
function ActiveAccountCard({ account }: { account: SavingsAccount }) {
  const productType = account.product?.product_type || "flexible";
  const displayName = account.pot_name || account.product?.product_name || "Savings Account";
  const rate = account.product?.interest_rate || 0;
  const balance = account.current_balance || 0;
  const target = account.target_amount || 0;

  const isCustomPot = productType === "custom_pot";
  const isLocked = (productType === "fixed_deposit" || (isCustomPot && account.maturity_date)) && account.status === "active";
  const isMatured = account.status === "matured";

  const daysRemaining = account.maturity_date
    ? Math.max(0, Math.ceil((new Date(account.maturity_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const hasTarget = target > 0;
  const progressPercent = hasTarget ? Math.min(100, Math.round((balance / target) * 100)) : 0;

  return (
    <Card variant="light" padding="md" className="flex flex-col justify-between space-y-4 hover:border-line transition-all">
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-parchment border border-line shrink-0" style={account.pot_color ? { color: account.pot_color } : { color: "#6366F1" }}>
              {isCustomPot ? getPotIcon(account.pot_icon) : getProductIcon(productType)}
            </div>
            <div>
              <h3 className="font-display font-semibold text-base text-ink leading-tight">
                {displayName}
              </h3>
              <p className="text-xs text-ink-soft mt-0.5">
                {fmtRate(rate)}% p.a. • {account.product?.interest_method || "standard"}
              </p>
            </div>
          </div>
          <StatusBadge status={account.status} />
        </div>

        <div className="flex items-end justify-between gap-4 mt-2">
          <div>
            <p className="text-xs text-ink-soft uppercase font-medium tracking-wider mb-1">
              Current Balance
            </p>
            <MoneyText amount={balance} size="2xl" />
          </div>

          {hasTarget && (
            <ProgressRing
              progress={progressPercent}
              size={64}
              strokeWidth={6}
              label={`${progressPercent}%`}
              sublabel="target"
              variant="indigo"
            />
          )}
        </div>

        {/* Maturity / Lock / Target info */}
        <div className="mt-4 pt-3 border-t border-line/60 flex flex-wrap items-center justify-between text-xs text-ink-soft gap-2">
          {isLocked && daysRemaining !== null && (
            <div className="flex items-center gap-1.5 text-indigo">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>
                Matures in {daysRemaining} days (
                {new Date(account.maturity_date!).toLocaleDateString("en-NG", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
                )
              </span>
            </div>
          )}

          {isMatured && (
            <div className="flex items-center gap-1.5 text-loam font-semibold">
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>Matured — available for withdrawal</span>
            </div>
          )}

          {!isLocked && !isMatured && (
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-loam shrink-0" />
              <span>Flexible withdrawal anytime</span>
            </div>
          )}

          {hasTarget && (
            <div className="font-mono text-ink">
              Target: {fmtNGN(target)}
            </div>
          )}
        </div>
      </div>

      {/* Action Row */}
      <div className="pt-2 flex items-center gap-2">
        <Link href={`/savings/${account.id}`} className="flex-1">
          <Button variant="outline" size="sm" fullWidth>
            Manage & Transactions <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </Link>
      </div>
    </Card>
  );
}

// ─── Product Showcase Card ─────────────────────────────────
function ProductShowcaseCard({
  product,
  hasActiveFlexible,
  onOpen,
}: {
  product: SavingsProduct;
  hasActiveFlexible: boolean;
  onOpen: () => void;
}) {
  const isCooperative =
    product.product_type === "esusu" ||
    product.product_type === "cooperative" ||
    product.product_type === "group";
  const isFlexible = product.product_type === "flexible";
  const isFixed = product.product_type === "fixed_deposit";

  if (isCooperative) {
    return <EsusuWaitlistCard product={product} />;
  }

  const isFeatured = product.is_featured;

  return (
    <Card
      variant="light"
      padding="lg"
      className={`flex flex-col justify-between relative transition-all duration-200 ${
        isFeatured ? "border-ochre/60 bg-gradient-to-br from-paper via-paper to-ochre-light/20 shadow-md" : ""
      }`}
    >
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-3 rounded-2xl shrink-0 ${
                isFixed ? "bg-loam-light/80 text-loam" : "bg-ochre-light/80 text-indigo-deep"
              }`}
            >
              {getProductIcon(product.product_type)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-display font-semibold text-lg text-ink">
                  {product.product_name}
                </h3>
                {isFeatured && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-ochre text-indigo-deep uppercase tracking-wider">
                    Featured
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-soft mt-0.5">
                {isFlexible
                  ? "Flexible daily access with compound interest"
                  : isFixed
                  ? "High-yield locked investment for fixed terms"
                  : "Targeted savings plan for agricultural milestones"}
              </p>
            </div>
          </div>
        </div>

        {/* Rate Banner */}
        <div className="p-4 rounded-2xl bg-parchment border border-line/80 mb-5 flex items-center justify-between">
          <div>
            <span className="text-xs text-ink-soft font-medium uppercase tracking-wider block">
              Annual Interest Rate
            </span>
            <span className="font-mono text-2xl font-bold text-loam">
              +{fmtRate(product.interest_rate)}% <span className="text-xs font-normal text-ink-soft">p.a.</span>
            </span>
          </div>
          <div className="text-right">
            <span className="text-xs text-ink-soft font-medium uppercase tracking-wider block">
              Calculation
            </span>
            <span className="text-xs font-semibold text-ink capitalize">
              {product.interest_method || "compound"} ({product.interest_cadence || "daily"})
            </span>
          </div>
        </div>

        {/* Description */}
        {product.description && (
          <p className="text-xs text-ink-soft leading-relaxed mb-5">{product.description}</p>
        )}

        {/* Features / Bullet Details */}
        <div className="grid grid-cols-2 gap-3 text-xs mb-6 p-3 rounded-xl bg-paper border border-line/60">
          <div>
            <span className="text-ink-soft block font-medium">Withdrawal Rules</span>
            <span className="text-ink font-semibold mt-0.5 block">
              {product.withdrawal_allowed ? "Anytime access" : `Locked (${product.lock_period_days || 0} days)`}
            </span>
          </div>
          <div>
            <span className="text-ink-soft block font-medium">Min Deposit</span>
            <span className="text-ink font-semibold mt-0.5 block font-mono">
              {fmtNGN(product.minimum_deposit || 0)}
            </span>
          </div>
          {isFixed && (
            <div>
              <span className="text-ink-soft block font-medium">Lock Period</span>
              <span className="text-ink font-semibold mt-0.5 block">
                {product.lock_period_days || 30} Days
              </span>
            </div>
          )}
          {isFixed && product.early_withdrawal_penalty_rate > 0 && (
            <div>
              <span className="text-ink-soft block font-medium">Early Exit Fee</span>
              <span className="text-clay font-semibold mt-0.5 block">
                {product.early_withdrawal_penalty_rate}% penalty
              </span>
            </div>
          )}
        </div>

        {/* Feature Tags */}
        <div className="flex flex-wrap gap-1.5 mb-6">
          {isFlexible ? (
            <>
              <Tag>Emergency Reserve</Tag>
              <Tag>Farm Inputs</Tag>
              <Tag>Daily Compound</Tag>
            </>
          ) : (
            <>
              <Tag>Harvest Cycle Yield</Tag>
              <Tag>Guaranteed Rate</Tag>
              <Tag>Locked Growth</Tag>
            </>
          )}
        </div>
      </div>

      {/* Button */}
      <div>
        {hasActiveFlexible && isFlexible ? (
          <Button variant="outline" disabled fullWidth className="cursor-not-allowed">
            ✓ Active Flexible Account Exists
          </Button>
        ) : (
          <Button variant="secondary" fullWidth onClick={onOpen}>
            Open {product.product_name}
          </Button>
        )}
      </div>
    </Card>
  );
}

// ─── Tag Helper ───────────────────────────────────────────
function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-parchment text-ink border border-line/60">
      {children}
    </span>
  );
}

// ─── Esusu Waitlist Card ──────────────────────────────────
function EsusuWaitlistCard({ product }: { product: SavingsProduct }) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    try {
      const waitlist = JSON.parse(localStorage.getItem("agriqcap_esusu_waitlist") || "[]");
      waitlist.push({ email, product: product.product_code, date: new Date().toISOString() });
      localStorage.setItem("agriqcap_esusu_waitlist", JSON.stringify(waitlist));
    } catch {
      // Ignore storage errors
    }
    setSubmitted(true);
  };

  return (
    <Card
      variant="light"
      padding="lg"
      className="border-ochre/40 bg-gradient-to-br from-ochre-light/30 via-paper to-paper relative overflow-hidden flex flex-col justify-between"
    >
      <div>
        <div className="flex items-start gap-3 mb-4">
          <div className="p-3 rounded-2xl bg-ochre text-indigo-deep shrink-0">
            <Users className="w-5 h-5" strokeWidth={2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-semibold text-lg text-ink">
                {product.product_name}
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-ochre text-indigo-deep uppercase tracking-wider">
                Flagship
              </span>
            </div>
            <p className="text-xs text-ink-soft mt-1">
              {product.description ||
                "Rotating group savings with your trusted community circle — traditional esusu, modernized."}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-paper border border-line mb-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-ink-soft">Group Yield Benefit</span>
            <span className="font-mono font-semibold text-loam">
              +{fmtRate(product.interest_rate || 15)}% p.a.
            </span>
          </div>
        </div>

        {submitted ? (
          <div className="bg-loam-light/60 border border-loam/20 rounded-xl p-3.5 flex items-center gap-2.5">
            <Check className="w-4 h-4 text-loam shrink-0" />
            <p className="text-xs font-semibold text-loam">
              You&apos;re on the waitlist! We&apos;ll notify you when Esusu goes live.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="block text-xs font-medium text-ink-soft">
              Join the priority waitlist for early access:
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                className="flex-1 rounded-xl border border-line bg-paper px-3.5 py-2.5 text-xs text-ink outline-none focus:border-indigo placeholder:text-ink-soft"
              />
              <Button type="submit" variant="primary" size="sm">
                Join Waitlist
              </Button>
            </div>
          </form>
        )}
      </div>

      <p className="text-[11px] text-ink-soft mt-4 pt-3 border-t border-line/60">
        Esusu group savings empowers agricultural co-operatives with collective returns.
      </p>
    </Card>
  );
}

// ─── Create Account Dialog Modal ───────────────────────────
function CreateAccountDialog({
  product,
  isOpen,
  onClose,
  onCreate,
  isLoading,
  error,
  isSuccess,
  onViewAccount,
}: {
  product: SavingsProduct;
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: { product_id: string; target_amount?: number; initial_deposit?: number }) => void;
  isLoading: boolean;
  error?: string;
  isSuccess: boolean;
  onViewAccount: () => void;
}) {
  const [targetAmount, setTargetAmount] = useState("");
  const [initialDeposit, setInitialDeposit] = useState("");

  const isFixed = product.product_type === "fixed_deposit";
  const minOpening = product.minimum_deposit || (isFixed ? 5000 : 1000);

  const handleSubmit = () => {
    onCreate({
      product_id: product.id,
      target_amount: targetAmount ? parseFloat(targetAmount) : undefined,
      initial_deposit: initialDeposit ? parseFloat(initialDeposit) : undefined,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-xl bg-loam-light text-loam shrink-0">
              {getProductIcon(product.product_type)}
            </div>
            <div>
              <DialogTitle>{product.product_name}</DialogTitle>
              <DialogDescription>
                Earn {fmtRate(product.interest_rate)}% annual interest
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isSuccess ? (
          <div className="py-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-loam-light border border-loam/30 flex items-center justify-center mx-auto text-loam">
              <Check className="w-8 h-8" strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="font-display text-xl font-semibold text-ink">Account Opened!</h3>
              <p className="text-xs text-ink-soft mt-1 max-w-xs mx-auto">
                Your new {product.product_name} account is active and ready for deposits.
              </p>
            </div>

            <DialogFooter className="sm:justify-center">
              <Button variant="secondary" fullWidth onClick={onViewAccount}>
                View My Accounts
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Rate & Terms Summary Box */}
            <div className="p-3.5 rounded-2xl bg-parchment border border-line space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-ink-soft">Interest Rate</span>
                <span className="font-mono font-semibold text-loam">
                  +{fmtRate(product.interest_rate)}% p.a.
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">Interest Type</span>
                <span className="text-ink font-medium capitalize">
                  {product.interest_method || "compound"} ({product.interest_cadence || "daily"})
                </span>
              </div>
              {isFixed && (
                <div className="flex justify-between">
                  <span className="text-ink-soft">Lock Period</span>
                  <span className="text-ink font-medium">{product.lock_period_days || 30} Days</span>
                </div>
              )}
              {isFixed && product.early_withdrawal_penalty_rate > 0 && (
                <div className="flex justify-between">
                  <span className="text-ink-soft">Early Exit Fee</span>
                  <span className="text-clay font-medium">
                    {product.early_withdrawal_penalty_rate}% penalty
                  </span>
                </div>
              )}
            </div>

            {/* Target Amount (Optional) */}
            {isFixed && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink block">
                  Savings Target (Optional)
                </label>
                <input
                  type="number"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  placeholder="e.g. 100000"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-paper text-sm text-ink outline-none focus:border-indigo"
                />
              </div>
            )}

            {/* Initial Deposit */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink block">
                Initial Deposit (Min {fmtNGN(minOpening)})
              </label>
              <input
                type="number"
                value={initialDeposit}
                onChange={(e) => setInitialDeposit(e.target.value)}
                placeholder={String(minOpening)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-paper text-sm text-ink outline-none focus:border-indigo"
              />
              <p className="text-[11px] text-ink-soft">
                Funds will be deducted from your main wallet balance upon confirmation.
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-xl bg-clay-light/80 border border-clay/20 flex items-start gap-2 text-clay text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button variant="ghost" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button variant="secondary" onClick={handleSubmit} isLoading={isLoading}>
                Confirm & Open Account
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Pot Icon Definitions ───────────────────────────────────
const POT_ICONS = [
  { key: "piggybank", label: "Piggy Bank", Icon: PiggyBank },
  { key: "sprout", label: "Seeds", Icon: Sprout },
  { key: "tractor", label: "Tractor", Icon: Tractor },
  { key: "home", label: "Home", Icon: Home },
  { key: "wrench", label: "Equipment", Icon: Wrench },
  { key: "graduation", label: "Education", Icon: GraduationCap },
  { key: "heart", label: "Family", Icon: Heart },
  { key: "shopping", label: "Shopping", Icon: ShoppingBag },
];

const POT_COLORS = [
  { key: "indigo", hex: "#6366F1", label: "Indigo" },
  { key: "loam", hex: "#10B981", label: "Green" },
  { key: "ochre", hex: "#F59E0B", label: "Amber" },
  { key: "rose", hex: "#EC4899", label: "Rose" },
  { key: "sky", hex: "#0EA5E9", label: "Sky" },
  { key: "violet", hex: "#8B5CF6", label: "Violet" },
];

function getPotIcon(iconKey?: string | null) {
  const found = POT_ICONS.find((i) => i.key === iconKey);
  if (found) return <found.Icon className="w-5 h-5" strokeWidth={1.8} />;
  return <PiggyBank className="w-5 h-5" strokeWidth={1.8} />;
}

// ─── Create Pot Dialog ───────────────────────────────────
function CreatePotDialog({
  isOpen,
  onClose,
  onCreate,
  isLoading,
  error,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: {
    pot_name: string;
    pot_icon?: string;
    pot_color?: string;
    lock_type: "flexible" | "locked";
    lock_until_date?: string | null;
    target_amount?: number;
    initial_deposit?: number;
  }) => void;
  isLoading: boolean;
  error?: string;
}) {
  const [potName, setPotName] = useState("");
  const [potIcon, setPotIcon] = useState("piggybank");
  const [potColor, setPotColor] = useState("indigo");
  const [lockType, setLockType] = useState<"flexible" | "locked">("flexible");
  const [lockDate, setLockDate] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [initialDeposit, setInitialDeposit] = useState("");

  const handleSubmit = () => {
    onCreate({
      pot_name: potName,
      pot_icon: potIcon,
      pot_color: potColor,
      lock_type: lockType,
      lock_until_date: lockType === "locked" ? lockDate : null,
      target_amount: targetAmount ? parseFloat(targetAmount) : undefined,
      initial_deposit: initialDeposit ? parseFloat(initialDeposit) : undefined,
    });
  };

  const canSubmit = potName.trim().length >= 2 && (lockType === "flexible" || (lockDate && new Date(lockDate) > new Date()));

  // Estimated rate based on lock duration
  const estimatedRate = (() => {
    if (lockType !== "locked" || !lockDate) return 4;
    const days = Math.max(1, Math.ceil((new Date(lockDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    if (days >= 365) return 16;
    if (days >= 180) return 14;
    if (days >= 90) return 12;
    if (days >= 30) return 8;
    return 6;
  })();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Savings Pot</DialogTitle>
          <DialogDescription>
            Set aside money for a specific goal. Create as many as you need.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Pot Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink block">Pot Name</label>
            <input
              type="text"
              value={potName}
              onChange={(e) => setPotName(e.target.value.slice(0, 40))}
              placeholder="e.g. Fertilizer Fund"
              className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-paper text-sm text-ink outline-none focus:border-indigo"
              maxLength={40}
            />
          </div>

          {/* Icon Picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink block">Choose an Icon</label>
            <div className="flex flex-wrap gap-2">
              {POT_ICONS.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPotIcon(key)}
                  className={`p-2.5 rounded-xl border-2 transition ${
                    potIcon === key
                      ? "border-indigo bg-indigo/5"
                      : "border-line bg-parchment hover:bg-track"
                  }`}
                  title={label}
                >
                  <Icon className="w-5 h-5 text-ink" strokeWidth={1.8} />
                </button>
              ))}
            </div>
          </div>

          {/* Color Picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink block">Color</label>
            <div className="flex flex-wrap gap-2">
              {POT_COLORS.map(({ key, hex, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPotColor(key)}
                  className={`w-8 h-8 rounded-full border-2 transition ${
                    potColor === key ? "border-ink scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: hex }}
                  title={label}
                />
              ))}
            </div>
          </div>

          {/* Lock Type Toggle */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink block">Savings Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLockType("flexible")}
                className={`p-3 rounded-xl border-2 text-left transition ${
                  lockType === "flexible"
                    ? "border-loam bg-loam-light/30"
                    : "border-line bg-parchment"
                }`}
              >
                <PiggyBank className="w-4 h-4 text-loam mb-1" />
                <p className="text-sm font-semibold text-ink">Flexible</p>
                <p className="text-[11px] text-ink-soft">Withdraw anytime • 4% p.a.</p>
              </button>
              <button
                type="button"
                onClick={() => setLockType("locked")}
                className={`p-3 rounded-xl border-2 text-left transition ${
                  lockType === "locked"
                    ? "border-indigo bg-indigo/5"
                    : "border-line bg-parchment"
                }`}
              >
                <Lock className="w-4 h-4 text-indigo mb-1" />
                <p className="text-sm font-semibold text-ink">Locked</p>
                <p className="text-[11px] text-ink-soft">Higher rate • Pick unlock date</p>
              </button>
            </div>
          </div>

          {/* Lock Date (if locked) */}
          {lockType === "locked" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              className="space-y-1.5 overflow-hidden"
            >
              <label className="text-xs font-semibold text-ink block">Unlock Date</label>
              <input
                type="date"
                value={lockDate}
                onChange={(e) => setLockDate(e.target.value)}
                min={new Date(Date.now() + 86400000).toISOString().split("T")[0]}
                className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-paper text-sm text-ink outline-none focus:border-indigo"
              />
              {lockDate && (
                <div className="flex items-center gap-2 text-xs text-loam">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Estimated rate: {estimatedRate}% p.a. — longer lock = higher rate</span>
                </div>
              )}
            </motion.div>
          )}

          {/* Target Amount (Optional) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink block">Target Amount (Optional)</label>
            <input
              type="number"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              placeholder="e.g. 100000"
              className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-paper text-sm text-ink outline-none focus:border-indigo"
            />
            <p className="text-[11px] text-ink-soft">Set a goal to track your progress.</p>
          </div>

          {/* Initial Deposit */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink block">
              Initial Deposit (Min ₦100)
            </label>
            <input
              type="number"
              value={initialDeposit}
              onChange={(e) => setInitialDeposit(e.target.value)}
              placeholder="0"
              className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-paper text-sm text-ink outline-none focus:border-indigo"
            />
            <p className="text-[11px] text-ink-soft">
              Funds will be moved from your Wallet to this pot.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 text-red-600 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button variant="ghost" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              isLoading={isLoading}
              disabled={!canSubmit}
            >
              Create Pot
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
