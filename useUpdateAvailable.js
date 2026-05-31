import { useEffect, useState } from "react";

/**
 * Hook for the PWA "a new version is waiting" state.
 *
 * Returns `{ available, applyUpdate }`. `available` is true once
 * main.jsx has captured a waiting ServiceWorkerRegistration.
 * `applyUpdate()` tells the new SW to take over (postMessage
 * SKIP_WAITING) — main.jsx's controllerchange handler then reloads
 * the tab. If for any reason there's no waiting SW available, we
 * fall back to a plain reload so the button never feels broken.
 */
export function useUpdateAvailable() {
  const [available, setAvailable] = useState(
    Boolean(typeof window !== "undefined" && window.__bbUpdateReg),
  );

  useEffect(() => {
    function refresh() {
      setAvailable(Boolean(window.__bbUpdateReg));
    }
    window.addEventListener("bb-update-available", refresh);
    return () => {
      window.removeEventListener("bb-update-available", refresh);
    };
  }, []);

  function applyUpdate() {
    const reg = window.__bbUpdateReg;
    if (reg && reg.waiting) {
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
      // controllerchange in main.jsx will fire and reload.
      return;
    }
    // Fallback path — no waiting SW captured (eg. came from a stale
    // window.__bbUpdateReg). A plain reload is always safe.
    window.location.reload();
  }

  return { available, applyUpdate };
}
