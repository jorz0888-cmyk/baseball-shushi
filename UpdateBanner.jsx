import { useUpdateAvailable } from "./useUpdateAvailable.js";

/**
 * Fixed bottom banner shown when the PWA detects a freshly-deployed
 * version waiting to take over. Tapping「更新する」activates the new
 * SW and reloads — see useUpdateAvailable + main.jsx for the mechanism.
 */
export default function UpdateBanner() {
  const { available, applyUpdate } = useUpdateAvailable();
  if (!available) return null;
  return (
    <div className="update-banner" role="alert">
      <span className="update-text">
        新しいバージョンがあります
      </span>
      <button className="update-btn" onClick={applyUpdate}>
        更新する
      </button>
    </div>
  );
}
