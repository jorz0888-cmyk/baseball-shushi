import { useState } from "react";
import { useCloudSync } from "./useCloudSync.js";
import { generateSyncCode, normalizeSyncCode } from "./cloudSync.js";
import ConfirmDialog from "./ConfirmDialog.jsx";

/**
 * ホーム画面のクラウド同期カード。
 *
 * 同期 OFF のとき: 新規コード発行ボタン + 既存コード入力欄
 * 同期 ON のとき:  現在コード表示、コピー、状態、停止ボタン
 */
export default function CloudSyncCard() {
  const { code, status, lastSync, error, start, stop } = useCloudSync();
  const [inputCode, setInputCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);

  function copyCode() {
    if (!code || !navigator.clipboard) return;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function handleStartNew() {
    start(generateSyncCode());
  }

  function handleJoin() {
    const normalized = normalizeSyncCode(inputCode);
    if (!normalized) return;
    start(normalized);
    setInputCode("");
  }

  const inputValid = Boolean(normalizeSyncCode(inputCode));

  return (
    <section className="card">
      <h2>☁️ クラウド同期</h2>

      {code ? (
        <>
          <div className="sync-on">
            <div className="sync-on-row">
              <span className="sync-on-label">同期中</span>
              <span className="sync-code" onClick={copyCode} title="タップでコピー">
                {code}
                {copied && <span className="copied-tag">✓ コピー</span>}
              </span>
            </div>
            <div className="sync-on-row">
              <span className="sync-on-label">状態</span>
              <span className="sync-status">
                {status === "idle" && (
                  <span className="neutral">待機中</span>
                )}
                {status === "pushing" && (
                  <span className="plus">↑ アップロード中</span>
                )}
                {status === "pulling" && (
                  <span className="plus">↓ ダウンロード中</span>
                )}
                {status === "error" && (
                  <span className="minus">エラー</span>
                )}
                {status === "off" && (
                  <span className="neutral">停止中</span>
                )}
              </span>
            </div>
            {lastSync && (
              <div className="sync-on-row">
                <span className="sync-on-label">最終同期</span>
                <span className="neutral">
                  {lastSync.toLocaleTimeString("ja-JP", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              </div>
            )}
            {error && <p className="error">同期エラー: {error}</p>}
          </div>
          <button
            className="danger-outline sync-stop-btn"
            onClick={() => setConfirmStop(true)}
          >
            同期を停止
          </button>
          <p className="hint" style={{ margin: "8px 0 0", textAlign: "left" }}>
            このコードを別のスマホで入力すると、両方の端末が同じデータを共有します。
          </p>
        </>
      ) : (
        <>
          <p className="empty" style={{ marginBottom: 12, textAlign: "left" }}>
            別のスマホとデータを共有するには、コードで同期を開始します。
          </p>
          <button className="primary sync-start-btn" onClick={handleStartNew}>
            🔑 新しいコードで同期開始
          </button>
          <p
            className="hint"
            style={{ margin: "12px 0 8px", textAlign: "left" }}
          >
            または、別の端末で発行されたコードを入力:
          </p>
          <div className="sync-join-row">
            <input
              type="text"
              placeholder="ABC-234"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              maxLength={9}
              style={{ textTransform: "uppercase" }}
            />
            <button
              className="primary"
              onClick={handleJoin}
              disabled={!inputValid}
            >
              参加
            </button>
          </div>
        </>
      )}

      {confirmStop && (
        <ConfirmDialog
          message={`クラウド同期を停止しますか？\n\nこの端末のデータは残りますが、別端末との自動同期は止まります。\n再開するには同じコードを入力してください。`}
          confirmLabel="停止する"
          onConfirm={() => {
            stop();
            setConfirmStop(false);
          }}
          onCancel={() => setConfirmStop(false)}
        />
      )}
    </section>
  );
}
