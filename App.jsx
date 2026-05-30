import { useMemo } from "react";
import {
  useLocalStorage,
  STORAGE_KEYS,
} from "./storage.js";
import { weekIdFor } from "./week.js";

export default function App() {
  const todayId = useMemo(() => weekIdFor(new Date()), []);
  const [currentWeekId] = useLocalStorage("bb-calc-current-week", todayId);
  const [customers] = useLocalStorage(STORAGE_KEYS.customers, []);
  const [teams] = useLocalStorage(STORAGE_KEYS.teams, []);
  const [weeks] = useLocalStorage(STORAGE_KEYS.weeks, {});

  return (
    <div className="app">
      <header>
        <h1>野球収支計算機</h1>
        <p className="meta">Stage 1</p>
      </header>

      <main>
        <section className="card">
          <h2>セットアップ確認</h2>
          <dl className="kv">
            <dt>現在週</dt>
            <dd>
              <strong>{currentWeekId}</strong>
              {currentWeekId !== todayId && (
                <span className="neutral"> (今週: {todayId})</span>
              )}
            </dd>
            <dt>顧客数</dt>
            <dd>{customers.length}</dd>
            <dt>チーム数</dt>
            <dd>{teams.length}</dd>
            <dt>保存週</dt>
            <dd>{Object.keys(weeks).length}</dd>
          </dl>
        </section>

        <section className="card">
          <h2>次のステージ</h2>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.8 }}>
            <li>Stage 2: 顧客・チーム管理画面</li>
            <li>Stage 3: 日別入力グリッド + ハンデ計算</li>
            <li>Stage 4: 週間精算 + B収支式</li>
            <li>Stage 5: スマホ最適化・PWA仕上げ</li>
          </ol>
        </section>

        <p className="hint">
          Stage 1 完了 — scaffold / localStorage / handicap / week ライブラリ
        </p>
      </main>
    </div>
  );
}
