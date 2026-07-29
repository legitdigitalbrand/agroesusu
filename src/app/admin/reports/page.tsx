"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LoadingState, ErrorState, Button } from "@/components/yield";
import { FileText, Download, AlertCircle } from "lucide-react";

type ReportType = "deposits" | "loans" | "reconciliation" | "kyc" | "all";

export default function AdminReportsPage() {
  const [reportType, setReportType] = useState<ReportType>("deposits");
  const [showRisk, setShowRisk] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-compliance", reportType],
    queryFn: async () => {
      const res = await fetch(`/api/admin/compliance?type=${reportType}`);
      if (!res.ok) throw new Error("Failed to load report");
      return res.json();
    },
    enabled: !showRisk,
  });

  const { data: riskData, isLoading: riskLoading, error: riskError, refetch: refetchRisk } = useQuery({
    queryKey: ["admin-risk", reportType],
    queryFn: async () => {
      const res = await fetch(`/api/admin/risk?type=${showRisk}`);
      if (!res.ok) throw new Error("Failed to load risk report");
      return res.json();
    },
    enabled: showRisk,
  });

  const handleExport = async (format: "csv" | "json") => {
    const reportKey = showRisk ? `risk_${reportType}` : `compliance_${reportType}`;
    window.open(`/api/admin/reports/${reportKey}?format=${format}`, "_blank");
  };

  const reportTypes: { key: ReportType; label: string }[] = [
    { key: "deposits", label: "Total Deposits" },
    { key: "loans", label: "Loans Outstanding" },
    { key: "reconciliation", label: "Reconciliation" },
    { key: "kyc", label: "KYC Status" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl text-ink">Compliance & Reports</h1>
          <p className="text-sm text-ink-soft mt-0.5">On-demand regulatory and risk reports — traceable to the Ledger</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => handleExport("csv")}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button variant="ghost" onClick={() => handleExport("json")}>
            <Download className="h-4 w-4 mr-1" /> JSON
          </Button>
        </div>
      </div>

      {/* Report type toggle */}
      <div className="flex gap-1 bg-parchment rounded-full p-1 w-fit">
        <button
          onClick={() => setShowRisk(false)}
          className={`px-5 py-2 rounded-full text-sm font-medium transition ${
            !showRisk ? "bg-indigo text-white" : "text-ink-soft"
          }`}
        >
          Compliance
        </button>
        <button
          onClick={() => setShowRisk(true)}
          className={`px-5 py-2 rounded-full text-sm font-medium transition ${
            showRisk ? "bg-indigo text-white" : "text-ink-soft"
          }`}
        >
          Risk
        </button>
      </div>

      {!showRisk ? (
        <>
          {/* Compliance report tabs */}
          <div className="flex gap-2 flex-wrap">
            {reportTypes.map((rt) => (
              <button
                key={rt.key}
                onClick={() => setReportType(rt.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition border ${
                  reportType === rt.key
                    ? "bg-indigo text-white border-indigo"
                    : "bg-paper text-ink-soft border-track hover:border-indigo/30"
                }`}
              >
                <FileText className="h-3.5 w-3.5 inline mr-1.5" />
                {rt.label}
              </button>
            ))}
          </div>

          {/* Report content */}
          {isLoading ? (
            <LoadingState message="Generating report…" />
          ) : error ? (
            <ErrorState message="Couldn't generate report" onRetry={() => refetch()} />
          ) : (
            <ReportRenderer reportType={reportType} data={data} />
          )}
        </>
      ) : (
        <>
          {riskLoading ? (
            <LoadingState message="Loading risk report…" />
          ) : riskError ? (
            <ErrorState message="Couldn't load risk report" onRetry={() => refetchRisk()} />
          ) : (
            <RiskReportRenderer data={riskData} />
          )}
        </>
      )}

      {/* Traceability note */}
      <div className="flex items-start gap-2 bg-indigo/5 rounded-lg p-3">
        <AlertCircle className="h-4 w-4 text-indigo flex-shrink-0 mt-0.5" />
        <p className="text-xs text-ink-soft">
          All compliance reports are generated on-demand from the immutable Enterprise Ledger. Report exports
          are logged to the <span className="font-medium text-ink">report_generations</span> audit trail.
        </p>
      </div>
    </div>
  );
}

function ReportRenderer({ reportType, data }: { reportType: string; data: unknown }) {
  const report = data as Record<string, unknown>;

  return (
    <div className="ys-card">
      <h2 className="font-serif text-lg text-ink mb-4 capitalize">
        {reportType.replace(/_/g, " ")} Report
      </h2>
      <div className="space-y-3">
        {report && typeof report === "object" && Object.entries(report).map(([key, value]) => (
          <div key={key} className="flex justify-between border-b border-track/30 pb-2">
            <span className="text-sm text-ink-soft capitalize">{key.replace(/_/g, " ")}</span>
            <span className="text-sm font-mono text-ink">
              {typeof value === "number"
                ? new Intl.NumberFormat("en-NG", {
                    style: "currency", currency: "NGN",
                    minimumFractionDigits: 0, maximumFractionDigits: 0,
                  }).format(value)
                : String(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RiskReportRenderer({ data }: { data: unknown }) {
  const report = data as Record<string, unknown>;

  return (
    <div className="space-y-4">
      <div className="ys-card">
        <h2 className="font-serif text-lg text-ink mb-4">Portfolio Risk Overview</h2>
        <div className="space-y-3">
          {report && typeof report === "object" && Object.entries(report).map(([key, value]) => (
            <div key={key} className="flex justify-between border-b border-track/30 pb-2">
              <span className="text-sm text-ink-soft capitalize">{key.replace(/_/g, " ")}</span>
              <span className="text-sm font-mono text-ink">
                {typeof value === "number"
                  ? new Intl.NumberFormat("en-NG", {
                      style: "currency", currency: "NGN",
                      minimumFractionDigits: 0, maximumFractionDigits: 0,
                    }).format(value)
                  : String(value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
