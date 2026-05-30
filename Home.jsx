import { useMemo } from "react";
import {
  useLocalStorage,
  STORAGE_KEYS,
  emptyWeek,
} from "./storage.js";
import { weekIdFor } from "./week.js";
import { aggregateWeek, fmtPoints } from "./aggregate.js";

/**
 * Top screen — week summary + nav to management / daily input screens.
 * Weekly totals from aggregateWeek are now live as of Stage 3.
 */
export default function Home({ goTo }) {
  const todayWid = useMemo(() => weekIdFor(new Date()), []);
  const [customers] = useLocalStorage(STORAGE_KEYS.customers, []);
  const [teams] = useLocalStorage(STORAGE_KEYS.teams, []);
  const [weeks] = useLocalStorage(STORAGE_KEYS.weeks, {});

  const weekData = weeks[todayWid] ?? emptyWeek();
  const weeklyTotals = useMemo(
    () => aggregateWeek(weekData, customers),
    [weekData, customers],
  );

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
            <table className="summary-table">
              <thead>
                <tr>
                  <th>顧客名</th>
                  <th className="num">週間収支</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => {
                  const v = weeklyTotals[c.id] ?? 0;
                  const cls = v > 0 ? "plus" : v < 0 ? "minus" : "neutral";
                  const sign = v > 0 ? "+" : v < 0 ? "−" : "±";
                  return (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td className={`num ${cls}`}>
                        {v === 0 ? "±0" : `${sign}${fmtPoints(Math.abs(v))}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="hint" style={{ textAlign: "left", margin: "12px 0 0" }}>
            ※ 試合結果が未入力の試合は週間合計に含まれません
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

        <p className="hint">Stage 4 完了 — 週間精算 + B収支式</p>
      </main>
    </div>
  );
}
