import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useLocalStorage, STORAGE_KEYS, emptyWeek } from "./storage.js";
import { weekIdFor } from "./week.js";
import { settleCustomer } from "./settle.js";
import { fmtPoints } from "./aggregate.js";

/**
 * 月選択 + 顧客別 折れ線グラフ。
 *
 * - 月の中で「いずれかの日が含まれる ISO 週」を全て抽出 → X 軸ラベル
 *   は "W22" 等の週番号。
 * - 顧客ごとに 1 本ライン、ハッシュベースで決定論的に色を割当。
 * - 「収支タイプ」セグメントで weekTotal / 2分有り / 2分無し を切替。
 *   設定の好みで使い分けられる。
 */

const PALETTE = Object.freeze([
  "#2dd4a0", // brand plus
  "#f0605d", // brand minus
  "#e8a838", // brand orange
  "#60a5fa", // blue
  "#c084fc", // purple
  "#fcd34d", // yellow
  "#34d399", // emerald
  "#fb923c", // bright orange
  "#a78bfa", // violet
  "#22d3ee", // cyan
  "#f472b6", // pink
  "#84cc16", // lime
]);

/** 顧客 ID から決定論的に色を選ぶ (FNV-1a) */
function colorFor(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return PALETTE[h % PALETTE.length];
}

const VALUE_TYPES = [
  { key: "weekTotal", label: "週合計" },
  { key: "without2bu", label: "2分無し" },
  { key: "with2bu", label: "2分無し+2分" },
];

export default function MonthlyChartScreen({ back }) {
  const [customers] = useLocalStorage(STORAGE_KEYS.customers, []);
  const [weeks] = useLocalStorage(STORAGE_KEYS.weeks, {});

  const today = new Date();
  const [picked, setPicked] = useState(() => ({
    year: today.getFullYear(),
    month: today.getMonth() + 1,
  }));
  const [valueType, setValueType] = useState("weekTotal");

  // その月のいずれかの日を含む ISO 週を全て集める
  const weekIdsInMonth = useMemo(() => {
    const ids = new Set();
    const lastDay = new Date(picked.year, picked.month, 0).getDate();
    for (let d = 1; d <= lastDay; d++) {
      const date = new Date(picked.year, picked.month - 1, d);
      ids.add(weekIdFor(date));
    }
    return [...ids].sort();
  }, [picked]);

  const chartData = useMemo(() => {
    return weekIdsInMonth.map((wid) => {
      const weekData = weeks[wid] || emptyWeek();
      /** @type {Record<string, number | string>} */
      const row = { week: wid.slice(-3) }; // "W22"
      for (const c of customers) {
        const s = settleCustomer(weekData, c);
        row[c.name] = Number(s[valueType].toFixed(3));
      }
      return row;
    });
  }, [weekIdsInMonth, weeks, customers, valueType]);

  function shiftMonth(delta) {
    setPicked((prev) => {
      let m = prev.month + delta;
      let y = prev.year;
      while (m < 1) {
        m += 12;
        y -= 1;
      }
      while (m > 12) {
        m -= 12;
        y += 1;
      }
      return { year: y, month: m };
    });
  }

  function isThisMonth() {
    return picked.year === today.getFullYear() &&
      picked.month === today.getMonth() + 1;
  }

  // 全顧客が全週 0 / 未入力 ならデータなし扱い
  const hasAnyValue = useMemo(() => {
    for (const row of chartData) {
      for (const c of customers) {
        if (row[c.name] !== 0) return true;
      }
    }
    return false;
  }, [chartData, customers]);

  return (
    <div className="app">
      <header className="screen-header">
        <button className="back" onClick={back}>← 戻る</button>
        <h1>月間収支グラフ</h1>
        <p className="meta">{customers.length} 名</p>
      </header>

      <nav className="week-nav month-nav">
        <button onClick={() => shiftMonth(-1)}>◀ 前月</button>
        <span className="week-label">
          {picked.year}年 {picked.month}月
          {!isThisMonth() && (
            <button
              className="this-week-link"
              onClick={() =>
                setPicked({
                  year: today.getFullYear(),
                  month: today.getMonth() + 1,
                })
              }
            >
              今月へ
            </button>
          )}
        </span>
        <button onClick={() => shiftMonth(1)}>翌月 ▶</button>
      </nav>

      <main>
        <section className="card">
          <h2>収支タイプ</h2>
          <div className="value-type-row">
            {VALUE_TYPES.map((vt) => (
              <button
                key={vt.key}
                className={`value-type-btn${valueType === vt.key ? " active" : ""}`}
                onClick={() => setValueType(vt.key)}
              >
                {vt.label}
              </button>
            ))}
          </div>
        </section>

        <section className="card chart-card">
          <h2>
            {picked.year}年{picked.month}月 ({weekIdsInMonth.length}週)
          </h2>
          {customers.length === 0 ? (
            <p className="empty">顧客が未登録です</p>
          ) : weekIdsInMonth.length === 0 ? (
            <p className="empty">対象週がありません</p>
          ) : !hasAnyValue ? (
            <p className="empty">
              この月の入力データはまだありません。<br />
              日別入力で試合と結果を入れると折れ線が出ます。
            </p>
          ) : (
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height={320}>
                <LineChart
                  data={chartData}
                  margin={{ top: 8, right: 12, left: -8, bottom: 0 }}
                >
                  <CartesianGrid stroke="#2a3140" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="week"
                    stroke="#a8b0c0"
                    style={{ fontSize: 12 }}
                  />
                  <YAxis
                    stroke="#a8b0c0"
                    style={{ fontSize: 12 }}
                    tickFormatter={(v) =>
                      v === 0 ? "0" : v > 0 ? `+${v}` : String(v)
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#1a2030",
                      border: "1px solid #2a3140",
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#f3f5fa", fontWeight: 700 }}
                    formatter={(v) => fmtPoints(Number(v))}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                    iconType="line"
                  />
                  {customers.map((c) => (
                    <Line
                      key={c.id}
                      dataKey={c.name}
                      stroke={colorFor(c.id)}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      type="monotone"
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <p className="hint">
          ※ 「収支タイプ」を切り替えると、同じ月のグラフを別の集計方法で見られます
        </p>
      </main>
    </div>
  );
}
