"use client";

// ============================================================================
// TransactionReceiptDialog — OPay-style receipt detail sheet
//
// Every transaction row (Recent Transactions on the dashboard, Statement
// History) opens this receipt. The card is capture-ready: scalloped edges,
// logo, amount, status, timestamp, dashed dividers and type-aware detail
// rows. "Download" saves it as receipt-<reference>.png (html-to-image),
// "Share" uses the Web Share API with a download fallback.
// ============================================================================

import { useCallback, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/yield";
import { LogoMark } from "@/components/yield";
import { Download, Share2, Check } from "lucide-react";

export interface ReceiptTransaction {
  id: string;
  transaction_type: string;
  amount: number;
  direction: "credit" | "debit";
  status: string;
  narration: string | null;
  // wallet_transactions stores the reference as transaction_reference
  // (savings history uses reference) — the dialog accepts either.
  reference?: string | null;
  transaction_reference?: string | null;
  external_reference?: string | null;
  counterparty_account_number?: string | null;
  counterparty_account_name?: string | null;
  counterparty_bank_name?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

interface TransactionReceiptDialogProps {
  transaction: ReceiptTransaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Formatting helpers ─────────────────────────────────────────────────────

function formatNaira(amount: number): string {
  return `₦${Number(amount).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function ordinalDay(day: number): string {
  if (day % 10 === 1 && day !== 11) return `${day}st`;
  if (day % 10 === 2 && day !== 12) return `${day}nd`;
  if (day % 10 === 3 && day !== 13) return `${day}rd`;
  return `${day}th`;
}

function formatReceiptDate(iso: string): string {
  const d = new Date(iso);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${months[d.getMonth()]} ${ordinalDay(d.getDate())}, ${d.getFullYear()} ${hh}:${mm}:${ss}`;
}

type ReceiptStatus = "Successful" | "Pending" | "Failed" | "Reversed";

function statusLabel(status: string): ReceiptStatus {
  const s = (status || "").toLowerCase();
  if (s.includes("revers")) return "Reversed";
  if (s.includes("fail")) return "Failed";
  if (s.includes("pending") || s.includes("initiated") || s.includes("processing")) return "Pending";
  return "Successful";
}

const STATUS_TEXT: Record<ReceiptStatus, string> = {
  Successful: "text-loam",
  Pending: "text-ochre-dim",
  Failed: "text-clay",
  Reversed: "text-clay",
};

// Resolve the reference from whichever field carries it (WTX-YYYY-NNNNNNNN)
function resolveReference(tx: ReceiptTransaction): string {
  const ref = tx.reference ?? tx.transaction_reference ?? tx.id;
  return String(ref ?? "");
}

// ─── Type-aware detail rows ────────────────────────────────────────────────

interface DetailRow {
  label: string;
  value: string;
}

function buildDetailRows(tx: ReceiptTransaction): DetailRow[] {
  const rows: DetailRow[] = [];
  const meta = (tx.metadata || {}) as Record<string, unknown>;
  const isCredit = tx.direction === "credit";

  // Counterparty — Sender for credits, Recipient for debits
  const cpName = tx.counterparty_account_name;
  const cpBank = tx.counterparty_bank_name;
  const cpAcct = tx.counterparty_account_number;
  if (cpName || cpAcct) {
    const parts = [cpName, cpBank, cpAcct].filter(Boolean).map(String);
    rows.push({
      label: isCredit ? "Sender Details" : "Recipient Details",
      value: parts.join(" · "),
    });
  }

  // Savings pot / product name, when the move involved one
  const potName =
    (meta.pot_name as string) ||
    (meta.account_name as string) ||
    (meta.savings_account_name as string) ||
    (meta.product_name as string);
  if (potName && tx.transaction_type.includes("savings")) {
    rows.push({ label: "Savings Pot", value: String(potName) });
  }

  // Remark / narration
  if (tx.narration) {
    rows.push({ label: "Remark", value: tx.narration });
  }

  // Transaction reference (ours)
  rows.push({ label: "Transaction Reference", value: resolveReference(tx) });

  // Provider reference / session id, when present
  const providerRef =
    tx.external_reference ||
    (meta.sessionId as string) ||
    (meta.session_id as string) ||
    (meta.provider_reference as string) ||
    (meta.payment_reference as string);
  if (providerRef && String(providerRef) !== resolveReference(tx)) {
    rows.push({ label: "Session ID", value: String(providerRef) });
  }

  // Transaction type, humanized
  rows.push({
    label: "Transaction Type",
    value: tx.transaction_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  });

  return rows;
}

// ─── The receipt card (capture target) ─────────────────────────────────────

function ReceiptCard({ tx }: { tx: ReceiptTransaction }) {
  const status = statusLabel(tx.status);
  const amount = formatNaira(tx.amount);
  const failed = status === "Failed" || status === "Reversed";
  const amountColor = failed ? "text-clay" : tx.direction === "credit" ? "text-indigo" : "text-ink";

  return (
    <div className="w-full max-w-[380px] mx-auto bg-paper select-none">
      {/* Scalloped top edge — row of semicircles cut into the card */}
      <div
        className="h-3 bg-repeat-x"
        style={{
          backgroundImage:
            "radial-gradient(circle at 8px 12px, #FBFDF9 8px, transparent 8.5px)",
          backgroundSize: "16px 12px",
          backgroundColor: "transparent",
        }}
      />
      <div className="bg-paper -mt-1 pt-4 px-6">
        {/* Header: logo + label */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LogoMark size={26} variant="customer" />
            <span className="font-display font-semibold text-[15px] tracking-tight text-ink">
              AgroPocket
            </span>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-soft">
            Transaction Receipt
          </span>
        </div>

        {/* Amount */}
        <div className="mt-7 text-center">
          <p
            className={`font-mono font-bold text-[34px] leading-none ${amountColor}`}
          >
            {tx.direction === "debit" ? "−" : "+"}
            {amount}
          </p>
          <p className={`mt-2 text-sm font-semibold ${STATUS_TEXT[status]}`}>
            {status}
          </p>
          <p className="mt-1 text-xs font-mono text-ink-soft">
            {formatReceiptDate(tx.created_at)}
          </p>
        </div>

        {/* Dashed divider */}
        <div className="mt-6 border-t border-dashed border-line" />

        {/* Detail rows */}
        <div className="py-4 space-y-3">
          {buildDetailRows(tx).map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-6">
              <span className="text-[11px] font-medium text-ink-soft whitespace-nowrap">
                {row.label}
              </span>
              <span className="text-[12px] font-semibold text-ink text-right break-words max-w-[210px]">
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {/* Dashed divider */}
        <div className="border-t border-dashed border-line" />

        {/* Footer */}
        <p className="py-4 text-center text-[10px] text-ink-soft leading-relaxed">
          Save smarter with AgroPocket. This receipt was generated
          electronically and is valid without signature.
        </p>
      </div>
      {/* Scalloped bottom edge */}
      <div
        className="h-3 bg-repeat-x"
        style={{
          backgroundImage:
            "radial-gradient(circle at 8px 0px, #FBFDF9 8px, transparent 8.5px)",
          backgroundSize: "16px 12px",
          backgroundColor: "transparent",
        }}
      />
    </div>
  );
}

// ─── Dialog wrapper with Download / Share ─────────────────────────────────

export function TransactionReceiptDialog({
  transaction,
  open,
  onOpenChange,
}: TransactionReceiptDialogProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState<"idle" | "saving" | "done">("idle");

  const filename = useMemo(
    () =>
      `receipt-${resolveReference(transaction ?? ({ id: "tx" } as ReceiptTransaction)).replace(/[^a-zA-Z0-9-]/g, "")}.png`,
    [transaction]
  );

  const capture = useCallback(async (): Promise<Blob | null> => {
    if (!receiptRef.current) return null;
    const dataUrl = await toPng(receiptRef.current, {
      pixelRatio: 2,
      backgroundColor: "#FBFDF9",
    });
    const res = await fetch(dataUrl);
    return res.blob();
  }, []);

  const handleDownload = useCallback(async () => {
    try {
      setSaving("saving");
      if (!receiptRef.current) return;
      const dataUrl = await toPng(receiptRef.current, {
        pixelRatio: 2,
        backgroundColor: "#FBFDF9",
      });
      const link = document.createElement("a");
      link.download = filename;
      link.href = dataUrl;
      link.click();
      setSaving("done");
      setTimeout(() => setSaving("idle"), 2000);
    } catch (err) {
      console.error("Receipt download failed:", err);
      setSaving("idle");
    }
  }, [filename]);

  const handleShare = useCallback(async () => {
    try {
      setSaving("saving");
      const blob = await capture();
      if (!blob) {
        setSaving("idle");
        return;
      }
      const file = new File([blob], filename, { type: "image/png" });
      const nav = navigator as Navigator & {
        canShare?: (data: { files?: File[] }) => boolean;
        share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
      };
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({
          files: [file],
          title: "AgroPocket Transaction Receipt",
          text: transaction
            ? `Receipt ${resolveReference(transaction)} — ${formatNaira(transaction.amount)} (${statusLabel(transaction.status)})`
            : "AgroPocket receipt",
        });
      } else {
        const link = document.createElement("a");
        link.download = filename;
        link.href = URL.createObjectURL(blob);
        link.click();
      }
      setSaving("done");
      setTimeout(() => setSaving("idle"), 2000);
    } catch (err) {
      console.error("Receipt share failed:", err);
      setSaving("idle");
    }
  }, [capture, filename, transaction]);

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-4 sm:p-5">
        <DialogHeader className="px-2 pt-2">
          <DialogTitle className="text-lg">Receipt</DialogTitle>
          <DialogDescription>
            Tap Download to save this receipt as an image.
          </DialogDescription>
        </DialogHeader>

        <div ref={receiptRef} className="py-2 bg-paper">
          <ReceiptCard tx={transaction} />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleDownload}
            disabled={saving === "saving"}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-indigo px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-deep disabled:opacity-60"
          >
            {saving === "done" ? (
              <Check className="h-4 w-4" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {saving === "done" ? "Saved" : saving === "saving" ? "Saving…" : "Download"}
          </button>
          <button
            onClick={handleShare}
            disabled={saving === "saving"}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-line bg-paper px-4 py-3 text-sm font-semibold text-ink transition hover:bg-parchment disabled:opacity-60"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
