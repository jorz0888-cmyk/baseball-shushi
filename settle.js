/**
 * 週間精算 — B収支式の適用。
 *
 * 1ユーザー 1週間分の確定値を、月〜日の row total から積み上げ、
 *  - 前半 (月火水) 小計
 *  - 後半 (木金土日) 小計
 *  - プラス合計 / マイナス合計（セル単位 = 1試合 1セルの符号で分離）
 *  - 2分有り合計  = プラス合計 × 0.92 + マイナス合計 × 0.98
 *  - 2分無し合計  = プラス合計 × 0.90 + マイナス合計 × 1.00（そのまま）
 *
 * 「プラスの合計 / マイナスの合計」の単位は **セル単位** (= 1試合 1セル
 * の確定値)。理由: B収支式は「1試合ずつ 2分計算 → 合算」の運用が正解で、
 * 日合計レベルで先に正負相殺してから 2分を掛けると、混在日 (例: 巨人勝ち
 * +10 / 阪神負け -5) のときに正しい値が出ない。
 *
 *   日単位 (誤): (10 + -5) × 0.92 = 5 × 0.92 = +4.6
 *   セル単位:    10 × 0.92 + (-5) × 0.98 = 9.2 - 4.9 = +4.3
 *
 * 前半/後半 小計と週合計は表示用なので、引き続き row total ベース
 * (= 単純合算) で算出。B収支式が触るのは plusSum / minusSum のみ。
 */

import { aggregateDay } from "./aggregate.js";
import { DAY_KEYS } from "./week.js";
import { SETTLE_RATES, apply2bu, applyNo2bu } from "./rates.js";

/** 前半 / 後半の曜日割り（v2 仕様書ステップ 4）*/
const FIRST_HALF_DAYS = Object.freeze(["monday", "tuesday", "wednesday"]);
const SECOND_HALF_DAYS = Object.freeze([
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

// SETTLE_RATES は rates.js から re-export（既存呼出側のため）
export { SETTLE_RATES };

/**
 * @typedef {Object} CustomerSettlement
 * @property {Record<string, number>} dailyTotals             — DAY_KEY -> row total (単純合計)
 * @property {Record<string, number>} dailyCumulativeNo2bu    — DAY_KEY -> その日までの累計 (2分無し適用)
 * @property {number} firstHalfSubtotal            — 前半 (月火水) 小計 (raw simple sum、後方互換)
 * @property {number} secondHalfSubtotal           — 後半 (木金土日) 小計 (raw simple sum、後方互換)
 * @property {number} firstHalfSubtotalNo2bu       — 前半 (月火水) 小計 (2分無し適用)
 * @property {number} secondHalfSubtotalNo2bu      — 後半 (木金土日) 小計 (2分無し適用)
 * @property {number} weekTotal                    — 週間合計（単純合計、後方互換）
 * @property {number} plusSum                      — セル単位の正側合計（1試合=1セル）
 * @property {number} minusSum                     — セル単位の負側合計（負値）
 * @property {number} with2bu                      — 2分有り合計
 * @property {number} without2bu                   — 2分無し合計 (= 週合計の新仕様)
 * @property {number} bonus2bu                     — 2分だけ計算合計 (= with2bu − without2bu)
 */

/**
 * @param {{[day: string]: any}} weekData
 * @param {{id:string, name:string}} customer
 * @returns {CustomerSettlement}
 */
export function settleCustomer(weekData, customer) {
  /** @type {Record<string, number>} */
  const dailyTotals = {};
  /** @type {Record<string, number>} 各曜日「までの」累計に 2分無し式を適用した値 */
  const dailyCumulativeNo2bu = {};
  // セル単位の正負を週全体で累積する
  let plusSum = 0;
  let minusSum = 0;
  // 曜日表示用に「その日までの」累計を別途持つ
  let cumPlus = 0;
  let cumMinus = 0;
  // 前半 (月火水) / 後半 (木金土日) の plus/minus を別計上。
  // 半期小計に 2分無し式を適用するために必要。
  let firstHalfPlus = 0;
  let firstHalfMinus = 0;
  let secondHalfPlus = 0;
  let secondHalfMinus = 0;

  for (const dk of DAY_KEYS) {
    const isFirstHalf = FIRST_HALF_DAYS.includes(dk);
    const day = weekData?.[dk];
    if (!day) {
      dailyTotals[dk] = 0;
      // この曜日に試合無しでも、累計はそれまでの値を保つ (週内ずっと同じ値が並ぶ表示にする)
      dailyCumulativeNo2bu[dk] = applyNo2bu(cumPlus, cumMinus);
      continue;
    }
    const { rowTotals, cells } = aggregateDay(day, [customer]);
    dailyTotals[dk] = rowTotals[customer.id] ?? 0;

    // 1試合 = 1セル単位で正負を集計
    // 仕様: 「1試合ずつ計算を出さないとずれが出る」 — 日合計で先に
    // 相殺してから 2分を掛けると混在日でズレるため、セル単位で
    // 集計してから 2分式を適用する。
    const customerCells = cells[customer.id] ?? {};
    for (const gameId of Object.keys(customerCells)) {
      const v = customerCells[gameId];
      if (v == null) continue;
      if (v > 0) {
        plusSum += v;
        cumPlus += v;
        if (isFirstHalf) firstHalfPlus += v;
        else secondHalfPlus += v;
      } else if (v < 0) {
        minusSum += v;
        cumMinus += v;
        if (isFirstHalf) firstHalfMinus += v;
        else secondHalfMinus += v;
      }
    }

    // この曜日終了時点での累計に 2分無し (+×0.90 / −×1.00) を適用。
    // 例: 火曜まで +10、水曜セル −8 → 水曜表示は applyNo2bu(cumPlus, cumMinus) = +2
    dailyCumulativeNo2bu[dk] = applyNo2bu(cumPlus, cumMinus);
  }

  // 後方互換のため raw 単純合計の小計/週合計も計算しておく。表示側は基本的に
  // 2分無し版 (firstHalfSubtotalNo2bu / without2bu) を使う。
  const firstHalfSubtotal = FIRST_HALF_DAYS.reduce(
    (s, d) => s + dailyTotals[d],
    0,
  );
  const secondHalfSubtotal = SECOND_HALF_DAYS.reduce(
    (s, d) => s + dailyTotals[d],
    0,
  );
  const weekTotal = firstHalfSubtotal + secondHalfSubtotal;

  // 半期それぞれに 2分無し式を適用。線形性により
  //   firstHalfSubtotalNo2bu + secondHalfSubtotalNo2bu === without2bu
  // が常に成り立つ。
  const firstHalfSubtotalNo2bu = applyNo2bu(firstHalfPlus, firstHalfMinus);
  const secondHalfSubtotalNo2bu = applyNo2bu(secondHalfPlus, secondHalfMinus);

  const with2bu = apply2bu(plusSum, minusSum);
  const without2bu = applyNo2bu(plusSum, minusSum);
  // 「2分だけ」の取り分 = 2分有り − 2分無し
  // = + ×(0.92−0.90) + − ×(0.98−1.00) = + ×0.02 + − ×(−0.02)
  // 通常は常に >= 0 になる（プラスは加算、マイナスからは減算が逆方向）
  const bonus2bu = with2bu - without2bu;

  return {
    dailyTotals,
    dailyCumulativeNo2bu,
    firstHalfSubtotal,
    secondHalfSubtotal,
    firstHalfSubtotalNo2bu,
    secondHalfSubtotalNo2bu,
    weekTotal,
    plusSum,
    minusSum,
    with2bu,
    without2bu,
    bonus2bu,
  };
}

/**
 * 全ユーザー分の精算結果。
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
