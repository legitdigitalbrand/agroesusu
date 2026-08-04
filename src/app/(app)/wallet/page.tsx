"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useMe } from "@/hooks/use-me";
import { formatRelativeTime } from "@/lib/format";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  MoneyText,
  StatusBadge,
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  HeadCell,
  TableCell,
  TableRowSkeleton,
  EmptyState,
  ErrorState,
  LoadingState,
  ScreenHeader,
  Skeleton,
} from "@/components/yield";
import {
  Plus,
  Send,
  ArrowUpRight,
  ArrowDownLeft,
  Copy,
  Check,
  Eye,
  EyeOff,
  Wallet,
  Building2,
  Info,
  RefreshCw,
  ShieldCheck,
  ArrowRight,
  Clock,
  AlertCircle,
  Sparkles,
} from "lucide-react";

interface WalletTransaction {
  id: string;
  transaction_type: string;
  amount: number;
  direction: "credit" | "debit";
  status: string;
  description: string | null;
  reference: string;
  created_at: string;
}

interface FundingDetails {
  provisioned: boolean;
  account?: {
    account_number: string;
    account_name: string;
    bank_name: string;
    bank_code?: string;
  };
  message?: string;
  kyc_level?: string;
  wallet_id?: string;
  instructions?: string;
}

const fmtNGN = (v: number) => {
  const formatted = new Intl.NumberFormat("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Math.abs(v || 0));
  return `${(v || 0) < 0 ? "-" : ""}₦${formatted}`;
};

export default function WalletPage() {
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [copied, setCopied] = useState(false);

  const { data: me, isLoading: meLoading, error: meError, refetch: refetchMe } = useMe();
  const walletId = me?.wallet?.id;

  const {
    data: txData,
    isLoading: txLoading,
    error: txError,
    refetch: refetchTx,
  } = useQuery<{ transactions: WalletTransaction[] }>({
    queryKey: ["wallet-transactions", walletId],
    queryFn: async () => {
      const res = await fetch(`/api/wallets/${walletId}/transactions`);
      if (!res.ok) throw new Error("Failed to load transactions");
      return res.json();
    },
    enabled: !!walletId,
  });

  const {
    data: fundingDetails,
    isLoading: fundingLoading,
    refetch: refetchFunding,
  } = useQuery<FundingDetails>({
    queryKey: ["wallet-funding-details"],
    queryFn: async () => {
      const res = await fetch("/api/wallets/funding-details");
      if (!res.ok) throw new Error("Could not load funding details");
      return res.json();
    },
  });

  if (meLoading) return <LoadingState message="Loading wallet details…" />;

  if (meError || !me) {
    return (
      <ErrorState
        message="Failed to load your profile and wallet details."
        onRetry={() => refetchMe()}
      />
    );
  }

  if (!me.wallet) {
    return (
      <EmptyState
        title="No wallet found"
        message="Your digital wallet will be created automatically when you finish setting up your profile."
        action={
          <Link href="/dashboard">
            <Button variant="primary">Go to Dashboard</Button>
          </Link>
        }
      />
    );
  }

  const wallet = me.wallet;
  const transactions = txData?.transactions || [];
  const dva = fundingDetails?.provisioned ? fundingDetails.account : null;

  const copyAccountNumber = () => {
    if (dva?.account_number) {
      navigator.clipboard.writeText(dva.account_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const hasSubStats =
    (wallet.ledger_balance || 0) > 0 ||
    (wallet.pending_balance || 0) > 0 ||
    (wallet.reserved_balance || 0) > 0;

  return (
    <div className="space-y-6">
      <ScreenHeader
        title="Wallet"
        subtitle="Manage your Agriqcap digital balance, account details, and transaction history."
        action={
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<RefreshCw className="w-4 h-4" />}
            onClick={() => {
              refetchMe();
              refetchTx();
              refetchFunding();
            }}
          >
            Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
        {/* Main Content Area */}
        <div className="space-y-6">
          {/* Hero Balance Card */}
          <Card variant="dark" padding="lg" className="relative overflow-hidden">
            {/* Background Decorative Rings */}
            <div className="absolute -right-10 -top-10 w-56 h-56 rounded-full bg-paper/5 pointer-events-none" />
            <div className="absolute right-12 -bottom-10 w-36 h-36 rounded-full bg-paper/5 pointer-events-none" />

            <div className="relative z-10 space-y-6">
              {/* Top Row: Label & Hide/Show */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-paper/15 backdrop-blur-xs flex items-center justify-center border border-paper/10">
                    <Wallet className="w-5 h-5 text-ochre" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white/80 uppercase tracking-wider">
                      Agriqcap Digital Wallet
                    </p>
                    <p className="text-xs text-white/60">
                      {wallet.account_number ? `Account: ${wallet.account_number}` : "Main Balance"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setBalanceVisible(!balanceVisible)}
                  className="p-2 rounded-xl bg-paper/10 hover:bg-paper/20 transition-colors text-white/80 hover:text-white"
                  aria-label="Toggle balance visibility"
                  type="button"
                >
                  {balanceVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Available Balance Display */}
              <div>
                <p className="text-xs font-medium text-white/70 uppercase tracking-widest mb-1">
                  Available Balance
                </p>
                <div className="text-3xl sm:text-4xl font-bold font-mono text-white tracking-normal leading-none">
                  {balanceVisible ? (
                    fmtNGN(wallet.available_balance)
                  ) : (
                    <span>₦ ••••••••</span>
                  )}
                </div>
              </div>

              {/* Sub-stats if non-zero */}
              {hasSubStats && (
                <div className="grid grid-cols-3 gap-3 bg-indigo-deep/40 backdrop-blur-xs border border-white/10 rounded-xl p-3.5">
                  <div>
                    <p className="text-[11px] font-medium text-white/60 uppercase tracking-wider mb-0.5">
                      Ledger
                    </p>
                    <p className="font-mono text-xs font-semibold text-white">
                      {balanceVisible ? fmtNGN(wallet.ledger_balance) : "••••"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-white/60 uppercase tracking-wider mb-0.5">
                      Pending
                    </p>
                    <p className="font-mono text-xs font-semibold text-white">
                      {balanceVisible ? fmtNGN(wallet.pending_balance) : "••••"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-white/60 uppercase tracking-wider mb-0.5">
                      Reserved
                    </p>
                    <p className="font-mono text-xs font-semibold text-white">
                      {balanceVisible ? fmtNGN(wallet.reserved_balance) : "••••"}
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons: Fund / Transfer / Withdraw */}
              <div className="grid grid-cols-3 gap-3 pt-2">
                <Link href="/wallet/deposit" className="w-full">
                  <Button
                    variant="secondary"
                    fullWidth
                    leftIcon={<Plus className="w-4 h-4 text-indigo-deep" />}
                    className="shadow-sm"
                  >
                    Fund
                  </Button>
                </Link>
                <Link href="/wallet/transfer" className="w-full">
                  <Button
                    variant="outline"
                    fullWidth
                    leftIcon={<Send className="w-4 h-4 text-white" />}
                    className="bg-paper/15 hover:bg-paper/25 text-white border-white/20 hover:border-white/40 shadow-none"
                  >
                    Transfer
                  </Button>
                </Link>
                <Link href="/wallet/withdraw" className="w-full">
                  <Button
                    variant="outline"
                    fullWidth
                    leftIcon={<ArrowUpRight className="w-4 h-4 text-white" />}
                    className="bg-paper/15 hover:bg-paper/25 text-white border-white/20 hover:border-white/40 shadow-none"
                  >
                    Withdraw
                  </Button>
                </Link>
              </div>
            </div>
          </Card>


        {/* Wallet Explainer */}
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-ochre-light/20 border border-ochre/20">
          <Info className="w-4 h-4 text-ochre shrink-0 mt-0.5" />
          <p className="text-xs text-ink-soft leading-relaxed">
            <span className="font-semibold text-ink">Your available balance.</span>{" "}
            Money here doesn't earn interest. Move money into a Savings pot to start earning.
          </p>
        </div>

          {/* Funding Section */}
          <Card variant="light" padding="md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-loam-light/80 flex items-center justify-center text-loam border border-loam/20">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Dedicated Bank Account</CardTitle>
                    <CardDescription>
                      Transfer funds directly from any bank app to instantly credit your wallet.
                    </CardDescription>
                  </div>
                </div>
                {fundingDetails?.provisioned && (
                  <StatusBadge status="active" size="sm">
                    Active DVA
                  </StatusBadge>
                )}
              </div>
            </CardHeader>

            <CardContent>
              {fundingLoading ? (
                <div className="space-y-3 py-2">
                  <Skeleton className="h-6 w-1/2" />
                  <Skeleton className="h-12 w-full rounded-xl" />
                </div>
              ) : dva ? (
                /* Provisioned Account Display */
                <div className="space-y-4">
                  <div className="bg-parchment/80 rounded-2xl p-4 border border-line space-y-3">
                    <div className="flex items-center justify-between border-b border-line/60 pb-3">
                      <span className="text-xs text-ink-soft font-medium">Account Number</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-base font-bold text-ink">
                          {dva.account_number}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={copyAccountNumber}
                          className="h-8 px-2 text-ink hover:bg-paper"
                          aria-label="Copy account number"
                        >
                          {copied ? (
                            <span className="flex items-center gap-1 text-xs text-loam font-semibold">
                              <Check className="w-3.5 h-3.5" /> Copied
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-ink-soft">
                              <Copy className="w-3.5 h-3.5" /> Copy
                            </span>
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-b border-line/60 pb-3">
                      <span className="text-xs text-ink-soft font-medium">Account Name</span>
                      <span className="text-sm font-semibold text-ink">{dva.account_name}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-ink-soft font-medium">Bank Name</span>
                      <span className="text-sm font-semibold text-ink">{dva.bank_name}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 bg-parchment/40 rounded-xl p-3 border border-line/60 text-xs text-ink-soft">
                    <Info className="w-4 h-4 text-indigo shrink-0 mt-0.5" />
                    <span>
                      Transfers to this dedicated Virtual Account are processed automatically 24/7 by Safe Haven MFB.
                    </span>
                  </div>
                </div>
              ) : fundingDetails?.message && (fundingDetails.kyc_level === "tier_1" || fundingDetails.kyc_level === "tier_2") ? (
                /* Pending Provisioning State with Timeline */
                <div className="space-y-4 py-2">
                  <div className="bg-ochre-light/50 border border-ochre/30 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-indigo-deep font-semibold text-sm">
                      <Clock className="w-4 h-4 text-ochre-dim animate-spin" />
                      Setting up your Virtual Account…
                    </div>
                    <p className="text-xs text-ink-soft leading-relaxed">
                      {fundingDetails.message}
                    </p>
                  </div>

                  {/* Provisioning Timeline */}
                  <div className="space-y-3 px-2 pt-2">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-loam text-white flex items-center justify-center text-xs font-bold">
                        ✓
                      </div>
                      <span className="text-xs font-medium text-ink">Identity Verified (KYC)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-ochre text-indigo-deep flex items-center justify-center text-xs font-bold animate-pulse">
                        2
                      </div>
                      <span className="text-xs font-medium text-ink">Provisioning Safe Haven DVA</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-track text-ink-soft flex items-center justify-center text-xs font-bold">
                        3
                      </div>
                      <span className="text-xs font-medium text-ink-soft">Account Ready for Instant Deposits</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetchFunding()}
                      leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                    >
                      Check Status
                    </Button>
                  </div>
                </div>
              ) : (
                /* Unavailable State (Requires KYC or Action) */
                <div className="bg-parchment/60 border border-line rounded-2xl p-5 text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-ochre-light flex items-center justify-center mx-auto text-indigo-deep">
                    <AlertCircle className="w-5 h-5 text-ochre-dim" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-ink">Funding Account Unavailable</h4>
                    <p className="text-xs text-ink-soft max-w-md mx-auto">
                      {fundingDetails?.message ||
                        "Please complete your profile verification to receive a dedicated funding account."}
                    </p>
                  </div>
                  <div className="pt-1">
                    <Link href="/profile">
                      <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                        Verify Identity / Profile
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Transactions Section */}
          <Card variant="light" padding="none">
            <div className="p-5 border-b border-line flex items-center justify-between">
              <div>
                <h3 className="font-display font-semibold text-base text-ink">Transaction History</h3>
                <p className="text-xs text-ink-soft">Recent credits and debits on your wallet</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchTx()}
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Refresh
              </Button>
            </div>

            {txLoading ? (
              <div className="p-4 space-y-2">
                <TableRowSkeleton columns={5} />
                <TableRowSkeleton columns={5} />
                <TableRowSkeleton columns={5} />
              </div>
            ) : txError ? (
              <div className="py-8">
                <ErrorState
                  message="Could not load your transaction history."
                  onRetry={() => refetchTx()}
                />
              </div>
            ) : transactions.length === 0 ? (
              <div className="py-8">
                <EmptyState
                  title="No transactions yet"
                  message="Your wallet transactions will appear here once you deposit, transfer, or complete savings and loan activities."
                  icon={<Wallet className="w-6 h-6 text-ink-soft" />}
                />
              </div>
            ) : (
              <TableContainer className="border-0 rounded-none shadow-none">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <HeadCell>Date</HeadCell>
                      <HeadCell>Description</HeadCell>
                      <HeadCell>Type</HeadCell>
                      <HeadCell className="text-right">Amount</HeadCell>
                      <HeadCell className="text-center">Status</HeadCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        {/* Date */}
                        <TableCell className="whitespace-nowrap text-xs text-ink-soft">
                          {formatRelativeTime(tx.created_at)}
                        </TableCell>

                        {/* Description */}
                        <TableCell className="max-w-[200px] truncate">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                                tx.direction === "credit"
                                  ? "bg-loam-light/80 text-loam"
                                  : "bg-clay-light/80 text-clay"
                              }`}
                            >
                              {tx.direction === "credit" ? (
                                <ArrowDownLeft className="w-4 h-4" />
                              ) : (
                                <ArrowUpRight className="w-4 h-4" />
                              )}
                            </div>
                            <span className="font-medium text-ink truncate text-sm">
                              {tx.description || tx.transaction_type.replace(/_/g, " ")}
                            </span>
                          </div>
                        </TableCell>

                        {/* Type */}
                        <TableCell className="whitespace-nowrap">
                          <span className="capitalize text-xs text-ink-soft font-mono">
                            {tx.transaction_type.replace(/_/g, " ")}
                          </span>
                        </TableCell>

                        {/* Amount */}
                        <TableCell className="text-right whitespace-nowrap">
                          <MoneyText amount={tx.amount} direction={tx.direction} size="sm" />
                        </TableCell>

                        {/* Status */}
                        <TableCell className="text-center whitespace-nowrap">
                          <StatusBadge status={tx.status} size="sm" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Card>
        </div>

        {/* Right Column: Explanations & Summary */}
        <div className="space-y-5">
          {/* How funding works */}
          <Card variant="flat" padding="sm">
            <CardHeader className="mb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-ochre-dim" />
                How Wallet Funding Works
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-loam-light text-loam flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  1
                </div>
                <p className="text-xs text-ink-soft leading-relaxed">
                  Transfer funds to your dedicated account number from any mobile banking app or ATM.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-loam-light text-loam flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  2
                </div>
                <p className="text-xs text-ink-soft leading-relaxed">
                  Safe Haven MFB automatically detects incoming bank transfers instantly.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-loam-light text-loam flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  3
                </div>
                <p className="text-xs text-ink-soft leading-relaxed">
                  Your wallet is credited immediately and funds can be used for savings, loans, or transfers.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Wallet Summary */}
          <Card variant="flat" padding="sm">
            <CardHeader className="mb-3">
              <CardTitle className="text-sm font-semibold">Wallet Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-line/60">
                <span className="text-ink-soft">Status</span>
                <StatusBadge status={wallet.status} size="sm" />
              </div>
              <div className="flex items-center justify-between py-1 border-b border-line/60">
                <span className="text-ink-soft">Total Transactions</span>
                <span className="font-mono font-medium text-ink">{transactions.length}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-ink-soft">Currency</span>
                <span className="font-mono font-medium text-ink">{wallet.currency || "NGN"}</span>
              </div>
            </CardContent>
          </Card>

          {/* Security Assurance */}
          <div className="bg-parchment/60 rounded-2xl p-4 border border-line text-center space-y-2">
            <ShieldCheck className="w-6 h-6 text-indigo mx-auto" />
            <p className="text-xs font-medium text-ink">Bank-Grade Protection</p>
            <p className="text-[11px] text-ink-soft leading-relaxed">
              Secured by Safe Haven MFB — Licensed by the Central Bank of Nigeria (CBN) and insured by NDIC.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
