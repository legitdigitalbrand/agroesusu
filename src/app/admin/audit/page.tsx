"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LoadingState, ErrorState, Button } from "@/components/yield";
import { Filter } from "lucide-react";
import { formatDateTime } from "@/lib/format";

interface AuditEntry {
  id: string;
  actor_id: string;
  actor_name: string;
  action: string;
  action_category: string;
  entity_type: string;
  entity_id: string | null;
  result: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface AuditResponse {
  entries: AuditEntry[];
  total: number;
  summary?: Record<string, number>;
}

type LogType = "audit" | "governance" | "admin";

export default function AdminAuditPage() {
  const [logType, setLogType] = useState<LogType>("audit");
  const [filters, setFilters] = useState({
    actor: "",
    action: "",
    entity_type: "",
    result: "",
  });
  const [showFilters, setShowFilters] = useState(false);

  const queryString = new URLSearchParams({
    log_type: logType,
    ...(filters.actor && { actor: filters.actor }),
    ...(filters.action && { action: filters.action }),
    ...(filters.entity_type && { entity_type: filters.entity_type }),
    ...(filters.result && { result: filters.result }),
    limit: "50",
  }).toString();

  const { data, isLoading, error, refetch } = useQuery<AuditResponse>({
    queryKey: ["admin-audit", logType, queryString],
    queryFn: async () => {
      const res = await fetch(`/api/admin/audit?${queryString}`);
      if (!res.ok) throw new Error("Failed to load audit log");
      return res.json();
    },
  });

  const entries = data?.entries || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl text-ink">Audit Log</h1>
          <p className="text-sm text-ink-soft mt-0.5">Immutable, append-only audit trail</p>
        </div>
        <Button variant="ghost" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="h-4 w-4 mr-1" /> Filters
        </Button>
      </div>

      {/* Log type tabs */}
      <div className="flex gap-1 bg-parchment rounded-full p-1 w-fit">
        {(["audit", "governance", "admin"] as LogType[]).map((type) => (
          <button
            key={type}
            onClick={() => setLogType(type)}
            className={`px-5 py-2 rounded-full text-sm font-medium transition capitalize ${
              logType === type ? "bg-indigo text-white" : "text-ink-soft hover:text-ink"
            }`}
          >
            {type === "audit" ? "System Audit" : type === "governance" ? "Governance" : "Admin Actions"}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div className="ys-card grid grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="Actor name…"
            value={filters.actor}
            onChange={(e) => setFilters({ ...filters, actor: e.target.value })}
            className="ys-input text-sm"
          />
          <input
            type="text"
            placeholder="Action…"
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
            className="ys-input text-sm"
          />
          <input
            type="text"
            placeholder="Entity type…"
            value={filters.entity_type}
            onChange={(e) => setFilters({ ...filters, entity_type: e.target.value })}
            className="ys-input text-sm"
          />
          <select
            value={filters.result}
            onChange={(e) => setFilters({ ...filters, result: e.target.value })}
            className="ys-input text-sm"
          >
            <option value="">All results</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
          </select>
        </div>
      )}

      {/* Summary */}
      {data?.summary && Object.keys(data.summary).length > 0 && (
        <div className="flex gap-4">
          {Object.entries(data.summary).map(([key, count]) => (
            <div key={key} className="ys-card px-4 py-2">
              <span className="text-xs text-ink-soft capitalize">{key}</span>
              <span className="ml-2 font-mono text-sm text-ink">{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Audit entries */}
      {isLoading ? (
        <LoadingState message="Loading audit log…" />
      ) : error ? (
        <ErrorState message="Couldn't load audit log" onRetry={() => refetch()} />
      ) : entries.length === 0 ? (
        <div className="ys-card text-center py-12">
          <p className="text-sm text-ink-soft">No audit entries found.</p>
        </div>
      ) : (
        <div className="ys-card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-track/60">
                <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Timestamp</th>
                <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Actor</th>
                <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Action</th>
                <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Category</th>
                <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Entity</th>
                <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Result</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-track/30 last:border-0 hover:bg-parchment/50 transition">
                  <td className="py-3 pr-4 text-xs text-ink-soft font-mono whitespace-nowrap">
                    {formatDateTime(entry.created_at)}
                  </td>
                  <td className="py-3 pr-4 text-sm text-ink">{entry.actor_name || entry.actor_id?.slice(0, 8) || "—"}</td>
                  <td className="py-3 pr-4 text-sm text-ink font-medium">{entry.action}</td>
                  <td className="py-3 pr-4 text-sm text-ink-soft capitalize">{entry.action_category?.replace(/_/g, " ") || "—"}</td>
                  <td className="py-3 pr-4 text-xs text-ink-soft">
                    {entry.entity_type ? `${entry.entity_type}${entry.entity_id ? ` · ${entry.entity_id.slice(0, 8)}` : ""}` : "—"}
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`text-xs rounded-full px-2.5 py-1 ${
                      entry.result === "success" ? "bg-loam/10 text-loam" : "bg-clay/10 text-clay"
                    }`}>
                      {entry.result}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data?.total && data.total > entries.length && (
            <p className="text-xs text-ink-soft text-center py-3">Showing {entries.length} of {data.total} entries</p>
          )}
        </div>
      )}
    </div>
  );
}
