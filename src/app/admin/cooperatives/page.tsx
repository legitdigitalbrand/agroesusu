"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, LoadingState, ErrorState, StatusBadge } from "@/components/yield";
import { Users } from "lucide-react";

interface Cooperative {
  id: string;
  coop_number: string;
  name: string;
  description: string | null;
  status: string;
}

export default function AdminCooperativesPage() {
  const { data: coopsData, isLoading, error, refetch } = useQuery<{ cooperatives: Cooperative[] }>({
    queryKey: ["admin-cooperatives"],
    queryFn: async () => {
      const res = await fetch("/api/cooperatives");
      if (!res.ok) throw new Error("Failed to load cooperatives");
      return res.json();
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-ink">Cooperatives</h1>
        <p className="text-sm text-ink-soft">Manage cooperative societies and group savings</p>
      </div>

      {isLoading ? (
        <LoadingState message="Loading cooperatives…" />
      ) : error ? (
        <ErrorState message="Couldn't load cooperatives" onRetry={() => refetch()} />
      ) : (
        <div className="grid gap-4">
          {(coopsData?.cooperatives || []).map((c) => (
            <Card key={c.id} className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-parchment flex items-center justify-center">
                <Users className="h-5 w-5 text-indigo" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-ink">{c.name}</p>
                <p className="text-xs text-ink-soft">{c.coop_number}</p>
                {c.description && <p className="text-xs text-ink-soft mt-0.5">{c.description}</p>}
              </div>
              <StatusBadge status={c.status} />
            </Card>
          ))}
          {(!coopsData?.cooperatives || coopsData.cooperatives.length === 0) && (
            <Card className="text-center py-12 text-ink-soft">No cooperatives registered.</Card>
          )}
        </div>
      )}
    </div>
  );
}
