/**
 * B収支 加重率。aggregate.js と settle.js の両方で参照するため、
 * 単独ファイルに切り出して循環依存を避けている。
 *
 * 計算式（v2 仕様書）:
 *   2部有り合計 = プラスの合計 × 0.92 + マイナスの合計 × 0.98
 *   2部無し合計 = プラスの合計 × 0.90 + マイナスの合計 × 1.00（そのまま）
 *
 * プラス / マイナスの分離は、呼び出し側の集計粒度で決まる
 * （日単位 / 行単位 / セル単位など）。
 */
export const SETTLE_RATES = Object.freeze({
  with2bu: Object.freeze({ plus: 0.92, minus: 0.98 }),
  without2bu: Object.freeze({ plus: 0.9, minus: 1.0 }),
});

/**
 * 2部有り合計を適用。
 * @param {number} plusSum   — 正の合計
 * @param {number} minusSum  — 負の合計（負値）
 * @returns {number}
 */
export function apply2bu(plusSum, minusSum) {
  return (
    plusSum * SETTLE_RATES.with2bu.plus + minusSum * SETTLE_RATES.with2bu.minus
  );
}

/**
 * 2部無し合計を適用。
 * @param {number} plusSum
 * @param {number} minusSum
 * @returns {number}
 */
export function applyNo2bu(plusSum, minusSum) {
  return (
    plusSum * SETTLE_RATES.without2bu.plus +
    minusSum * SETTLE_RATES.without2bu.minus
  );
}
