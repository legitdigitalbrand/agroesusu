"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  StatusBadge,
  Skeleton,
} from "@/components/yield";
import {
  ArrowLeft,
  Calendar,
  Download,
  CreditCard,
  AlertCircle,
  Check,
  FileText,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface Loan {
  id: string;
  loan_number: string;
  status: string;
  requested_amount: number;
  approved_amount: number | null;
  principal_amount: number | null;
  outstanding_balance: number;
  total_interest: number;
  total_payable: number;
  interest_rate: number;
  interest_method: string;
  term_months: number;
  total_repaid: number;
  next_due_date: string | null;
  last_repayment_at: string | null;
  disbursed_at: string | null;
  created_at: string;
}

interface Installment {
  id: string;
  installment_number: number;
  due_date: string;
  principal_amount: number;
  interest_amount: number;
  total_amount: number;
  amount_paid: number;
  status: string;
  paid_at: string | null;
  days_late: number;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const fmtNGN = (v: number) => `₦${(v || 0).toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════
export default function LoanDetailsPage({ params }: { params: { id: string } }) {
  const queryClient = useQueryClient();
  const [repayError, setRepayError] = useState<string | null>(null);
  const [repaySuccess, setRepaySuccess] = useState(false);

  const { data, isLoading, error } = useQuery<{ loan: Loan; schedule: Installment[] }>({
    queryKey: ["loan-details", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/loans/${params.id}`);
      if (!res.ok) throw new Error("Failed to load loan details");
      return res.json();
    },
  });

  const repayMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/loans/${params.id}/repay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: data?.loan.outstanding_balance }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Repayment failed");
      return result;
    },
    onSuccess: () => {
      setRepaySuccess(true);
      queryClient.invalidateQueries({ queryKey: ["loan-details", params.id] });
      queryClient.invalidateQueries({ queryKey: ["loans"] });
    },
    onError: (err: Error) => setRepayError(err.message),
  });

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton variant="text" className="w-20 h-6" />
        <Skeleton variant="rectangular" className="h-48 rounded-2xl" />
        <Skeleton variant="rectangular" className="h-64 rounded-2xl" />
      </div>
    );
  }

  // ── Error ──
  if (error || !data) {
    return (
      <div className="max-w-md mx-auto py-12 text-center">
        <AlertCircle className="w-12 h-12 text-clay mx-auto mb-4" />
        <p className="text-sm font-semibold text-ink mb-1">Couldn&apos;t load this loan</p>
        <p className="text-sm text-ink-soft mb-6">Please try again later.</p>
        <Link href="/loans">
          <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo text-white font-semibold text-sm hover:bg-indigo-deep transition">
            Back to Loans
          </span>
        </Link>
      </div>
    );
  }

  const { loan, schedule } = data;

  // Derived values
  const loanAmount = loan.approved_amount || loan.principal_amount || loan.requested_amount;
  const progressPct = loan.total_payable > 0
    ? Math.min(100, Math.round((loan.total_repaid / loan.total_payable) * 100))
    : 0;
  const remainingInstallments = schedule.filter((s) => s.status !== "paid").length;
  const canRepay = ["active", "disbursed", "overdue"].includes(loan.status);

  // Repayment success state
  if (repaySuccess) {
    return (
      <div className="max-w-md mx-auto py-12 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-loam-light flex items-center justify-center mx-auto">
          <Check className="w-8 h-8 text-loam" strokeWidth={2} />
        </div>
        <h1 className="font-display font-bold text-xl text-ink">Repayment Successful</h1>
        <p className="text-sm text-ink-soft">Your repayment has been processed.</p>
        <Link href="/loans">
          <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-ochre text-indigo-deep font-semibold text-sm hover:opacity-90 transition">
            Back to Loans
          </span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back link */}
      <Link href="/loans" className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink transition">
        <ArrowLeft className="w-4 h-4" /> Back to Loans
      </Link>

      {/* ═══ STATUS HEADER ═══ */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-xl text-ink">{loan.loan_number}</h1>
          <p className="text-sm text-ink-soft mt-0.5">{formatDate(loan.created_at)}</p>
        </div>
        <StatusBadge status={loan.status} size="md" />
      </div>

      {/* ═══ LOAN SUMMARY CARD ═══ */}
      <Card variant="dark" padding="lg" className="relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-64 h-64 rounded-full bg-ochre/5 pointer-events-none" />
        <div className="relative z-10 space-y-5">
          {/* Loan amount */}
          <div>
            <p className="text-xs uppercase tracking-wider text-white/60 mb-1">Loan Amount</p>
            <p className="text-3xl font-bold font-mono text-white">{fmtNGN(loanAmount)}</p>
          </div>

          {/* Outstanding + progress */}
          {canRepay && (
            <div>
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-xs text-white/60">Outstanding Balance</span>
                <span className="font-mono font-semibold text-white text-sm">{fmtNGN(loan.outstanding_balance)}</span>
              </div>
              {/* Progress bar */}
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-ochre rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-xs text-white/60 mt-1.5">{progressPct}% repaid</p>
            </div>
          )}
        </div>
      </Card>

      {/* ═══ LOAN DETAILS GRID ═══ */}
      <div className="grid grid-cols-2 gap-4">
        <Card variant="elevated" padding="md">
          <p className="text-xs text-ink-soft mb-1">Interest Rate</p>
          <p className="text-lg font-semibold font-mono text-ink">{loan.interest_rate}%</p>
          <p className="text-xs text-ink-soft mt-0.5 capitalize">{loan.interest_method?.replace("_", " ")}</p>
        </Card>
        <Card variant="elevated" padding="md">
          <p className="text-xs text-ink-soft mb-1">Term</p>
          <p className="text-lg font-semibold text-ink">{loan.term_months} months</p>
          <p className="text-xs text-ink-soft mt-0.5">{remainingInstallments} remaining</p>
        </Card>
        <Card variant="elevated" padding="md">
          <p className="text-xs text-ink-soft mb-1">Total Repayment</p>
          <p className="text-lg font-semibold font-mono text-ink">{fmtNGN(loan.total_payable)}</p>
          <p className="text-xs text-ink-soft mt-0.5">Including {fmtNGN(loan.total_interest)} interest</p>
        </Card>
        <Card variant="elevated" padding="md">
          <p className="text-xs text-ink-soft mb-1">Total Paid</p>
          <p className="text-lg font-semibold font-mono text-loam">{fmtNGN(loan.total_repaid)}</p>
          <p className="text-xs text-ink-soft mt-0.5">
            {loan.last_repayment_at ? `Last paid ${formatDate(loan.last_repayment_at)}` : "No payments yet"}
          </p>
        </Card>
      </div>

      {/* ═══ NEXT REPAYMENT ═══ */}
      {canRepay && loan.next_due_date && (
        <Card variant="elevated" padding="md" className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-ochre-light flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-indigo-deep" strokeWidth={1.8} />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Next Repayment</p>
              <p className="text-xs text-ink-soft">{formatDate(loan.next_due_date)}</p>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<CreditCard className="w-4 h-4" />}
            disabled={repayMutation.isPending}
            isLoading={repayMutation.isPending}
            onClick={() => repayMutation.mutate()}
          >
            Make Repayment
          </Button>
        </Card>
      )}

      {/* Error */}
      {repayError && (
        <div className="bg-clay-light rounded-xl p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-clay mt-0.5 flex-shrink-0" />
          <p className="text-xs text-clay">{repayError}</p>
        </div>
      )}

      {/* ═══ REPAYMENT SCHEDULE ═══ */}
      {schedule.length > 0 && (
        <Card variant="elevated" padding="lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Repayment Schedule</CardTitle>
            <CardDescription>Your installment breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-line/60">
                    <th className="py-2.5 pr-3 text-xs font-semibold text-ink-soft uppercase tracking-wider">#</th>
                    <th className="py-2.5 pr-3 text-xs font-semibold text-ink-soft uppercase tracking-wider">Date</th>
                    <th className="py-2.5 pr-3 text-xs font-semibold text-ink-soft uppercase tracking-wider hidden sm:table-cell">Principal</th>
                    <th className="py-2.5 pr-3 text-xs font-semibold text-ink-soft uppercase tracking-wider hidden sm:table-cell">Interest</th>
                    <th className="py-2.5 pr-3 text-xs font-semibold text-ink-soft uppercase tracking-wider text-right">Total</th>
                    <th className="py-2.5 pl-3 text-xs font-semibold text-ink-soft uppercase tracking-wider text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {schedule.map((inst) => (
                    <tr key={inst.id} className="hover:bg-parchment/30 transition-colors">
                      <td className="py-3 pr-3 text-xs text-ink-soft">{inst.installment_number}</td>
                      <td className="py-3 pr-3 text-xs text-ink-soft whitespace-nowrap">{formatDate(inst.due_date)}</td>
                      <td className="py-3 pr-3 text-xs font-mono text-ink hidden sm:table-cell">{fmtNGN(inst.principal_amount)}</td>
                      <td className="py-3 pr-3 text-xs font-mono text-clay hidden sm:table-cell">{fmtNGN(inst.interest_amount)}</td>
                      <td className="py-3 pr-3 text-xs font-mono font-semibold text-ink text-right whitespace-nowrap">{fmtNGN(inst.total_amount)}</td>
                      <td className="py-3 pl-3 text-right">
                        <StatusBadge
                          status={inst.status}
                          size="sm"
                          showDot={true}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ AGREEMENT ═══ */}
      {loan.status === "approved" && (
        <Card variant="elevated" padding="md" className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-parchment flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-ink-soft" strokeWidth={1.8} />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Loan Agreement</p>
              <p className="text-xs text-ink-soft">Accept terms to proceed with disbursement</p>
            </div>
          </div>
          <Button variant="outline" size="sm" leftIcon={<Download className="w-4 h-4" />}>
            Download
          </Button>
        </Card>
      )}
    </div>
  );
}
