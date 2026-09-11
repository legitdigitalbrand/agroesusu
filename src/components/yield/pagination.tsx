"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Optional "Showing X–Y of Z" label. Omit to hide. */
  rangeLabel?: string;
  className?: string;
}

// Builds a compact page-number list with ellipses, e.g.
// [1, '…', 4, 5, 6, '…', 12] — always keeps first, last, and a window
// around the current page.
function buildPageList(page: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, 2, totalPages - 1, totalPages, page - 1, page, page + 1]);
  const sorted = Array.from(pages)
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);

  const result: (number | "…")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push("…");
    result.push(p);
    prev = p;
  }
  return result;
}

/**
 * Shared pagination control for transaction tables (wallet, statements).
 * Renders Previous/Next plus a compact page-number list.
 */
export function Pagination({ page, totalPages, onPageChange, rangeLabel, className }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pageList = buildPageList(page, totalPages);

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-5 py-4 border-t border-line",
        className
      )}
    >
      {rangeLabel && <p className="text-xs text-ink-soft order-2 sm:order-1">{rangeLabel}</p>}

      <div className="flex items-center gap-1.5 order-1 sm:order-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="px-2"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <div className="flex items-center gap-1">
          {pageList.map((p, i) =>
            p === "…" ? (
              <span key={`ellipsis-${i}`} className="px-1.5 text-xs text-ink-soft select-none">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={p === page ? "page" : undefined}
                className={cn(
                  "min-w-[2rem] h-8 px-2 rounded-lg text-xs font-semibold transition-colors",
                  p === page
                    ? "bg-indigo-deep text-white"
                    : "text-ink-soft hover:bg-parchment hover:text-ink"
                )}
              >
                {p}
              </button>
            )
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
          className="px-2"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
