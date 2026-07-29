"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LoadingState, ErrorState, Button, } from "@/components/yield";
import { Check, X, AlertTriangle, Loader2, ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/format";

interface PendingLoan {
  id: string;
  loan_number: string;
  status: string;
  requested_amount: number;
  approved_amount: number | null;
  interest_rate: number;
  term_months: number;
  applied_at: string;
  customer_name: string;
  customer_phone: string;
  product_name: string;
  product_code: string;
  eligibility_decision: string | null;
  credit_score: number | null;
  max_eligible_amount: number | null;
  savings_balance: number | null;
}

export default function AdminLoanReviewPage() {
  const [selectedLoan, setSelectedLoan] = useState<PendingLoan | null>(null);

  const { data, isLoading, error, refetch } = useQuery<{ loans: PendingLoan[] }>({
    queryKey: ["admin-pending-loans"],
    queryFn: async () => {
      const res = await fetch("/api/loans?status=pending");
      if (!res.ok) throw new Error("Failed to load loans");
      return res.json();
    },
    staleTime: 30 * 1000,
  });

  const loans = data?.loans || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-ink">Loan Review Queue</h1>
        <p className="text-sm text-ink-soft mt-0.5">Review, approve, deny, or override automated eligibility decisions</p>
      </div>

      {isLoading ? (
        <LoadingState message="Loading pending loans…" />
      ) : error ? (
        <ErrorState message="Couldn't load loans" onRetry={() => refetch()} />
      ) : loans.length === 0 ? (
        <div className="ys-card text-center py-12">
          <Check className="h-8 w-8 text-loam mx-auto" />
          <p className="mt-3 text-sm text-ink-soft">No pending loans to review.</p>
        </div>
      ) : (
        <div className="ys-card overflow-x-auto">
          <div className="overflow-x-auto"><table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-track/60">
                <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Loan #</th>
                <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Applicant</th>
                <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Product</th>
                <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Amount</th>
                <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Eligibility</th>
                <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Applied</th>
                <th className="text-right text-xs font-medium text-ink-soft uppercase tracking-wide pb-3"></th>
              </tr>
            </thead>
            <tbody>
              {loans.map((loan) => (
                <tr
                  key={loan.id}
                  onClick={() => setSelectedLoan(loan)}
                  className="border-b border-track/30 last:border-0 hover:bg-parchment/50 cursor-pointer transition"
                >
                  <td className="py-3 pr-4 font-mono text-sm text-ink">{loan.loan_number}</td>
                  <td className="py-3 pr-4">
                    <p className="text-sm text-ink font-medium">{loan.customer_name}</p>
                    <p className="text-xs text-ink-soft">{loan.customer_phone}</p>
                  </td>
                  <td className="py-3 pr-4 text-sm text-ink">{loan.product_name}</td>
                  <td className="py-3 pr-4 font-mono text-sm text-ink">
                    {formatMoney(loan.requested_amount)}
                  </td>
                  <td className="py-3 pr-4">
                    <EligibilityBadge decision={loan.eligibility_decision} />
                  </td>
                  <td className="py-3 pr-4 text-xs text-ink-soft">{formatDate(loan.applied_at)}</td>
                  <td className="py-3 text-right">
                    <ChevronRight className="h-4 w-4 text-ink-soft inline" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {/* Review modal */}
      {selectedLoan && (
        <ReviewModal
          loan={selectedLoan}
          onClose={() => setSelectedLoan(null)}
        />
      )}
    </div>
  );
}

function ReviewModal({ loan, onClose }: { loan: PendingLoan; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [action, setAction] = useState<("approve" | "deny" | "override_approve" | "override_deny") | null>(null);
  const [reason, setReason] = useState("");
  const [approvedAmount, setApprovedAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOverride = action?.startsWith("override_");

  const handleSubmit = async () => {
    if (!action) return;
    if (!reason || reason.trim().length < 5) {
      setError("A reason of at least 5 characters is required for every review action. This is permanently logged.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const body: Record<string, unknown> = { action, reason };
    if ((action === "approve" || action === "override_approve") && approvedAmount) {
      body.approved_amount = parseFloat(approvedAmount);
    }

    const res = await fetch(`/api/admin/loans/${loan.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      setError(err.error || "Failed to submit review");
      setSubmitting(false);
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["admin-pending-loans"] });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-paper rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl text-ink">Review Loan</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink">✕</button>
        </div>

        {/* Loan details */}
        <div className="space-y-3 mb-6">
          <DetailRow label="Loan Number" value={loan.loan_number} mono />
          <DetailRow label="Applicant" value={loan.customer_name} />
          <DetailRow label="Product" value={loan.product_name} />
          <DetailRow label="Requested Amount" value={formatMoney(loan.requested_amount)} mono />
          <DetailRow label="Interest Rate" value={`${loan.interest_rate}%`} mono />
          <DetailRow label="Term" value={`${loan.term_months} months`} mono />
          {loan.credit_score && <DetailRow label="Credit Score" value={String(loan.credit_score)} mono />}
          {loan.max_eligible_amount !== null && (
            <DetailRow label="Max Eligible" value={formatMoney(loan.max_eligible_amount)} mono />
          )}
          {loan.savings_balance !== null && (
            <DetailRow label="Savings Balance" value={formatMoney(loan.savings_balance)} mono />
          )}
          <DetailRow
            label="Automated Decision"
            value={loan.eligibility_decision || "No decision"}
          />
        </div>

        {/* Action selection */}
        {!action && (
          <div className="space-y-3">
            <p className="ys-label">Select an action</p>
            {loan.eligibility_decision === "approved" ? (
              <>
                <ActionButton icon={Check} label="Approve" color="loam" onClick={() => setAction("approve")} />
                <ActionButton icon={X} label="Deny" color="clay" onClick={() => setAction("deny")} />
                <ActionButton icon={AlertTriangle} label="Override — Deny (override automated approval)" color="clay" onClick={() => setAction("override_deny")} />
              </>
            ) : loan.eligibility_decision === "denied" ? (
              <>
                <ActionButton icon={AlertTriangle} label="Override — Approve (override automated denial)" color="loam" onClick={() => setAction("override_approve")} />
                <ActionButton icon={X} label="Confirm Denial" color="clay" onClick={() => setAction("deny")} />
              </>
            ) : (
              <>
                <ActionButton icon={Check} label="Approve" color="loam" onClick={() => setAction("approve")} />
                <ActionButton icon={X} label="Deny" color="clay" onClick={() => setAction("deny")} />
              </>
            )}
          </div>
        )}

        {/* Reason + submit */}
        {action && (
          <div className="space-y-4">
            {/* Approved amount for approvals */}
            {(action === "approve" || action === "override_approve") && (
              <div>
                <label className="ys-label block mb-1.5">Approved Amount (₦)</label>
                <input
                  type="number"
                  value={approvedAmount}
                  onChange={(e) => setApprovedAmount(e.target.value)}
                  className="ys-input"
                  placeholder={String(loan.requested_amount)}
                />
                <p className="text-xs text-ink-soft mt-1">Leave blank to approve full requested amount</p>
              </div>
            )}

            {/* MANDATORY reason field */}
            <div>
              <label className="ys-label block mb-1.5">
                Reason <span className="text-clay">*</span>
                <span className="ml-2 text-clay normal-case tracking-normal">Mandatory — permanently logged to audit trail</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="ys-input min-h-[100px]"
                placeholder="Explain your decision. This will be stored permanently in the audit log."
                required
                minLength={5}
              />
              <p className="text-xs text-ink-soft mt-1">{reason.length}/5 characters minimum</p>
            </div>

            {isOverride && (
              <div className="flex items-start gap-2 bg-clay/5 rounded-lg p-3">
                <AlertTriangle className="h-4 w-4 text-clay flex-shrink-0 mt-0.5" />
                <p className="text-xs text-clay">
                  You are overriding the automated eligibility decision. This override and your reason will be
                  permanently recorded in both the audit log and the admin action log.
                </p>
              </div>
            )}

            {error && <p className="text-sm text-clay bg-clay/5 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => { setAction(null); setReason(""); setError(null); }} className="flex-1">
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={submitting || reason.trim().length < 5} className="flex-1">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : `Submit ${action.replace(/_/g, " ")}`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-ink-soft">{label}</span>
      <span className={mono ? "font-mono text-ink" : "text-ink"}>{value}</span>
    </div>
  );
}

function ActionButton({ icon: Icon, label, color, onClick }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: "loam" | "clay";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg border transition hover:bg-parchment/50 ${
        color === "loam" ? "border-loam/30 text-loam" : "border-clay/30 text-clay"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

function EligibilityBadge({ decision }: { decision: string | null }) {
  if (!decision) return <span className="text-xs text-ink-soft">—</span>;
  const isApproved = decision === "approved";
  return (
    <span className={`text-xs rounded-full px-2.5 py-1 ${
      isApproved ? "bg-loam/10 text-loam" : "bg-clay/10 text-clay"
    }`}>
      {isApproved ? "Auto-approved" : "Auto-denied"}
    </span>
  );
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency", currency: "NGN",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount || 0);
}
