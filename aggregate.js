/**
 * 1日 / 1週間の集計関数。
 *
 * セルの確定値は「賭けポイント × (換算率 / 100)」。
 * 換算率は handicap.js の calcHandicapResult が算出し、受け側は
 * applySide で符号反転する。
 *
 * 試合結果が未入力 (game.result == null) のセルは null を返す。
 * 集計時は null セルを 0 として扱わず、合計にも含めない（合計が
 * 「未確定の試合がある」状態を可視化するのは UI 側の仕事）。
 */

import { DAY_KEYS } from "./week.js";
import {
  applySide,
  calcHandicapResult,
  pointsFromRate,
} from "./handicap.js";
import { apply2bu } from "./rates.js";

/**
 * 試合結果から「出し側視点の得失点差」を導出。
 * @param {{won: boolean, draw: boolean, scoreDiff: number} | null} result
 * @returns {number | null} 正=出し側勝, 0=引分, 負=出し側負, null=未入力
 */
function scoreDiffFromResult(result) {
  if (!result) return null;
  if (result.draw) return 0;
  const abs = Math.abs(result.scoreDiff ?? 0);
  return result.won ? abs : -abs;
}

/**
 * 1ベットの確定ポイント値を計算。試合結果が未入力なら null。
 *
 * @param {{points: number, side: "give"|"receive"}} bet
 * @param {{handicap: string, result: any}} game
 * @returns {number | null}
 */
export function betCellValue(bet, game) {
  if (!bet) return null;
  const scoreDiff = scoreDiffFromResult(game?.result);
  if (scoreDiff === null) return null;
  const baseRate = calcHandicapResult(game.handicap, scoreDiff);
  const rate = applySide(baseRate, bet.side);
  return pointsFromRate(bet.points, rate);
}

/**
 * 1日分の集計。
 *
 * @param {{games: any[], bets: any[]}} dayData
 * @param {{id:string, name:string}[]} customers
 * @returns {{
 *   cells: Record<string, Record<string, number | null>>,
 *   rowTotals: Record<string, number>,
 *   colTotals: Record<string, number>,
 *   grandTotal: number
 * }}
 */
export function aggregateDay(dayData, customers) {
  const games = dayData?.games ?? [];
  const bets = dayData?.bets ?? [];

  // (customerId, gameId) → bet を高速参照するためのインデックス
  const betIndex = new Map();
  for (const b of bets) {
    betIndex.set(`${b.customerId}::${b.gameId}`, b);
  }

  /** @type {Record<string, Record<string, number | null>>} */
  const cells = {};
  /** @type {Record<string, number>} */
  const rowTotals = {};
  /** @type {Record<string, number>} */
  const rowTotals2bu = {};
  /** @type {Record<string, number>} */
  const colTotals = {};
  let grandTotal = 0;

  // Initialize colTotals so empty columns appear as 0 (not undefined).
  for (const g of games) colTotals[g.id] = 0;

  for (const c of customers) {
    cells[c.id] = {};
    rowTotals[c.id] = 0;
    // 行ごとに + / − を分けて 2部有り計算に使う
    let rowPlus = 0;
    let rowMinus = 0;
    for (const g of games) {
      const bet = betIndex.get(`${c.id}::${g.id}`);
      const value = bet ? betCellValue(bet, g) : null;
      cells[c.id][g.id] = value;
      if (value != null) {
        rowTotals[c.id] += value;
        if (value > 0) rowPlus += value;
        else if (value < 0) rowMinus += value;
        colTotals[g.id] += value;
        grandTotal += value;
      }
    }
    rowTotals2bu[c.id] = apply2bu(rowPlus, rowMinus);
  }

  return { cells, rowTotals, rowTotals2bu, colTotals, grandTotal };
}

/**
 * 1週間分の集計。各日の aggregateDay を呼んで顧客別に合算。
 * 既に集計済みの dayAgg を渡すことはできないが、頻度が高い場合は
 * useMemo + 日ごと再計算で十分軽い（顧客 ~50, 試合 ~10, 7日）。
 *
 * @param {{[day: string]: any}} weekData
 * @param {{id:string, name:string}[]} customers
 * @returns {Record<string, number>}  — customerId → 週間合計
 */
export function aggregateWeek(weekData, customers) {
  /** @type {Record<string, number>} */
  const totals = {};
  for (const c of customers) totals[c.id] = 0;
  if (!weekData) return totals;
  for (const dk of DAY_KEYS) {
    const day = weekData[dk];
    if (!day) continue;
    const { rowTotals } = aggregateDay(day, customers);
    for (const c of customers) {
      totals[c.id] += rowTotals[c.id] ?? 0;
    }
  }
  return totals;
}

/**
 * ポイント値の表示文字列。整数なら小数点なし、小数なら1桁、0 は "0"。
 * 符号は呼び出し側で付ける（色クラスとセットで使うため）。
 *
 * @param {number} v
 * @returns {string}
 */
export function fmtPoints(v) {
  if (v === 0) return "0";
  const rounded = Math.round(v * 10) / 10;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(1);
}
