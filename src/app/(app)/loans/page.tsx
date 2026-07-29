"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LoadingState, Button,
} from "@/components/yield";
import {
} from "lucide-react";
import Link from "next/link";

// ════════════════════════════════════════════════════════════
// Mobile Loans — matches the approved mockup exactly:
//   - Title: product name (e.g. "Agricultural Loan")
//   - Eligibility card (indigo gradient): max borrow + factors
//   - Amount card: "How much do you need?" with slider
//   - Repayment schedule preview: date + amount (mono) + pill
//   - "Continue application" (ochre — single accent)
// ════════════════════════════════════════════════════════════

interface LoanProduct {
  id: string;
  product_code: string;
  product_name: string;
  interest_rate: number;
  interest_type: string;
  min_amount: number;
  max_amount: number;
  term_months: number;
  min_kyc_level: number;
}

interface Loan {
  id: string;
  status: string;
  principal_amount: number;
  outstanding_balance: number;
  next_due_date: string;
  product: { product_name: string; interest_rate: number };
  schedule?: Array<{ due_date: string; amount: number; status: string }>;
}

export default function LoansPage() {
  const [activeTab, setActiveTab] = useState<"loans" | "products">("products");

  const { data: loansData, isLoading: loansLoading } = useQuery<{ loans: Loan[] }>({
    queryKey: ["loans"],
    queryFn: async () => {
      const res = await fetch("/api/loans");
      if (!res.ok) return { loans: [] };
      return res.json();
    },
  });

  const { data: productsData, isLoading: prodsLoading } = useQuery<{ products: LoanProduct[] }>({
    queryKey: ["loan-products"],
    queryFn: async () => {
      const res = await fetch("/api/loans/products");
      if (!res.ok) return { products: [] };
      return res.json();
    },
  });

  const loans = loansData?.loans || [];
  const products = productsData?.products || [];

  return (
    <div className="space-y-4">
      <h1 className="font-display text-[18px] font-medium text-ink">Loans</h1>

      {/* ─── Tabs ─── */}
      <div className="flex gap-1 bg-parchment rounded-xl p-1">
        <TabButton active={activeTab === "loans"} onClick={() => setActiveTab("loans")}>
          My Loans
        </TabButton>
        <TabButton active={activeTab === "products"} onClick={() => setActiveTab("products")}>
          Eligibility
        </TabButton>
      </div>

      {/* ─── My Loans tab ─── */}
      {activeTab === "loans" && (
        <>
          {loansLoading ? (
            <LoadingState message="Loading your loans…" />
          ) : loans.length === 0 ? (
            <div className="border border-line rounded-2xl p-8 text-center">
              <p className="text-sm text-ink-soft mb-3">No active loans</p>
              <Button size="sm" onClick={() => setActiveTab("products")}>
                Check your eligibility
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {loans.map((loan) => (
                <LoanCard key={loan.id} loan={loan} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── Eligibility / Products tab ─── */}
      {activeTab === "products" && (
        <>
          {prodsLoading ? (
            <LoadingState message="Loading products…" />
          ) : products.length === 0 ? (
            <div className="border border-line rounded-2xl p-8 text-center">
              <p className="text-sm text-ink-soft">No loan products available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {products.map((product) => (
                <ProductEligibility key={product.id} product={product} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Product eligibility card (matches mockup's loan screen) ───
function ProductEligibility({ product }: { product: LoanProduct }) {
  const [amount, setAmount] = useState(product.min_amount || 20000);
  const maxBorrow = product.max_amount || 375000;
  const fmtNGN = (v: number) => `₦${v.toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;

  // Calculate monthly repayment (simple flat rate for preview)
  const monthlyPayment = product.interest_type === "flat"
    ? Math.round((amount + (amount * product.interest_rate / 100 * product.term_months / 12)) / product.term_months)
    : Math.round(amount / product.term_months * (1 + product.interest_rate / 100 / 12));

  // Generate schedule preview
  const schedule = Array.from({ length: Math.min(product.term_months, 3) }, (_, i) => {
    const dueDate = new Date();
    dueDate.setMonth(dueDate.getMonth() + i + 1);
    return {
      dueDate: dueDate.toLocaleDateString("en-NG", { month: "short", year: "numeric" }),
      amount: monthlyPayment,
    };
  });

  return (
    <div className="space-y-4">
      {/* ─── Eligibility card (indigo gradient) ─── */}
      <div className="bg-gradient-to-br from-indigo to-[#0F4A13] rounded-2xl p-[18px] text-white">
        <p className="text-xs text-white/60 mb-1">You're eligible to borrow up to</p>
        <p className="font-mono text-[26px] font-medium mb-3">{fmtNGN(maxBorrow)}</p>
        <div className="space-y-0">
          <FactorRow label="Interest rate" value={`${product.interest_rate}% ${product.interest_type === "flat" ? "flat" : "reducing"}`} />
          <FactorRow label="Term" value={`${product.term_months} months`} />
          <FactorRow label="Min amount" value={fmtNGN(product.min_amount || 20000)} />
          {product.min_kyc_level > 0 && <FactorRow label="KYC required" value={`Tier ${product.min_kyc_level}`} />}
        </div>
      </div>

      {/* ─── Amount card ─── */}
      <div className="border border-line rounded-2xl p-4 bg-paper">
        <p className="text-xs text-ink-soft mb-1.5">How much do you need?</p>
        <p className="font-mono text-2xl text-center text-ink my-2">{fmtNGN(amount)}</p>
        <input
          type="range"
          min={product.min_amount || 20000}
          max={maxBorrow}
          step={5000}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="w-full accent-indigo"
        />
        <p className="text-[11px] text-ink-soft text-center mt-1.5">
          {product.term_months}-month term · {product.interest_rate}% {product.interest_type === "flat" ? "flat" : "reducing"} rate
        </p>
      </div>

      {/* ─── Repayment schedule preview ─── */}
      <div>
        <p className="text-xs text-ink-soft mb-2">Repayment schedule preview</p>
        <div className="px-1">
          {schedule.map((item, i) => (
            <div key={i} className="flex justify-between items-center py-2 border-b border-line text-xs last:border-0">
              <span className="text-ink">{item.dueDate}</span>
              <span className="font-mono text-ink">{fmtNGN(item.amount)}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-ochre-light text-ink/60">
                Upcoming
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Apply button (ochre — single accent) ─── */}
      <Link href="/loans" className="block bg-ochre text-ink text-center font-medium text-[13.5px] py-3 rounded-[14px]">
        Continue application
      </Link>
    </div>
  );
}

// ─── Factor row in eligibility card ───
function FactorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[11.5px] py-1.5 border-t border-white/15 first:border-t-0">
      <span className="text-white/60">{label}</span>
      <span className="font-mono text-white/80">{value}</span>
    </div>
  );
}

// ─── Loan card for active loans ───
function LoanCard({ loan }: { loan: Loan }) {
  const fmtNGN = (v: number) => `₦${v.toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;
  const statusColor: Record<string, string> = {
    active: "bg-loam-light text-loam",
    disbursed: "bg-loam-light text-loam",
    overdue: "bg-clay-light text-clay",
    pending: "bg-ochre-light text-ink/60",
  };

  return (
    <div className="border border-line rounded-2xl p-4 bg-paper">
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="text-sm font-medium text-ink">{loan.product?.product_name || "Loan"}</p>
          <p className="text-xs text-ink-soft mt-0.5">
            {loan.status === "pending" ? "Awaiting review" : `Next due: ${loan.next_due_date ? new Date(loan.next_due_date).toLocaleDateString("en-NG", { day: "numeric", month: "short" }) : "—"}`}
          </p>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusColor[loan.status] || "bg-parchment text-ink-soft"}`}>
          {loan.status}
        </span>
      </div>
      <p className="font-mono text-lg text-ink">{fmtNGN(loan.outstanding_balance)}</p>
      <p className="text-xs text-ink-soft">outstanding</p>
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
