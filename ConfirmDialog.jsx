import { useEffect } from "react";

/**
 * Modal yes/no confirmation. ESC and backdrop click both cancel.
 *
 * @param {Object} props
 * @param {string} props.message
 * @param {() => void} props.onConfirm
 * @param {() => void} props.onCancel
 * @param {string} [props.confirmLabel="はい"] — confirm-side button text
 */
export default function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
  confirmLabel = "はい",
}) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="modal-backdrop" onClick={onCancel} role="dialog">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <p className="modal-message">{message}</p>
        <div className="modal-buttons">
          <button onClick={onCancel}>いいえ</button>
          <button className="danger" onClick={onConfirm} autoFocus>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
