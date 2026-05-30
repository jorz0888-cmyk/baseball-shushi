// Verifies handicap.js against the v2 spec tables (no external deps).
// Run: node scripts/verify-handicap.mjs

import {
  calcHandicapResult,
  parseHandicap,
  applySide,
  pointsFromRate,
  rateLabel,
} from "../handicap.js";

let failed = 0;
let passed = 0;

function expect(actual, expected, label) {
  if (actual === expected) {
    passed++;
    return;
  }
  failed++;
  console.log(
    `  ✗ ${label}  expected=${expected}  actual=${actual}`,
  );
}

// ---------- v2 spec table: ベース0 (0.1〜0.9) ---------------------------------
console.log("\n■ ベース0 (0.1 〜 0.9)");
const base0 = [
  // [handi, 負け, 引分, 1点差勝, 2点差勝, 3点差以上]
  ["0.1", -100, -10, 90, 100, 100],
  ["0.2", -100, -20, 80, 100, 100],
  ["0.3", -100, -30, 70, 100, 100],
  ["0.4", -100, -40, 60, 100, 100],
  ["0.5", -100, -50, 50, 100, 100],
  ["0.6", -100, -60, 40, 100, 100],
  ["0.7", -100, -70, 30, 100, 100],
  ["0.8", -100, -80, 20, 100, 100],
  ["0.9", -100, -90, 10, 100, 100],
];
for (const [h, lose, draw, w1, w2, w3] of base0) {
  expect(calcHandicapResult(h, -1), lose, `${h} 負け`);
  expect(calcHandicapResult(h, 0), draw, `${h} 引分`);
  expect(calcHandicapResult(h, 1), w1, `${h} 1点差勝`);
  expect(calcHandicapResult(h, 2), w2, `${h} 2点差勝`);
  expect(calcHandicapResult(h, 3), w3, `${h} 3点差勝`);
}

// ---------- v2 spec table: ベース1 (1 〜 1.9) ---------------------------------
console.log("\n■ ベース1 (1 〜 1.9)");
const base1 = [
  ["1", -100, -100, 0, 100, 100],
  ["1.1", -100, -100, -10, 100, 100],
  ["1.2", -100, -100, -20, 100, 100],
  ["1.3", -100, -100, -30, 100, 100],
  ["1.4", -100, -100, -40, 100, 100],
  ["1.5", -100, -100, -50, 100, 100],
  ["1.6", -100, -100, -60, 100, 100],
  ["1.7", -100, -100, -70, 100, 100],
  ["1.8", -100, -100, -80, 100, 100],
  ["1.9", -100, -100, -90, 100, 100],
];
for (const [h, lose, draw, w1, w2, w3] of base1) {
  expect(calcHandicapResult(h, -1), lose, `${h} 負け`);
  expect(calcHandicapResult(h, 0), draw, `${h} 引分`);
  expect(calcHandicapResult(h, 1), w1, `${h} 1点差勝`);
  expect(calcHandicapResult(h, 2), w2, `${h} 2点差勝`);
  expect(calcHandicapResult(h, 3), w3, `${h} 3点差勝`);
}

// ---------- v2 spec table: 半値1 (1半 〜 1半9) --------------------------------
console.log("\n■ 半値1 (1半 〜 1半9)");
const han1 = [
  ["1半", -100, -100, -100, 100, 100],
  ["1半1", -100, -100, -100, 90, 100],
  ["1半2", -100, -100, -100, 80, 100],
  ["1半3", -100, -100, -100, 70, 100],
  ["1半4", -100, -100, -100, 60, 100],
  ["1半5", -100, -100, -100, 50, 100],
  ["1半6", -100, -100, -100, 40, 100],
  ["1半7", -100, -100, -100, 30, 100],
  ["1半8", -100, -100, -100, 20, 100],
  ["1半9", -100, -100, -100, 10, 100],
];
for (const [h, lose, draw, w1, w2, w3] of han1) {
  expect(calcHandicapResult(h, -1), lose, `${h} 負け`);
  expect(calcHandicapResult(h, 0), draw, `${h} 引分`);
  expect(calcHandicapResult(h, 1), w1, `${h} 1点差勝`);
  expect(calcHandicapResult(h, 2), w2, `${h} 2点差勝`);
  expect(calcHandicapResult(h, 3), w3, `${h} 3点差勝`);
}

// ---------- ベース2 (sampling) ------------------------------------------------
console.log("\n■ ベース2 (sampling)");
expect(calcHandicapResult("2", -1), -100, "2 負け");
expect(calcHandicapResult("2", 0), -100, "2 引分");
expect(calcHandicapResult("2", 1), -100, "2 1点差勝");
expect(calcHandicapResult("2", 2), 0, "2 2点差勝 → 勝負無し");
expect(calcHandicapResult("2", 3), 100, "2 3点差勝 → 丸勝ち");
expect(calcHandicapResult("2.1", 2), -10, "2.1 2点差勝 → 1分負け");
expect(calcHandicapResult("2.3", 2), -30, "2.3 2点差勝 → 3分負け");
expect(calcHandicapResult("2.5", 2), -50, "2.5 2点差勝 → 5分負け");

// ---------- 半値2 (sampling) -------------------------------------------------
console.log("\n■ 半値2 (sampling)");
expect(calcHandicapResult("2半", 2), -100, "2半 2点差勝 → 丸負け");
expect(calcHandicapResult("2半", 3), 100, "2半 3点差勝 → 丸勝ち");
expect(calcHandicapResult("2半3", 3), 70, "2半3 3点差勝 → 7分勝ち");
expect(calcHandicapResult("2半7", 3), 30, "2半7 3点差勝 → 3分勝ち");

// ---------- parseHandicap ----------------------------------------------------
console.log("\n■ parseHandicap");
const cases = [
  ["0.3", { base: 0, fraction: 3, isHan: false }],
  ["0.7", { base: 0, fraction: 7, isHan: false }],
  ["1", { base: 1, fraction: 0, isHan: false }],
  ["1.5", { base: 1, fraction: 5, isHan: false }],
  ["1.9", { base: 1, fraction: 9, isHan: false }],
  ["1半", { base: 1, fraction: 0, isHan: true }],
  ["1半3", { base: 1, fraction: 3, isHan: true }],
  ["2半7", { base: 2, fraction: 7, isHan: true }],
];
for (const [input, expected] of cases) {
  const got = parseHandicap(input);
  const ok =
    got.base === expected.base &&
    got.fraction === expected.fraction &&
    got.isHan === expected.isHan;
  if (ok) {
    passed++;
  } else {
    failed++;
    console.log(
      `  ✗ parseHandicap(${input}) got=${JSON.stringify(got)} expected=${JSON.stringify(expected)}`,
    );
  }
}

// ---------- applySide + pointsFromRate ---------------------------------------
console.log("\n■ side reversal + points");
expect(applySide(70, "give"), 70, "give side: +70 → +70");
expect(applySide(70, "receive"), -70, "receive side: +70 → -70");
expect(applySide(-30, "receive"), 30, "receive side: -30 → +30");
expect(applySide(0, "receive"), 0, "receive side: 0 → 0 (勝負無しは不変)");
expect(pointsFromRate(100, 70), 70, "100pt × 7分勝ち = +70pt");
expect(pointsFromRate(50, -30), -15, "50pt × 3分負け = -15pt");

// ---------- rate labels ------------------------------------------------------
console.log("\n■ rate labels (visual sanity check)");
const labelCases = [
  [100, "丸勝ち"],
  [-100, "丸負け"],
  [0, "勝負無し"],
  [70, "7分勝ち"],
  [-30, "3分負け"],
  [50, "5分勝ち"],
];
for (const [rate, expected] of labelCases) {
  const got = rateLabel(rate);
  if (got === expected) {
    passed++;
  } else {
    failed++;
    console.log(`  ✗ rateLabel(${rate}) got="${got}" expected="${expected}"`);
  }
}

console.log(
  `\n${failed === 0 ? "✓ ALL PASS" : `✗ ${failed} FAIL`}  (${passed}/${passed + failed})`,
);
process.exit(failed === 0 ? 0 : 1);
