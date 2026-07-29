"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Card, ScreenHeader, Button, LoadingState, ErrorState, EmptyState,
} from "@/components/yield";
import { Users, Vote, Calendar, FileText } from "lucide-react";
import Link from "next/link";
import { useMe } from "@/hooks/use-me";

interface Cooperative {
  id: string;
  name: string;
  description: string;
  registration_number: string;
  member_count?: number;
}

export default function CooperativePage() {
  const { data: me } = useMe();
  const cooperatives = me?.summaries?.cooperatives || [];

  const { data: coopsData, isLoading, error, refetch } = useQuery<{ cooperatives: Cooperative[] }>({
    queryKey: ["cooperatives"],
    queryFn: async () => {
      const res = await fetch("/api/cooperatives");
      if (!res.ok) throw new Error("Failed to load cooperatives");
      return res.json();
    },
  });

  const allCoops = coopsData?.cooperatives || [];
  const memberCoopIds = new Set(cooperatives.map(c => c.cooperative_id));
  const memberCoops = allCoops.filter(c => memberCoopIds.has(c.id));
  const availableCoops = allCoops.filter(c => !memberCoopIds.has(c.id));

  return (
    <div className="space-y-5">
      <ScreenHeader title="Cooperative" subtitle="Save together, grow together" />

      {/* My cooperatives */}
      {isLoading ? (
        <LoadingState message="Loading cooperatives…" />
      ) : error ? (
        <ErrorState message="Couldn't load cooperatives" onRetry={refetch} />
      ) : (
        <>
          {memberCoops.length > 0 ? (
            <div>
              <h2 className="font-serif text-lg text-ink mb-3">My Cooperatives</h2>
              <div className="space-y-3">
                {memberCoops.map((coop) => {
                  const membership = cooperatives.find(c => c.cooperative_id === coop.id);
                  return (
                    <Link key={coop.id} href={`/cooperative/${coop.id}`}>
                      <Card className="hover:border-indigo/30 transition cursor-pointer">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-indigo/10 flex items-center justify-center">
                              <Users className="h-5 w-5 text-indigo" />
                            </div>
                            <div>
                              <p className="font-serif text-base text-ink">{coop.name}</p>
                              <p className="text-xs text-ink-soft">{coop.registration_number}</p>
                            </div>
                          </div>
                          {membership && (
                            <span className="text-xs bg-loam/10 text-loam rounded-full px-2.5 py-1 capitalize">
                              {membership.role}
                            </span>
                          )}
                        </div>

                        {/* Quick links */}
                        <div className="mt-4 flex gap-2">
                          <Link href={`/cooperative/${coop.id}?tab=elections`} className="flex items-center gap-1.5 text-xs text-indigo hover:underline">
                            <Vote className="h-3.5 w-3.5" /> Elections
                          </Link>
                          <Link href={`/cooperative/${coop.id}?tab=meetings`} className="flex items-center gap-1.5 text-xs text-indigo hover:underline">
                            <Calendar className="h-3.5 w-3.5" /> Meetings
                          </Link>
                          <Link href={`/cooperative/${coop.id}?tab=resolutions`} className="flex items-center gap-1.5 text-xs text-indigo hover:underline">
                            <FileText className="h-3.5 w-3.5" /> Resolutions
                          </Link>
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : (
            <EmptyState
              title="Not a member yet"
              message="Join a cooperative to access group savings, Esusu, and cooperative loans."
            />
          )}

          {/* Available cooperatives */}
          {availableCoops.length > 0 && (
            <div>
              <h2 className="font-serif text-lg text-ink mb-3">Available Cooperatives</h2>
              <div className="space-y-3">
                {availableCoops.map((coop) => (
                  <Card key={coop.id}>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-parchment flex items-center justify-center">
                        <Users className="h-5 w-5 text-ink-soft" />
                      </div>
                      <div className="flex-1">
                        <p className="font-serif text-base text-ink">{coop.name}</p>
                        <p className="text-xs text-ink-soft">{coop.description}</p>
                      </div>
                    </div>
                    <Link href={`/cooperative/${coop.id}/join`} className="block mt-4">
                      <Button size="sm" variant="loam" className="w-full">Request to join</Button>
                    </Link>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {allCoops.length === 0 && (
            <EmptyState title="No cooperatives available" message="Check back later for cooperative enrollment." />
          )}
        </>
      )}
    </div>
  );
}
