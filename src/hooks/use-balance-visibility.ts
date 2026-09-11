"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "agropocket_balance_visible";

/**
 * Shared balance-visibility toggle (the eye icon on balance cards).
 *
 * One global, persisted flag: when the user hides balances on the dashboard,
 * savings pages, etc. stay hidden too — across pages and sessions — instead
 * of every screen resetting to "visible".
 *
 * Storage key keeps the legacy `agriqcap_` prefix naming convention used by
 * other functional localStorage keys; do not rename without a migration.
 */
export function useBalanceVisibility() {
  const [visible, setVisible] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored !== null) setVisible(stored === "1");
    } catch {
      /* private mode / storage disabled — keep default */
    }
    setHydrated(true);
  }, []);

  const toggle = () => {
    setVisible((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* non-fatal */
      }
      return next;
    });
  };

  return { visible, toggle, hydrated };
}
