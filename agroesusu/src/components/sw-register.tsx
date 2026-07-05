"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      let reloaded = false;

      // Reload once when a new service worker takes control, so users
      // actually see the new build instead of a stale cached shell.
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloaded) return;
        reloaded = true;
        window.location.reload();
      });

      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((reg) => {
          // Check for a new version right away and then periodically.
          reg.update();
          setInterval(() => reg.update(), 15 * 60 * 1000);

          // If a new worker is already waiting (e.g. installed in a previous
          // tab), activate it immediately instead of waiting an hour.
          if (reg.waiting) {
            reg.waiting.postMessage("SKIP_WAITING");
          }

          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (!newWorker) return;
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                newWorker.postMessage("SKIP_WAITING");
              }
            });
          });
        })
        .catch((err) => console.error("SW registration failed:", err));
    }
  }, []);

  return null;
}
