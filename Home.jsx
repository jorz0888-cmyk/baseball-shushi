import { useMemo, useRef, useState } from "react";
import {
  useLocalStorage,
  STORAGE_KEYS,
  emptyWeek,
} from "./storage.js";
import { weekIdFor, formatWeekRange } from "./week.js";
import { fmtPoints } from "./aggregate.js";
import { settleAll } from "./settle.js";
import { useInstallPrompt } from "./useInstallPrompt.js";
import {
  downloadBackup,
  readBackupFile,
  applyBackup,
} from "./backup.js";
import ConfirmDialog from "./ConfirmDialog.jsx";

/**
 * Top screen — week summary + nav to management / daily input
 * / settlement / chart screens + backup-restore.
 */
export default function Home({ goTo }) {
  const todayWid = useMemo(() => weekIdFor(new Date()), []);
  const [customers] = useLocalStorage(STORAGE_KEYS.customers, []);
  const [teams] = useLocalStorage(STORAGE_KEYS.teams, []);
  const [weeks] = useLocalStorage(STORAGE_KEYS.weeks, {});
  const { canInstall, install } = useInstallPrompt();

  const weekData = weeks[todayWid] ?? emptyWeek();
  const settled = useMemo(
    () => settleAll(weekData, customers),
    [weekData, customers],
  );

  // お店視点: 全顧客の合算を符号反転（顧客の勝ち = 店の負け）
  const shopRow = useMemo(() => {
    let plus = 0;
    let minus = 0;
    let total = 0;
    for (const { settlement } of settled) {
      plus += settlement.plusSum;
      minus += settlement.minusSum;
      total += settlement.weekTotal;
    }
    return {
      shopPlus: -minus,
      shopMinus: -plus,
      shopTotal: -total,
    };
  }, [settled]);

  // ─── Backup / Restore state ───────────────────────────────────────────
  const fileInputRef = useRef(null);
  const [pendingRestore, setPendingRestore] = useState(null);
  const [restoreError, setRestoreError] = useState(null);

  async function handleRestoreSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 同じファイルを再選択できるよう reset
    if (!file) return;
    try {
      const parsed = await readBackupFile(file);
      setRestoreError(null);
      setPendingRestore(parsed);
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : String(err));
      setPendingRestore(null);
    }
  }

  function confirmRestore() {
    if (!pendingRestore) return;
    applyBackup(pendingRestore);
    // useLocalStorage は外部書き換えを検知しないので、ページリロードで
    // React 側を再初期化する。
    window.location.reload();
  }

  return (
    <div className="app">
      <header>
        <h1>野球収支計算機</h1>
        <p className="meta">{todayWid}</p>
      </header>

      <main>
        <section className="card">
          <h2>顧客の週間収支（{formatWeekRange(todayWid)}）</h2>
          {customers.length === 0 ? (
            <p className="empty">
              顧客が未登録です。下のボタンから登録してください。
            </p>
          ) : (
            <table className="summary-table summary-table-3col">
              <thead>
                <tr>
                  <th>顧客名</th>
                  <th className="num">＋合計</th>
                  <th className="num">−合計</th>
                  <th className="num">週合計</th>
                </tr>
              </thead>
              <tbody>
                {settled.map(({ customer, settlement }) => {
                  const { plusSum, minusSum, weekTotal } = settlement;
                  const totalCls =
                    weekTotal > 0
                      ? "plus"
                      : weekTotal < 0
                        ? "minus"
                        : "neutral";
                  const totalSign =
                    weekTotal > 0 ? "+" : weekTotal < 0 ? "−" : "±";
                  return (
                    <tr key={customer.id}>
                      <td>{customer.name}</td>
                      <td className="num plus">
                        {plusSum > 0 ? `+${fmtPoints(plusSum)}` : "0"}
                      </td>
                      <td className="num minus">
                        {minusSum < 0
                          ? `−${fmtPoints(Math.abs(minusSum))}`
                          : "0"}
                      </td>
                      <td className={`num ${totalCls}`}>
                        {weekTotal === 0
                          ? "±0"
                          : `${totalSign}${fmtPoints(Math.abs(weekTotal))}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="shop-row">
                  <td>お店</td>
                  <td className="num plus">
                    {shopRow.shopPlus > 0
                      ? `+${fmtPoints(shopRow.shopPlus)}`
                      : "0"}
                  </td>
                  <td className="num minus">
                    {shopRow.shopMinus < 0
                      ? `−${fmtPoints(Math.abs(shopRow.shopMinus))}`
                      : "0"}
                  </td>
                  <td
                    className={`num ${
                      shopRow.shopTotal > 0
                        ? "plus"
                        : shopRow.shopTotal < 0
                          ? "minus"
                          : "neutral"
                    }`}
                  >
                    {shopRow.shopTotal === 0
                      ? "±0"
                      : `${shopRow.shopTotal > 0 ? "+" : "−"}${fmtPoints(
                          Math.abs(shopRow.shopTotal),
                        )}`}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
          <p className="hint" style={{ textAlign: "left", margin: "12px 0 0" }}>
            ※ 試合結果が未入力の試合は週間合計に含まれません<br />
            ※ お店行は顧客全員の合算を反転（顧客の勝ち = 店の負け）
          </p>
        </section>

        <section className="card">
          <h2>入力 / 集計</h2>
          <div className="nav-grid">
            <button className="nav-tile" onClick={() => goTo("daily")}>
              <span className="nav-icon">📅</span>
              <span className="nav-label">日別入力</span>
              <span className="nav-count">月〜日 グリッド</span>
            </button>
            <button className="nav-tile" onClick={() => goTo("settlement")}>
              <span className="nav-icon">📊</span>
              <span className="nav-label">週間精算</span>
              <span className="nav-count">B収支式</span>
            </button>
            <button className="nav-tile" onClick={() => goTo("chart")}>
              <span className="nav-icon">📈</span>
              <span className="nav-label">月間グラフ</span>
              <span className="nav-count">顧客別 折れ線</span>
            </button>
          </div>
        </section>

        <section className="card">
          <h2>管理</h2>
          <div className="nav-grid">
            <button className="nav-tile" onClick={() => goTo("customers")}>
              <span className="nav-icon">👥</span>
              <span className="nav-label">顧客管理</span>
              <span className="nav-count">{customers.length} 名</span>
            </button>
            <button className="nav-tile" onClick={() => goTo("teams")}>
              <span className="nav-icon">⚾</span>
              <span className="nav-label">チーム管理</span>
              <span className="nav-count">{teams.length} チーム</span>
            </button>
          </div>
        </section>

        <section className="card">
          <h2>データ管理</h2>
          <div className="backup-buttons">
            <button className="primary backup-btn" onClick={downloadBackup}>
              📥 データをバックアップ
            </button>
            <button
              className="backup-btn restore-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              📤 データを復元
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleRestoreSelected}
              style={{ display: "none" }}
            />
          </div>
          {restoreError && <p className="error">{restoreError}</p>}
          <p className="hint" style={{ textAlign: "left", margin: "12px 0 0" }}>
            JSON ファイルで端末間移行・バックアップが可能。<br />
            復元時は既存データを上書きします（事前にバックアップ推奨）。
          </p>
        </section>

        {canInstall && (
          <section className="card install-card">
            <h2>ホーム画面に追加</h2>
            <p className="empty" style={{ marginBottom: 12 }}>
              アプリのようにフルスクリーンで起動できます。
            </p>
            <button className="primary install-btn" onClick={install}>
              📱 ホーム画面に追加する
            </button>
          </section>
        )}

        <p className="hint">v1.0 — 全機能完成 ✓</p>
      </main>

      {pendingRestore && (
        <ConfirmDialog
          message={`バックアップを読み込みます。\n作成日時: ${
            pendingRestore.exportedAt?.slice(0, 16).replace("T", " ") ?? "不明"
          }\n\n既存データを上書きしますか？\nこの操作は取り消せません。`}
          confirmLabel="上書きする"
          onConfirm={confirmRestore}
          onCancel={() => setPendingRestore(null)}
        />
      )}
    </div>
  );
}
