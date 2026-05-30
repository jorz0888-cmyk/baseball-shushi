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
// Chrome/Edge/Samsung Internet on Android fire `beforeinstallprompt`
// when the page first becomes installable. iOS Safari doesn't fire it
// (users install via the Share menu). We stash the event on `window`
// so the Home screen can offer a "ホーム画面に追加" button when
// possible, and fall through silently when not.
window.__bbInstallPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  window.__bbInstallPrompt = e;
  // Notify any listening React components.
  window.dispatchEvent(new Event("bb-install-available"));
});

// ── Service worker (production only) ──────────────────────────────────
// Dev reloads stay clean because Vite hot-reloads bypass the cache.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("sw registration failed:", err);
    });
  });
}
