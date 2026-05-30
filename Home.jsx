import { useMemo } from "react";
import { useLocalStorage, STORAGE_KEYS } from "./storage.js";
import { weekIdFor } from "./week.js";

/**
 * Top screen — week summary placeholder + nav to management screens.
 * Weekly settlement values are still "—" in Stage 2; they get wired up
 * in Stage 3 once the daily grid + handicap calc are in place.
 */
export default function Home({ goTo }) {
  const todayWid = useMemo(() => weekIdFor(new Date()), []);
  const [customers] = useLocalStorage(STORAGE_KEYS.customers, []);
  const [teams] = useLocalStorage(STORAGE_KEYS.teams, []);

  return (
    <div className="app">
      <header>
        <h1>野球収支計算機</h1>
        <p className="meta">{todayWid}</p>
      </header>

      <main>
        <section className="card">
          <h2>顧客の週間収支</h2>
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
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td className="num neutral">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="hint" style={{ textAlign: "left", margin: "12px 0 0" }}>
            ※ Stage 3 で各日の入力と計算が入ります
          </p>
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

        <p className="hint">Stage 2 完了 — 顧客 / チーム管理</p>
      </main>
    </div>
  );
}
