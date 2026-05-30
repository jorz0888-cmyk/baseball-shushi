/**
 * 週間精算 — B収支式の適用。
 *
 * 1顧客 1週間分の確定値を、月〜日の row total から積み上げ、
 *  - 前半 (月火水) 小計
 *  - 後半 (木金土日) 小計
 *  - プラス合計 / マイナス合計（日単位の符号で分離）
 *  - 2部有り合計  = プラス合計 × 0.92 + マイナス合計 × 0.98
 *  - 2部無し合計  = プラス合計 × 0.90 + マイナス合計 × 1.00（そのまま）
 *
 * 「プラスの合計 / マイナスの合計」の解釈は v2 仕様書では一義に定まら
 * ないため、ここでは **日単位** ── 1日 (=月〜日の各 row total) の符号で
 * 振り分ける方式を採用。理由: 仕様書ステップ4「週間合計 = 月〜日 7日
 * 分を合計」が日単位で集計するため、ステップ5の B収支式の入力も日単位
 * に揃えるのが自然。前半/後半 小計は「表示用」の見出しとして v2 仕様
 * 書に追加されたもので、B収支式の入力ではない。
 *
 * もし B収支式が「セル単位」「半単位」など別の入力単位を期待している
 * 場合は、本ファイルの plusSum/minusSum の集計部分だけ差し替えれば
 * 精算ロジックは追従する。UI 側は値を消費するだけ。
 */

import { aggregateDay } from "./aggregate.js";
import { DAY_KEYS } from "./week.js";

/** 前半 / 後半の曜日割り（v2 仕様書ステップ 4）*/
const FIRST_HALF_DAYS = Object.freeze(["monday", "tuesday", "wednesday"]);
const SECOND_HALF_DAYS = Object.freeze([
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

/** B収支 加重率（v2 仕様書ステップ 5）。差し替えは1箇所で完結。*/
export const SETTLE_RATES = Object.freeze({
  with2bu: Object.freeze({ plus: 0.92, minus: 0.98 }),
  without2bu: Object.freeze({ plus: 0.9, minus: 1.0 }),
});

/**
 * @typedef {Object} CustomerSettlement
 * @property {Record<string, number>} dailyTotals  — DAY_KEY -> row total
 * @property {number} firstHalfSubtotal            — 前半 (月火水) 小計
 * @property {number} secondHalfSubtotal           — 後半 (木金土日) 小計
 * @property {number} weekTotal                    — 週間合計（単純合計）
 * @property {number} plusSum                      — 正の日の合計
 * @property {number} minusSum                     — 負の日の合計（負値）
 * @property {number} with2bu                      — 2部有り合計
 * @property {number} without2bu                   — 2部無し合計
 */

/**
 * @param {{[day: string]: any}} weekData
 * @param {{id:string, name:string}} customer
 * @returns {CustomerSettlement}
 */
export function settleCustomer(weekData, customer) {
  /** @type {Record<string, number>} */
  const dailyTotals = {};
  for (const dk of DAY_KEYS) {
    const day = weekData?.[dk];
    if (!day) {
      dailyTotals[dk] = 0;
      continue;
    }
    const { rowTotals } = aggregateDay(day, [customer]);
    dailyTotals[dk] = rowTotals[customer.id] ?? 0;
  }

  const firstHalfSubtotal = FIRST_HALF_DAYS.reduce(
    (s, d) => s + dailyTotals[d],
    0,
  );
  const secondHalfSubtotal = SECOND_HALF_DAYS.reduce(
    (s, d) => s + dailyTotals[d],
    0,
  );
  const weekTotal = firstHalfSubtotal + secondHalfSubtotal;

  let plusSum = 0;
  let minusSum = 0;
  for (const dk of DAY_KEYS) {
    const v = dailyTotals[dk];
    if (v > 0) plusSum += v;
    else if (v < 0) minusSum += v;
  }

  const with2bu =
    plusSum * SETTLE_RATES.with2bu.plus +
    minusSum * SETTLE_RATES.with2bu.minus;
  const without2bu =
    plusSum * SETTLE_RATES.without2bu.plus +
    minusSum * SETTLE_RATES.without2bu.minus;

  return {
    dailyTotals,
    firstHalfSubtotal,
    secondHalfSubtotal,
    weekTotal,
    plusSum,
    minusSum,
    with2bu,
    without2bu,
  };
}

/**
 * 全顧客分の精算結果。
 * @param {{[day: string]: any}} weekData
 * @param {{id:string, name:string}[]} customers
 * @returns {{ customer: any, settlement: CustomerSettlement }[]}
 */
export function settleAll(weekData, customers) {
  return customers.map((c) => ({
    customer: c,
    settlement: settleCustomer(weekData, c),
  }));
}

export { FIRST_HALF_DAYS, SECOND_HALF_DAYS };
