import { useEffect, useState } from "react";

/**
 * React hook for the deferred PWA install prompt.
 *
 * Returns `{ canInstall, install }`. `canInstall` is true once
 * Chrome/Edge has fired `beforeinstallprompt` (stashed onto the
 * window by main.jsx). `install()` calls the saved prompt's
 * `prompt()` and resolves once the user has accepted or dismissed.
 *
 * iOS Safari doesn't fire the event, so `canInstall` stays false —
 * the consuming UI just won't show the button on iOS, matching
 * platform expectations (iOS users install via the Share menu).
 */
export function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState(
    Boolean(typeof window !== "undefined" && window.__bbInstallPrompt),
  );

  useEffect(() => {
    function refresh() {
      setCanInstall(Boolean(window.__bbInstallPrompt));
    }
    window.addEventListener("bb-install-available", refresh);
    window.addEventListener("appinstalled", () => {
      window.__bbInstallPrompt = null;
      setCanInstall(false);
    });
    return () => {
      window.removeEventListener("bb-install-available", refresh);
    };
  }, []);

  async function install() {
    const evt = window.__bbInstallPrompt;
    if (!evt) return null;
    try {
      evt.prompt();
      const { outcome } = await evt.userChoice;
      // Single-use event — clear it whether accepted or dismissed.
      window.__bbInstallPrompt = null;
      setCanInstall(false);
      return outcome; // "accepted" | "dismissed"
    } catch {
      return null;
    }
  }

  return { canInstall, install };
}
