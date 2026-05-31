import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// ── PWA install prompt capture ────────────────────────────────────────
window.__bbInstallPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  window.__bbInstallPrompt = e;
  window.dispatchEvent(new Event("bb-install-available"));
});

// ── PWA update detection ──────────────────────────────────────────────
// Holds the ServiceWorkerRegistration when a waiting SW exists.
window.__bbUpdateReg = null;

// Build id from Vite (define plugin). Falls back to "dev" for the dev
// server where __BUILD_ID__ is not injected.
// eslint-disable-next-line no-undef
const BUILD_ID = typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev";

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register(
        "/sw.js?v=" + BUILD_ID,
      );

      // (a) Already-waiting case: previous tab discovered an update
      // and the page was reloaded with a still-waiting SW.
      if (reg.waiting && navigator.serviceWorker.controller) {
        window.__bbUpdateReg = reg;
        window.dispatchEvent(new Event("bb-update-available"));
      }

      // (b) Live case: SW finds a new sw.js, installs it. When it
      // reaches "installed" *and* a controller exists, that means
      // there's an active old version — this is the moment to
      // prompt the user.
      reg.addEventListener("updatefound", () => {
        const next = reg.installing;
        if (!next) return;
        next.addEventListener("statechange", () => {
          if (
            next.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            window.__bbUpdateReg = reg;
            window.dispatchEvent(new Event("bb-update-available"));
          }
        });
      });

      // When the waiting SW takes over (because the user tapped 更新
      // and we postMessage'd SKIP_WAITING), reload exactly once.
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });

      // Nudge the SW to check for updates when the user comes back to
      // the tab — browsers otherwise only check ~once per day, which
      // makes the banner feel slow on quickly iterated deploys.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          reg.update().catch(() => {});
        }
      });
    } catch (err) {
      console.warn("sw registration failed:", err);
    }
  });
}
