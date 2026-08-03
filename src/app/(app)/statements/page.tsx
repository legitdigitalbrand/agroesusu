"use client";

import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMe } from "@/hooks/use-me";
import {
  LoadingState,
  ErrorState,
  Card,
  CardContent,
  EmptyState,
  Button,
  ScreenHeader,
  MoneyText,
  StatusBadge,
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/yield";
import {
  FileText,
  Download,
  Printer,
  Search,
  X,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  FileSpreadsheet,
} from "lucide-react";
import { format } from "date-fns";

// ════════════════════════════════════════════════════════════
// Statements & History — Monthly summaries and transaction breakdown
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

  const { data: txData, isLoading: txLoading, error: txError, refetch } = useQuery<{ transactions: WalletTransaction[] }>({
    queryKey: ["wallet-transactions-statement", walletId],
    queryFn: async () => {
      const res = await fetch(`/api/wallets/${walletId}/transactions?limit=500`);
      if (!res.ok) return { transactions: [] };
      return res.json();
    },
    enabled: !!walletId,
  });

  // Client-side Filter States
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [directionFilter, setDirectionFilter] = useState<"all" | "credit" | "debit">("all");

  const transactions = txData?.transactions || [];

  // Filter logic
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Search term (description or reference)
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const descMatch = tx.description?.toLowerCase().includes(q) ?? false;
        const refMatch = tx.reference?.toLowerCase().includes(q) ?? false;
        const typeMatch = tx.transaction_type?.toLowerCase().includes(q) ?? false;
        if (!descMatch && !refMatch && !typeMatch) return false;
      }

      // Direction filter
      if (directionFilter !== "all" && tx.direction !== directionFilter) {
        return false;
      }

      // Date range filter
      if (fromDate) {
        const txDate = new Date(tx.created_at);
        const from = new Date(fromDate);
        from.setHours(0, 0, 0, 0);
        if (txDate < from) return false;
      }

      if (toDate) {
        const txDate = new Date(tx.created_at);
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        if (txDate > to) return false;
      }

      return true;
    });
  }, [transactions, search, directionFilter, fromDate, toDate]);

  // Sorted transactions newest first
  const sortedTransactions = useMemo(() => {
    return [...filteredTransactions].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [filteredTransactions]);

  // Group filtered transactions by month for monthly summaries
  const monthSummaries = useMemo(() => {
    const monthMap = new Map<string, MonthSummary>();

    for (const tx of sortedTransactions) {
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
      const isSettled = tx.status?.toLowerCase() === "settled" || tx.status?.toLowerCase() === "completed" || tx.status?.toLowerCase() === "success";
      if (tx.direction === "credit" && isSettled) {
        summary.credits += tx.amount;
        summary.net += tx.amount;
      } else if (tx.direction === "debit" && isSettled) {
        summary.debits += tx.amount;
        summary.net -= tx.amount;
      }
    }

    return Array.from(monthMap.values()).sort((a, b) => b.month.localeCompare(a.month));
  }, [sortedTransactions]);

  const hasActiveFilters = Boolean(search || fromDate || toDate || directionFilter !== "all");

  const clearFilters = () => {
    setSearch("");
    setFromDate("");
    setToDate("");
    setDirectionFilter("all");
  };

  // Export helper function
  const downloadCSV = (txList: WalletTransaction[], filename: string) => {
    if (txList.length === 0) return;

    const headers = ["Date", "Type", "Direction", "Amount (NGN)", "Status", "Reference", "Description"];
    const rows = txList.map((tx) => [
      format(new Date(tx.created_at), "yyyy-MM-dd HH:mm:ss"),
      tx.transaction_type,
      tx.direction,
      tx.amount.toString(),
      tx.status,
      tx.reference,
      tx.description || "",
    ]);

    const csvContent = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrintPDF = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const downloadMonthCSV = (month: MonthSummary) => {
    const monthTx = sortedTransactions.filter((tx) => format(new Date(tx.created_at), "yyyy-MM") === month.month);
    downloadCSV(monthTx, `agriqcap-statement-${month.month}.csv`);
  };

  if (meLoading) return <LoadingState message="Loading account statements…" />;
  if (meError || !me) return <ErrorState message="Couldn't load statements" onRetry={refetch} />;

  if (!walletId) {
    return (
      <div className="space-y-6">
        <ScreenHeader
          title="Statements"
          subtitle="Download and export your monthly account statements"
        />
        <EmptyState
          title="No wallet yet"
          message="Your statements will appear here once your wallet is activated."
          icon={<FileText className="h-6 w-6 text-ink-soft" />}
        />
      </div>
    );
  }

  if (txLoading) return <LoadingState message="Fetching transaction history…" />;
  if (txError) return <ErrorState message="Couldn't load transaction history" onRetry={refetch} />;

  return (
    <div className="space-y-6 pb-12">
      {/* Header and Quick Actions */}
      <ScreenHeader
        title="Statements & History"
        subtitle="Filter, review monthly summaries, and download account statements in CSV or PDF formats."
        action={
          <div className="flex items-center gap-2 print:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadCSV(sortedTransactions, `agriqcap-statement-${format(new Date(), "yyyy-MM-dd")}.csv`)}
              disabled={sortedTransactions.length === 0}
              leftIcon={<Download className="h-4 w-4" />}
            >
              Export CSV
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handlePrintPDF}
              disabled={sortedTransactions.length === 0}
              leftIcon={<Printer className="h-4 w-4" />}
            >
              Print / PDF
            </Button>
          </div>
        }
      />

      {/* Filters Bar */}
      <Card className="print:hidden">
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-line/60 pb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Filter className="h-4 w-4 text-indigo" />
              <span>Filter Statements</span>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-xs font-semibold text-clay hover:text-clay-dim transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                Clear Filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-soft uppercase tracking-wider">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-soft" />
                <input
                  type="text"
                  placeholder="Desc or ref..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-paper border border-line rounded-xl pl-9 pr-3 py-2 text-sm text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-indigo/30 focus:border-indigo"
                />
              </div>
            </div>

            {/* Type / Direction Filter */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-soft uppercase tracking-wider">
                Direction
              </label>
              <select
                value={directionFilter}
                onChange={(e) => setDirectionFilter(e.target.value as "all" | "credit" | "debit")}
                className="w-full bg-paper border border-line rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-indigo/30 focus:border-indigo"
              >
                <option value="all">All Directions</option>
                <option value="credit">Credits (Money In)</option>
                <option value="debit">Debits (Money Out)</option>
              </select>
            </div>

            {/* From Date */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-soft uppercase tracking-wider">
                From Date
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full bg-paper border border-line rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-indigo/30 focus:border-indigo"
              />
            </div>

            {/* To Date */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-soft uppercase tracking-wider">
                To Date
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full bg-paper border border-line rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-indigo/30 focus:border-indigo"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Area */}
      {transactions.length === 0 ? (
        <EmptyState
          title="No statements yet"
          message="Your monthly statements will appear here once you have transaction activity."
          icon={<FileSpreadsheet className="h-6 w-6 text-ink-soft" />}
        />
      ) : sortedTransactions.length === 0 ? (
        <EmptyState
          title="No matching transactions"
          message="No transactions match your current search and filter settings."
          icon={<Search className="h-6 w-6 text-ink-soft" />}
          action={
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Reset Filters
            </Button>
          }
        />
      ) : (
        <div className="space-y-8">
          {/* Monthly Summaries Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-ink">Monthly Summaries</h2>
              <span className="text-xs font-medium text-ink-soft">
                {monthSummaries.length} {monthSummaries.length === 1 ? "month" : "months"} recorded
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {monthSummaries.map((m) => (
                <Card key={m.month} variant="light" className="relative overflow-hidden">
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-line/60">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-parchment border border-line flex items-center justify-center text-indigo shrink-0">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-display font-semibold text-ink text-base">{m.monthLabel}</h3>
                        <p className="text-xs text-ink-soft font-medium">{m.count} {m.count === 1 ? "transaction" : "transactions"}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => downloadMonthCSV(m)}
                      className="shrink-0 print:hidden"
                      leftIcon={<Download className="h-3.5 w-3.5" />}
                    >
                      CSV
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-3">
                    {/* Total Credits */}
                    <div className="bg-loam-light/40 border border-loam/20 rounded-xl p-2.5">
                      <p className="text-[11px] font-semibold text-loam uppercase tracking-wider flex items-center gap-1">
                        <ArrowDownLeft className="h-3 w-3" /> In (Credits)
                      </p>
                      <p className="font-mono font-semibold text-loam text-sm sm:text-base mt-1 truncate">
                        {fmtNGN(m.credits)}
                      </p>
                    </div>

                    {/* Total Debits */}
                    <div className="bg-clay-light/40 border border-clay/20 rounded-xl p-2.5">
                      <p className="text-[11px] font-semibold text-clay uppercase tracking-wider flex items-center gap-1">
                        <ArrowUpRight className="h-3 w-3" /> Out (Debits)
                      </p>
                      <p className="font-mono font-semibold text-clay text-sm sm:text-base mt-1 truncate">
                        {fmtNGN(m.debits)}
                      </p>
                    </div>

                    {/* Net Total */}
                    <div className="bg-parchment/60 border border-line rounded-xl p-2.5">
                      <p className="text-[11px] font-semibold text-ink-soft uppercase tracking-wider">
                        Net Change
                      </p>
                      <p className={`font-mono font-semibold text-sm sm:text-base mt-1 truncate ${m.net >= 0 ? "text-loam" : "text-clay"}`}>
                        {m.net >= 0 ? "+" : ""}{fmtNGN(m.net)}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Transactions Table Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">Transaction History</h2>
                <p className="text-xs text-ink-soft">
                  Showing {sortedTransactions.length} of {transactions.length} total transactions
                </p>
              </div>
            </div>

            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTransactions.map((tx) => (
                    <TableRow key={tx.id} className="hover:bg-parchment/40">
                      <TableCell className="whitespace-nowrap font-mono text-xs text-ink">
                        {format(new Date(tx.created_at), "MMM d, yyyy")}
                        <span className="block text-[11px] text-ink-soft font-mono">
                          {format(new Date(tx.created_at), "HH:mm")}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[220px]">
                        <p className="font-medium text-ink text-sm truncate" title={tx.description || "N/A"}>
                          {tx.description || "N/A"}
                        </p>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-ink-soft whitespace-nowrap">
                        {tx.reference}
                      </TableCell>
                      <TableCell className="capitalize text-xs font-semibold text-ink-soft whitespace-nowrap">
                        {tx.transaction_type?.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md border ${
                            tx.direction === "credit"
                              ? "bg-loam-light/70 text-loam border-loam/20"
                              : "bg-clay-light/70 text-clay border-clay/20"
                          }`}
                        >
                          {tx.direction === "credit" ? (
                            <>
                              <ArrowDownLeft className="h-3 w-3" /> Credit
                            </>
                          ) : (
                            <>
                              <ArrowUpRight className="h-3 w-3" /> Debit
                            </>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <MoneyText amount={tx.amount} direction={tx.direction} size="sm" />
                      </TableCell>
                      <TableCell className="text-center whitespace-nowrap">
                        <StatusBadge status={tx.status} size="sm" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </div>
        </div>
      )}
    </div>
  );
}
