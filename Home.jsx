import { useMemo } from "react";
import {
  useLocalStorage,
  STORAGE_KEYS,
  emptyWeek,
} from "./storage.js";
import { weekIdFor } from "./week.js";
import { fmtPoints } from "./aggregate.js";
import { settleAll } from "./settle.js";
import { useInstallPrompt } from "./useInstallPrompt.js";

/**
 * Top screen — week summary + nav to management / daily input screens.
 * Weekly totals from aggregateWeek are now live as of Stage 3.
 */
export default function Home({ goTo }) {
  const todayWid = useMemo(() => weekIdFor(new Date()), []);
  const [customers] = useLocalStorage(STORAGE_KEYS.customers, []);
  const [teams] = useLocalStorage(STORAGE_KEYS.teams, []);
  const [weeks] = useLocalStorage(STORAGE_KEYS.weeks, {});
  const { canInstall, install } = useInstallPrompt();

  const weekData = weeks[todayWid] ?? emptyWeek();
  // 週間収支は settle 経由で取得 → ＋合計 / −合計 / 週合計 を一覧
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
      // 顧客の負け (minusSum は負値) → お店のプラス
      shopPlus: -minus,
      // 顧客の勝ち (plusSum は正値) → お店のマイナス
      shopMinus: -plus,
      shopTotal: -total,
    };
  }, [settled]);

  return (
    <div className="app">
      <header>
        <h1>野球収支計算機</h1>
        <p className="meta">{todayWid}</p>
      </header>

      <main>
        <section className="card">
          <h2>顧客の週間収支（{todayWid}）</h2>
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
          <h2>入力</h2>
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
    </div>
  );
}
