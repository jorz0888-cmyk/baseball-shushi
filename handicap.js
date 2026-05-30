/**
 * ハンデ × 試合結果 → 換算率（%）の計算ロジック。
 *
 * v2 仕様書「ハンデ計算の実装ロジック」をそのまま実装。
 * 受け側（弱いチーム）に賭けた場合は呼び出し側で符号反転。
 *
 * 戻り値の単位は %（-100 = 丸負け / 0 = 勝負無し / 100 = 丸勝ち）。
 * セル確定値 = 賭けたポイント × (戻り値 / 100)。
 */

/**
 * @typedef {Object} ParsedHandicap
 * @property {number} base       — ベース整数部
 * @property {number} fraction   — 端数 (0..9)
 * @property {boolean} isHan     — "半" 付きの値か
 */

/**
 * "0.3" / "1" / "1.5" / "1半" / "1半3" 等のハンデ文字列を構造化。
 * @param {string} h
 * @returns {ParsedHandicap}
 */
export function parseHandicap(h) {
  const s = String(h).trim();
  if (s.includes("半")) {
    const [head, tail] = s.split("半");
    return {
      base: parseInt(head, 10) || 0,
      fraction: tail ? parseInt(tail, 10) || 0 : 0,
      isHan: true,
    };
  }
  const num = parseFloat(s);
  if (!Number.isFinite(num)) {
    return { base: 0, fraction: 0, isHan: false };
  }
  const base = Math.floor(num);
  // floating-point math is unreliable for 0.1 increments — round explicitly.
  const fraction = Math.round((num - base) * 10);
  return { base, fraction, isHan: false };
}

/**
 * ハンデと試合結果から換算率を返す（出し側＝強いチーム視点）。
 *
 * @param {string} handicap   — ハンデ文字列
 * @param {number} scoreDiff  — 出し側の得失点差。正=勝ち, 0=引分, 負=負け
 * @returns {number}          — 換算率 %, -100..+100
 */
export function calcHandicapResult(handicap, scoreDiff) {
  const { base, fraction, isHan } = parseHandicap(handicap);

  // 負けた場合は必ず丸負け（ハンデにかかわらず）
  if (scoreDiff < 0) return -100;

  if (!isHan) {
    // 通常値（x.f 形式）
    if (base === 0) {
      // ベース0の特例：引分とその上の2箇所に「分」がかかる
      if (scoreDiff === 0) return -(fraction * 10); // f分負け
      if (scoreDiff === 1) return (10 - fraction) * 10; // (10-f)分勝ち
      return 100; // 2点差以上 → 丸勝ち
    }
    // ベース1以上の通常値
    if (scoreDiff < base) return -100; // 丸負け
    if (scoreDiff === base) {
      if (fraction === 0) return 0; // 勝負無し
      return -(fraction * 10); // f分負け
    }
    return 100; // 丸勝ち
  }

  // 半値（x半f 形式）
  if (scoreDiff <= base) return -100; // 丸負け
  if (scoreDiff === base + 1) {
    if (fraction === 0) return 100; // 丸勝ち
    return (10 - fraction) * 10; // (10-f)分勝ち
  }
  return 100; // 丸勝ち
}

/**
 * 受け側に賭けた場合の符号反転を適用。
 * 勝負無し（0）はそのまま、それ以外は符号を反転。
 *
 * @param {number} rate       — calcHandicapResult の戻り値
 * @param {"give" | "receive"} side
 * @returns {number}
 */
export function applySide(rate, side) {
  if (side === "receive") return -rate;
  return rate;
}

/**
 * セル確定値（ポイント）を計算。
 * @param {number} points     — 賭けたポイント
 * @param {number} rate       — 換算率 %
 * @returns {number}
 */
export function pointsFromRate(points, rate) {
  return (points * rate) / 100;
}

/**
 * UI 表示用ラベル。
 * @param {number} rate
 * @returns {string}
 */
export function rateLabel(rate) {
  if (rate === 100) return "丸勝ち";
  if (rate === -100) return "丸負け";
  if (rate === 0) return "勝負無し";
  if (rate > 0) return `${rate / 10}分勝ち`;
  return `${-rate / 10}分負け`;
}
