import { useMemo, useState } from "react";
import {
  useLocalStorage,
  STORAGE_KEYS,
  emptyWeek,
} from "./storage.js";
import {
  weekIdFor,
  shiftWeekId,
  DAY_KEYS,
  DAY_LABELS_JP,
} from "./week.js";
import { fmtPoints } from "./aggregate.js";
import {
  settleAll,
  SETTLE_RATES,
  FIRST_HALF_DAYS,
  SECOND_HALF_DAYS,
} from "./settle.js";

/**
 * 週間精算画面。
 *
 * - 上部: 前週 / 今週ボタン / 翌週 のナビ
 * - 顧客ごとに 1 カード
 *   - 各日 row total (月〜日)
 *   - 前半 / 後半 小計
 *   - 週合計 + プラス合計 / マイナス合計
 *   - 2部有り合計（緑） / 2部無し合計（オレンジ）
 */
export default function WeeklySettlementScreen({ back }) {
  const todayWid = useMemo(() => weekIdFor(new Date()), []);
  const [currentWid, setCurrentWid] = useState(todayWid);

  const [weeks] = useLocalStorage(STORAGE_KEYS.weeks, {});
  const [customers] = useLocalStorage(STORAGE_KEYS.customers, []);

  const weekData = weeks[currentWid] ?? emptyWeek();
  const settled = useMemo(
    () => settleAll(weekData, customers),
    [weekData, customers],
  );
  // お店視点: 全顧客の合算を反転（顧客の勝ち = 店の負け）
  const shopSummary = useMemo(() => {
    let weekTotal = 0;
    let with2bu = 0;
    let without2bu = 0;
    for (const { settlement } of settled) {
      weekTotal += settlement.weekTotal;
      with2bu += settlement.with2bu;
      without2bu += settlement.without2bu;
    }
    return {
      weekTotal: -weekTotal,
      with2bu: -with2bu,
      without2bu: -without2bu,
    };
  }, [settled]);

  return (
    <div className="app">
      <header className="screen-header">
        <button className="back" onClick={back}>← 戻る</button>
        <h1>週間精算</h1>
        <p className="meta">B収支式</p>
      </header>

      <nav className="week-nav">
        <button onClick={() => setCurrentWid(shiftWeekId(currentWid, -1))}>
          ◀ 前週
        </button>
        <span className="week-label">
          {currentWid}
          {currentWid !== todayWid && (
            <button
              className="this-week-link"
              onClick={() => setCurrentWid(todayWid)}
            >
              今週へ
            </button>
          )}
        </span>
        <button onClick={() => setCurrentWid(shiftWeekId(currentWid, 1))}>
          翌週 ▶
        </button>
      </nav>

      <main>
        {customers.length === 0 ? (
          <section className="card">
            <p className="empty">顧客が未登録です</p>
          </section>
        ) : (
          <>
            <section className="card formula-card">
              <h2>B収支式</h2>
              <ul className="formula-list">
                <li>
                  <span className="formula-label plus">2部有り合計</span>
                  <span className="formula-detail">
                    プラス × {SETTLE_RATES.with2bu.plus} ＋ マイナス × {SETTLE_RATES.with2bu.minus}
                  </span>
                </li>
                <li>
                  <span className="formula-label orange">2部無し合計</span>
                  <span className="formula-detail">
                    プラス × {SETTLE_RATES.without2bu.plus} ＋ マイナス × {SETTLE_RATES.without2bu.minus}（そのまま）
                  </span>
                </li>
              </ul>
              <p className="hint" style={{ textAlign: "left", margin: "8px 0 0" }}>
                ※ プラス / マイナスは <strong>日単位</strong>（月〜日 各 row total の符号）で振り分け
              </p>
            </section>

            <section className="card shop-summary-card">
              <h2>🏪 お店の収支（週間）</h2>
              <p
                className="hint"
                style={{ margin: "0 0 12px", textAlign: "left" }}
              >
                顧客全員の合算を反転 ── 顧客の勝ちが店の負け、顧客の負けが店の勝ち
              </p>
              <dl className="settlement-rows">
                <div className="row row-strong">
                  <dt>週合計</dt>
                  <dd className="num">
                    <Sn value={shopSummary.weekTotal} strong />
                  </dd>
                </div>
                <div className="row row-big">
                  <dt>2部有り合計</dt>
                  <dd className="num">
                    <SnBig value={shopSummary.with2bu} />
                  </dd>
                </div>
                <div className="row row-big">
                  <dt>2部無し合計</dt>
                  <dd className="num">
                    <SnBig value={shopSummary.without2bu} fixedColor="orange" />
                  </dd>
                </div>
              </dl>
            </section>

            {settled.map(({ customer, settlement }) => (
              <CustomerCard
                key={customer.id}
                customer={customer}
                settlement={settlement}
              />
            ))}
          </>
        )}
      </main>
    </div>
  );
}

function CustomerCard({ customer, settlement }) {
  const {
    dailyTotals,
    firstHalfSubtotal,
    secondHalfSubtotal,
    weekTotal,
    plusSum,
    minusSum,
    with2bu,
    without2bu,
  } = settlement;

  return (
    <section className="card customer-card">
      <h2 className="customer-card-name">{customer.name}</h2>

      <table className="day-totals-table">
        <thead>
          <tr>
            {DAY_KEYS.map((dk, i) => (
              <th key={dk}>{DAY_LABELS_JP[i]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {DAY_KEYS.map((dk) => (
              <td key={dk} className="num">
                <Sn value={dailyTotals[dk]} small />
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      <dl className="settlement-rows">
        <div className="row">
          <dt>
            前半 ({FIRST_HALF_DAYS.map((d, i) => DAY_LABELS_JP[i]).join("")}) 小計
          </dt>
          <dd className="num"><Sn value={firstHalfSubtotal} /></dd>
        </div>
        <div className="row">
          <dt>
            後半 ({SECOND_HALF_DAYS.map((d, i) => DAY_LABELS_JP[3 + i]).join("")}) 小計
          </dt>
          <dd className="num"><Sn value={secondHalfSubtotal} /></dd>
        </div>
        <div className="row row-strong">
          <dt>週合計</dt>
          <dd className="num"><Sn value={weekTotal} strong /></dd>
        </div>

        <hr className="settlement-divider" />

        <div className="row">
          <dt>プラス合計（日単位）</dt>
          <dd className="num"><Sn value={plusSum} /></dd>
        </div>
        <div className="row">
          <dt>マイナス合計（日単位）</dt>
          <dd className="num"><Sn value={minusSum} /></dd>
        </div>

        <hr className="settlement-divider" />

        <div className="row row-big">
          <dt>2部有り合計</dt>
          <dd className="num">
            {/* 値の符号に応じて緑（プラス）/赤（マイナス）/グレー（0） */}
            <SnBig value={with2bu} />
          </dd>
        </div>
        <div className="row row-big">
          <dt>2部無し合計</dt>
          <dd className="num">
            {/* 仕様: 常にオレンジ（プラスでもマイナスでも） */}
            <SnBig value={without2bu} fixedColor="orange" />
          </dd>
        </div>
      </dl>
    </section>
  );
}

/** 通常表示（符号付き、色付き）。"Sn" = "signed number" */
function Sn({ value, small = false, strong = false }) {
  if (value === 0) {
    return (
      <span
        className={`neutral${small ? " small" : ""}${strong ? " strong" : ""}`}
      >
        ±0
      </span>
    );
  }
  const cls = value > 0 ? "plus" : "minus";
  const sign = value > 0 ? "+" : "−";
  return (
    <span className={`${cls}${small ? " small" : ""}${strong ? " strong" : ""}`}>
      {sign}
      {fmtPoints(Math.abs(value))}
    </span>
  );
}

/**
 * 2部有り / 2部無し合計用の大きいサイズ。
 *
 * - fixedColor 未指定: 値の符号で plus/minus/neutral を自動選択
 *   （2部有り合計 = マイナスなら赤、プラスなら緑）
 * - fixedColor 指定: その色固定（2部無し合計 = 常にオレンジ）
 */
function SnBig({ value, fixedColor }) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  const cls = fixedColor
    ? fixedColor
    : value > 0
      ? "plus"
      : value < 0
        ? "minus"
        : "neutral";
  return (
    <span className={`big-result ${cls}`}>
      {sign}
      {fmtPoints(Math.abs(value))}
    </span>
  );
}
