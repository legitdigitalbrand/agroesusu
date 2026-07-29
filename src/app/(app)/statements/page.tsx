"use client";

import { Card, EmptyState, Button } from "@/components/yield";
import { FileText, Download } from "lucide-react";

export default function StatementsPage() {
  const months = [
    { month: "July 2026", status: "Available" },
    { month: "June 2026", status: "Available" },
    { month: "May 2026", status: "Available" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl text-ink">Statements</h1>
        <p className="text-sm text-ink-soft">Download your monthly account statements</p>
      </div>

      <div className="space-y-3">
        {months.map((m) => (
          <Card key={m.month} className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-parchment flex items-center justify-center">
              <FileText className="h-5 w-5 text-indigo" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-ink">{m.month}</p>
              <p className="text-xs text-ink-soft">{m.status}</p>
            </div>
            <Button size="sm" variant="ghost">
              <Download className="h-4 w-4 mr-2" />
              PDF
            </Button>
          </Card>
        ))}
      </div>

      {months.length === 0 && (
        <EmptyState
          title="No statements yet"
          message="Your monthly statements will appear here."
        />
      )}
    </div>
  );
}
