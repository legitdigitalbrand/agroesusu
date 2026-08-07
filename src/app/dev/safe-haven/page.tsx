"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LoadingState, ErrorState, StatusBadge } from "@/components/yield";
import { Shield, Server, FileCheck, Activity } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/format";

const TABS = [
  { key: "accounts", label: "Virtual Accounts", icon: Shield },
  { key: "verifications", label: "Identity Verifications", icon: FileCheck },
  { key: "api_calls", label: "API Calls", icon: Server },
] as const;

type TabKey = typeof TABS[number]["key"];

export default function AdminSafeHavenPage() {
  const [tab, setTab] = useState<TabKey>("accounts");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-safe-haven", tab],
    queryFn: async () => {
      const res = await fetch(`/api/admin/safe-haven?type=${tab}`);
      if (!res.ok) throw new Error("Failed to load Safe Haven data");
      return res.json();
    },
    staleTime: 30 * 1000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-ink">Safe Haven Internal</h1>
        <p className="text-sm text-ink-soft mt-0.5">Monitor Safe Haven MFB integration — accounts, verifications, and API health</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-line overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
                tab === t.key ? "border-indigo text-ink" : "border-transparent text-ink-soft hover:text-ink"
              }`}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <LoadingState message="Loading Safe Haven data…" />
      ) : error ? (
        <ErrorState message="Couldn't load Safe Haven data" onRetry={() => refetch()} />
      ) : (
        <>
          {/* Virtual Accounts */}
          {tab === "accounts" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-line bg-paper p-4">
                <p className="text-xs font-medium text-ink-soft uppercase tracking-wide">Total Accounts</p>
                <p className="mt-1 text-xl font-semibold text-ink">{data.accounts_total || 0}</p>
              </div>
              <div className="ys-card overflow-x-auto">
                {data.accounts?.length === 0 ? (
                  <p className="text-sm text-ink-soft py-8 text-center">No Safe Haven accounts found.</p>
                ) : (
                  <table className="w-full min-w-[700px]">
                    <thead>
                      <tr className="border-b border-track/60">
                        <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Account #</th>
                        <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Customer</th>
                        <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Bank</th>
                        <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Status</th>
                        <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.accounts || []).map((a: Record<string, unknown>) => (
                        <tr key={a.id as string} className="border-b border-track/30 last:border-0 hover:bg-parchment/50 transition">
                          <td className="py-3 pr-4 font-mono text-sm text-ink">{a.account_number as string}</td>
                          <td className="py-3 pr-4 text-sm text-ink font-medium">
                            {(a.customer as Record<string, string>)?.full_name || "Unknown"}
                          </td>
                          <td className="py-3 pr-4 text-sm text-ink-soft">{a.bank_name as string}</td>
                          <td className="py-3 pr-4"><StatusBadge status={a.status as string} /></td>
                          <td className="py-3 text-sm text-ink-soft">{formatDate(a.created_at as string)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Identity Verifications */}
          {tab === "verifications" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-line bg-paper p-4">
                <p className="text-xs font-medium text-ink-soft uppercase tracking-wide">Total Verifications</p>
                <p className="mt-1 text-xl font-semibold text-ink">{data.verifications_total || 0}</p>
              </div>
              <div className="ys-card overflow-x-auto">
                {data.verifications?.length === 0 ? (
                  <p className="text-sm text-ink-soft py-8 text-center">No identity verifications found.</p>
                ) : (
                  <table className="w-full min-w-[700px]">
                    <thead>
                      <tr className="border-b border-track/60">
                        <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Type</th>
                        <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Customer</th>
                        <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Number</th>
                        <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Status</th>
                        <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Initiated</th>
                        <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3">Verified</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.verifications || []).map((v: Record<string, unknown>) => (
                        <tr key={v.id as string} className="border-b border-track/30 last:border-0 hover:bg-parchment/50 transition">
                          <td className="py-3 pr-4 text-sm text-ink font-medium">{v.type as string}</td>
                          <td className="py-3 pr-4 text-sm text-ink">
                            {(v.customer as Record<string, string>)?.full_name || "Unknown"}
                          </td>
                          <td className="py-3 pr-4 font-mono text-sm text-ink-soft">
                            {`****${String(v.number).slice(-4)}`}
                          </td>
                          <td className="py-3 pr-4"><StatusBadge status={v.status as string} /></td>
                          <td className="py-3 pr-4 text-sm text-ink-soft">{formatDateTime(v.initiated_at as string)}</td>
                          <td className="py-3 pr-4 text-sm text-ink-soft">
                            {v.verified_at ? formatDateTime(v.verified_at as string) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* API Calls */}
          {tab === "api_calls" && (
            <div className="space-y-4">
              {/* API stats */}
              {data.api_stats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg border border-line bg-paper p-4">
                    <p className="text-xs font-medium text-ink-soft uppercase tracking-wide">Total Calls</p>
                    <p className="mt-1 text-xl font-semibold text-ink">{(data.api_stats as Record<string, number>).total}</p>
                  </div>
                  <div className="rounded-lg border border-line bg-paper p-4">
                    <p className="text-xs font-medium text-ink-soft uppercase tracking-wide">Successful</p>
                    <p className="mt-1 text-xl font-semibold text-loam">{(data.api_stats as Record<string, number>).successful}</p>
                  </div>
                  <div className="rounded-lg border border-line bg-paper p-4">
                    <p className="text-xs font-medium text-ink-soft uppercase tracking-wide">Errors</p>
                    <p className="mt-1 text-xl font-semibold text-clay">{(data.api_stats as Record<string, number>).errors}</p>
                  </div>
                  <div className="rounded-lg border border-line bg-paper p-4">
                    <p className="text-xs font-medium text-ink-soft uppercase tracking-wide">Error Rate</p>
                    <p className="mt-1 text-xl font-semibold text-ink">{(data.api_stats as Record<string, string>).error_rate}%</p>
                  </div>
                </div>
              )}

              <div className="ys-card overflow-x-auto">
                {data.api_calls?.length === 0 ? (
                  <div className="text-center py-8">
                    <Activity className="h-8 w-8 text-ink-soft mx-auto" />
                    <p className="mt-3 text-sm text-ink-soft">No API calls logged.</p>
                  </div>
                ) : (
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="border-b border-track/60">
                        <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Endpoint</th>
                        <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Method</th>
                        <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Status</th>
                        <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Duration</th>
                        <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.api_calls || []).map((c: Record<string, unknown>) => (
                        <tr key={c.id as string} className="border-b border-track/30 last:border-0 hover:bg-parchment/50 transition">
                          <td className="py-3 pr-4 font-mono text-xs text-ink">{c.endpoint as string}</td>
                          <td className="py-3 pr-4 text-sm text-ink">{c.method as string}</td>
                          <td className="py-3 pr-4">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              Number(c.status_code) < 400 ? "bg-loam/10 text-loam" : "bg-clay/10 text-clay"
                            }`}>{c.status_code as number}</span>
                          </td>
                          <td className="py-3 pr-4 text-sm text-ink-soft">{c.duration_ms as number}ms</td>
                          <td className="py-3 text-sm text-ink-soft">{formatDateTime(c.created_at as string)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
