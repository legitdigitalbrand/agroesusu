"use client";

import { useQuery } from "@tanstack/react-query";
import { useMe } from "@/hooks/use-me";
import { LoadingState, ErrorState, Card, EmptyState, Button } from "@/components/yield";
import { FileText, Download } from "lucide-react";
import { format } from "date-fns";

// ════════════════════════════════════════════════════════════
// Statements — shows monthly transaction summaries from real data
// ════════════════════════════════════════════════════════════

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

interface MonthSummary {
  month: string;
  monthLabel: string;
  count: number;
  credits: number;
  debits: number;
  net: number;
}

const fmtNGN = (v: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(v || 0);

export default function StatementsPage() {
  const { data: me, isLoading: meLoading, error: meError } = useMe();
  const walletId = me?.wallet?.id;

  const { data: txData, isLoading: txLoading, error: txError } = useQuery<{ transactions: WalletTransaction[] }>({
    queryKey: ["wallet-transactions-statement", walletId],
    queryFn: async () => {
      const res = await fetch(`/api/wallets/${walletId}/transactions?limit=500`);
      if (!res.ok) return { transactions: [] };
      return res.json();
    },
    enabled: !!walletId,
  });

  if (meLoading) return <LoadingState message="Loading statements…" />;
  if (meError || !me) return <ErrorState message="Couldn't load statements" />;

  const transactions = txData?.transactions || [];

  // Group transactions by month
  const monthMap = new Map<string, MonthSummary>();
  for (const tx of transactions) {
    const date = new Date(tx.created_at);
    const monthKey = format(date, "yyyy-MM");
    const monthLabel = format(date, "MMMM yyyy");

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, {
        month: monthKey,
        monthLabel,
        count: 0,
        credits: 0,
        debits: 0,
        net: 0,
      });
    }

    const summary = monthMap.get(monthKey)!;
    summary.count++;
    if (tx.direction === "credit" && tx.status === "settled") {
      summary.credits += tx.amount;
      summary.net += tx.amount;
    } else if (tx.direction === "debit" && tx.status === "settled") {
      summary.debits += tx.amount;
      summary.net -= tx.amount;
    }
  }

  const months = Array.from(monthMap.values()).sort((a, b) => b.month.localeCompare(a.month));

  const downloadCSV = (month: MonthSummary) => {
    const monthTx = transactions.filter((tx) => format(new Date(tx.created_at), "yyyy-MM") === month.month);
    const headers = ["Date", "Type", "Direction", "Amount", "Status", "Reference", "Description"];
    const rows = monthTx.map((tx) => [
      format(new Date(tx.created_at), "yyyy-MM-dd HH:mm"),
      tx.transaction_type,
      tx.direction,
      tx.amount.toString(),
      tx.status,
      tx.reference,
      tx.description || "",
    ]);

    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agriqcap-statement-${month.month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!walletId) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="font-display text-2xl text-ink">Statements</h1>
          <p className="text-sm text-ink-soft">Download your monthly account statements</p>
        </div>
        <EmptyState
          title="No wallet yet"
          message="Your statements will appear here once your wallet is activated."
        />
      </div>
    );
  }

  if (txLoading) return <LoadingState message="Loading statements…" />;
  if (txError) return <ErrorState message="Couldn't load transaction history" />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl text-ink">Statements</h1>
        <p className="text-sm text-ink-soft">Download your monthly account statements</p>
      </div>

      {months.length === 0 ? (
        <EmptyState
          title="No statements yet"
          message="Your monthly statements will appear here once you have transaction activity."
        />
      ) : (
        <div className="space-y-3">
          {months.map((m) => (
            <Card key={m.month} className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-parchment flex items-center justify-center flex-shrink-0">
                <FileText className="h-5 w-5 text-indigo" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-ink">{m.monthLabel}</p>
                <p className="text-xs text-ink-soft">
                  {m.count} transactions · In: {fmtNGN(m.credits)} · Out: {fmtNGN(m.debits)}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => downloadCSV(m)}
                className="flex-shrink-0"
              >
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
