"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  Button,
} from "@/components/yield";
import {
  ArrowLeft,
  Send,
  Building2,
  Check,
  AlertCircle,
  Loader2,
  Search,
  ShieldCheck,
  ArrowRight,
  X,
} from "lucide-react";

// ════════════════════════════════════════════════════════════
// Real Transfer Page — Send money to any Nigerian bank account
// Flow: Select Bank → Enter Account → Name Enquiry → Confirm → Transfer
// ════════════════════════════════════════════════════════════

interface Bank {
  bankCode: string;
  bankName: string;
}

interface NameEnquiryResult {
  sessionId: string;
  accountName: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
}

const fmtNGN = (v: number) => `₦${(v || 0).toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;

export default function TransferPage() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"details" | "confirm" | "result">("details");
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [narration, setNarration] = useState("");
  const [bankSearch, setBankSearch] = useState("");
  const [showBankList, setShowBankList] = useState(false);
  const [enquiryResult, setEnquiryResult] = useState<NameEnquiryResult | null>(null);
  const [transferResult, setTransferResult] = useState<{
    status: string;
    message: string;
    reference: string;
  } | null>(null);

  // Fetch banks
  const { data: banksData, isLoading: banksLoading } = useQuery<{ banks: Bank[] }>({
    queryKey: ["banks"],
    queryFn: async () => {
      const res = await fetch("/api/banks");
      if (!res.ok) throw new Error("Failed to load banks");
      return res.json();
    },
  });

  const banks = (banksData?.banks || []).filter((b) =>
    b.bankName.toLowerCase().includes(bankSearch.toLowerCase())
  );

  // Name enquiry mutation
  const enquiryMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/transfers/name-enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankCode: selectedBank!.bankCode,
          accountNumber,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Name enquiry failed");
      return data as NameEnquiryResult;
    },
    onSuccess: (data) => {
      setEnquiryResult(data);
      setStep("confirm");
    },
  });

  // Transfer mutation
  const transferMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nameEnquiryReference: enquiryResult!.sessionId,
          beneficiaryBankCode: selectedBank!.bankCode,
          beneficiaryBankName: selectedBank!.bankName,
          beneficiaryAccountNumber: accountNumber,
          beneficiaryAccountName: enquiryResult!.accountName,
          amount: parseFloat(amount),
          narration,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transfer failed");
      return data;
    },
    onSuccess: (data) => {
      setTransferResult({
        status: data.status,
        message: data.message,
        reference: data.reference,
      });
      setStep("result");
      queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
    },
  });

  const canSubmit = selectedBank && accountNumber.length === 10 && parseFloat(amount) > 0;

  // ─── Result Step ───
  if (step === "result" && transferResult) {
    const isSuccess = transferResult.status === "success";
    const isPending = transferResult.status === "pending";

    return (
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center gap-2">
          <Link href="/wallet" className="w-11 h-11 rounded-lg bg-parchment flex items-center justify-center hover:bg-track transition shrink-0">
            <ArrowLeft className="w-4 h-4 text-ink" />
          </Link>
          <h1 className="font-display font-bold text-[20px] text-ink">Transfer</h1>
        </div>

        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="bg-paper border border-line rounded-2xl p-8 text-center space-y-4"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
              isSuccess ? "bg-loam-light text-loam" : isPending ? "bg-ochre-light text-ochre" : "bg-red-50 text-red-600"
            }`}
          >
            {isSuccess ? <Check className="w-8 h-8" strokeWidth={2.5} /> : isPending ? <Loader2 className="w-8 h-8 animate-spin" /> : <AlertCircle className="w-8 h-8" strokeWidth={2} />}
          </motion.div>

          <div>
            <h2 className="font-display font-semibold text-lg text-ink">
              {isSuccess ? "Transfer Successful" : isPending ? "Transfer Processing" : "Transfer Failed"}
            </h2>
            <p className="text-sm text-ink-soft mt-1">{transferResult.message}</p>
          </div>

          {enquiryResult && (
            <div className="bg-parchment rounded-xl p-4 text-left space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-soft">Recipient</span>
                <span className="font-medium text-ink">{enquiryResult.accountName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">Amount</span>
                <span className="font-mono font-semibold text-ink">{fmtNGN(parseFloat(amount))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">Bank</span>
                <span className="text-ink">{selectedBank?.bankName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">Reference</span>
                <span className="font-mono text-xs text-ink">{transferResult.reference}</span>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Link href="/wallet" className="flex-1">
              <Button variant="primary" fullWidth>Back to Wallet</Button>
            </Link>
            <Button
              variant="outline"
              fullWidth
              onClick={() => {
                setStep("details");
                setSelectedBank(null);
                setAccountNumber("");
                setAmount("");
                setNarration("");
                setEnquiryResult(null);
                setTransferResult(null);
              }}
            >
              New Transfer
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── Confirm Step ───
  if (step === "confirm" && enquiryResult) {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStep("details")}
            className="w-11 h-11 rounded-lg bg-parchment flex items-center justify-center hover:bg-track transition shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-ink" />
          </button>
          <h1 className="font-display font-bold text-[20px] text-ink">Confirm Transfer</h1>
        </div>

        <Card variant="light" padding="lg" className="space-y-5">
          <div className="text-center pb-4 border-b border-line/60">
            <div className="w-12 h-12 rounded-full bg-loam-light flex items-center justify-center mx-auto mb-3">
              <ShieldCheck className="w-6 h-6 text-loam" />
            </div>
            <p className="text-xs text-ink-soft">Verified recipient</p>
            <p className="font-display font-semibold text-lg text-ink">{enquiryResult.accountName}</p>
            <p className="text-sm text-ink-soft font-mono">{accountNumber} • {selectedBank?.bankName}</p>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-ink-soft">Amount</span>
              <span className="font-mono font-bold text-xl text-ink">{fmtNGN(parseFloat(amount))}</span>
            </div>
            {narration && (
              <div className="flex justify-between items-center py-2 border-t border-line/40">
                <span className="text-sm text-ink-soft">Narration</span>
                <span className="text-sm text-ink">{narration}</span>
              </div>
            )}
            <div className="flex justify-between items-center py-2 border-t border-line/40">
              <span className="text-sm text-ink-soft">From</span>
              <span className="text-sm text-ink">Agriqcap Wallet</span>
            </div>
          </div>

          <div className="bg-ochre-light/30 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-ochre shrink-0 mt-0.5" />
            <p className="text-xs text-ink-soft">
              Please confirm the recipient details are correct. This transfer cannot be reversed once completed.
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              fullWidth
              onClick={() => setStep("details")}
              disabled={transferMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              fullWidth
              leftIcon={transferMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              onClick={() => transferMutation.mutate()}
              disabled={transferMutation.isPending}
            >
              {transferMutation.isPending ? "Processing…" : `Send ${fmtNGN(parseFloat(amount))}`}
            </Button>
          </div>

          {transferMutation.error && (
            <p className="text-sm text-red-600 text-center">
              {(transferMutation.error as Error).message}
            </p>
          )}
        </Card>
      </div>
    );
  }

  // ─── Details Step ───
  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/wallet" className="w-11 h-11 rounded-lg bg-parchment flex items-center justify-center hover:bg-track transition shrink-0">
          <ArrowLeft className="w-4 h-4 text-ink" />
        </Link>
        <h1 className="font-display font-bold text-[20px] text-ink">Transfer</h1>
      </div>

      <Card variant="light" padding="lg" className="space-y-5">
        <div className="flex items-center gap-3 pb-2">
          <div className="w-10 h-10 rounded-xl bg-indigo-deep/10 flex items-center justify-center">
            <Send className="w-5 h-5 text-indigo-deep" strokeWidth={1.8} />
          </div>
          <div>
            <h2 className="font-display font-semibold text-base text-ink">Send to Bank Account</h2>
            <p className="text-xs text-ink-soft">Transfer from your wallet to any Nigerian bank account.</p>
          </div>
        </div>

        {/* Bank selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Select Bank</label>
          <button
            onClick={() => setShowBankList(!showBankList)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-line bg-parchment hover:bg-track transition text-left"
            type="button"
          >
            {selectedBank ? (
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo" />
                <span className="text-sm font-medium text-ink">{selectedBank.bankName}</span>
              </div>
            ) : (
              <span className="text-sm text-ink-soft">Choose a bank…</span>
            )}
            {selectedBank && (
              <X
                className="w-4 h-4 text-ink-soft"
                onClick={(e) => { e.stopPropagation(); setSelectedBank(null); setShowBankList(false); }}
              />
            )}
          </button>

          <AnimatePresence>
            {showBankList && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="border border-line rounded-xl mt-1 bg-paper overflow-hidden">
                  <div className="p-2 border-b border-line/60">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-soft" />
                      <input
                        type="text"
                        value={bankSearch}
                        onChange={(e) => setBankSearch(e.target.value)}
                        placeholder="Search banks…"
                        className="w-full pl-9 pr-3 py-2 text-base bg-parchment rounded-lg outline-none"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    {banksLoading ? (
                      <div className="p-4 text-center text-sm text-ink-soft">Loading banks…</div>
                    ) : (
                      banks.map((bank) => (
                        <button
                          key={bank.bankCode}
                          onClick={() => {
                            setSelectedBank(bank);
                            setShowBankList(false);
                            setBankSearch("");
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-parchment transition text-left"
                          type="button"
                        >
                          <Building2 className="w-4 h-4 text-indigo shrink-0" />
                          <span className="text-sm text-ink">{bank.bankName}</span>
                          {selectedBank?.bankCode === bank.bankCode && (
                            <Check className="w-4 h-4 text-loam ml-auto" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Account Number */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Account Number</label>
          <input
            type="text"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="10-digit account number"
            className="w-full px-4 py-3 rounded-xl border border-line bg-parchment text-base font-mono outline-none focus:border-indigo transition"
            inputMode="numeric"
            maxLength={10}
          />
        </div>

        {/* Amount */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Amount (₦)</label>
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="0.00"
            className="w-full px-4 py-3 rounded-xl border border-line bg-parchment text-base font-mono outline-none focus:border-indigo transition"
            inputMode="decimal"
          />
        </div>

        {/* Narration (optional) */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Narration (optional)</label>
          <input
            type="text"
            value={narration}
            onChange={(e) => setNarration(e.target.value.slice(0, 100))}
            placeholder="What's this for?"
            className="w-full px-4 py-3 rounded-xl border border-line bg-parchment text-base outline-none focus:border-indigo transition"
            maxLength={100}
          />
        </div>

        {/* Submit */}
        <Button
          variant="primary"
          fullWidth
          size="lg"
          disabled={!canSubmit || enquiryMutation.isPending}
          leftIcon={
            enquiryMutation.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <ArrowRight className="w-4 h-4" />
          }
          onClick={() => enquiryMutation.mutate()}
        >
          {enquiryMutation.isPending ? "Verifying account…" : "Continue"}
        </Button>

        {enquiryMutation.error && (
          <p className="text-sm text-red-600 text-center">
            {(enquiryMutation.error as Error).message}
          </p>
        )}

        <p className="text-xs text-ink-soft text-center">
          We'll verify the recipient's name before you confirm. Your money is safe.
        </p>
      </Card>
    </div>
  );
}
