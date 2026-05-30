// Verifies aggregate.js end-to-end (handicap + aggregation).
// Run: node scripts/verify-aggregate.mjs

import {
  aggregateDay,
  aggregateWeek,
  betCellValue,
  fmtPoints,
} from "../aggregate.js";

let failed = 0;
let passed = 0;

function expect(actual, expected, label) {
  if (actual === expected) {
    passed++;
    return;
  }
  failed++;
  console.log(`  ✗ ${label}  expected=${expected}  actual=${actual}`);
}

function approxEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) < 1e-9;
}

function expectApprox(actual, expected, label) {
  if (approxEqual(actual, expected)) {
    passed++;
    return;
  }
  failed++;
  console.log(`  ✗ ${label}  expected≈${expected}  actual=${actual}`);
}

// ─── betCellValue ─────────────────────────────────────────────────────────
console.log("\n■ betCellValue");

// Game w/o result → null
expect(
  betCellValue(
    { customerId: "c1", gameId: "g1", points: 100, side: "give" },
    { id: "g1", teamId: "t1", handicap: "1.5", result: null },
  ),
  null,
  "no result → null",
);

// 100pt give, ハンデ 1.5, 出し側 1点差勝ち (= 5分負け = -50%) → -50
expectApprox(
  betCellValue(
    { customerId: "c1", gameId: "g1", points: 100, side: "give" },
    {
      id: "g1",
      teamId: "t1",
      handicap: "1.5",
      result: { won: true, draw: false, scoreDiff: 1 },
    },
  ),
  -50,
  "100pt 出 ハンデ1.5 1点差勝 → -50",
);

// 100pt receive, same game → +50 (符号反転)
expectApprox(
  betCellValue(
    { customerId: "c1", gameId: "g1", points: 100, side: "receive" },
    {
      id: "g1",
      teamId: "t1",
      handicap: "1.5",
      result: { won: true, draw: false, scoreDiff: 1 },
    },
  ),
  50,
  "100pt 受 ハンデ1.5 1点差勝 → +50",
);

// 100pt 出 ハンデ0.3 引分 (= 3分負け = -30%) → -30
expectApprox(
  betCellValue(
    { customerId: "c1", gameId: "g1", points: 100, side: "give" },
    {
      id: "g1",
      teamId: "t1",
      handicap: "0.3",
      result: { won: false, draw: true, scoreDiff: 0 },
    },
  ),
  -30,
  "100pt 出 ハンデ0.3 引分 → -30",
);

// 100pt 出 ハンデ1半 出し側負け (-100%) → -100
expectApprox(
  betCellValue(
    { customerId: "c1", gameId: "g1", points: 100, side: "give" },
    {
      id: "g1",
      teamId: "t1",
      handicap: "1半",
      result: { won: false, draw: false, scoreDiff: 5 },
    },
  ),
  -100,
  "100pt 出 ハンデ1半 出し側負け5点差 → -100 (丸負け)",
);

// 50pt 出 ハンデ1半3 2点差勝 (= 7分勝ち = +70%) → +35
expectApprox(
  betCellValue(
    { customerId: "c1", gameId: "g1", points: 50, side: "give" },
    {
      id: "g1",
      teamId: "t1",
      handicap: "1半3",
      result: { won: true, draw: false, scoreDiff: 2 },
    },
  ),
  35,
  "50pt 出 ハンデ1半3 2点差勝 → +35",
);

// ─── aggregateDay: empty ──────────────────────────────────────────────────
console.log("\n■ aggregateDay: empty inputs");
{
  const customers = [
    { id: "c1", name: "あ" },
    { id: "c2", name: "い" },
  ];
  const day = { games: [], bets: [] };
  const agg = aggregateDay(day, customers);
  expect(Object.keys(agg.cells).length, 2, "empty: 2 customers cells");
  expect(agg.rowTotals.c1, 0, "empty: row total c1 = 0");
  expect(agg.rowTotals.c2, 0, "empty: row total c2 = 0");
  expect(agg.grandTotal, 0, "empty: grand total = 0");
}

// ─── aggregateDay: one game, two customers ───────────────────────────────
console.log("\n■ aggregateDay: 2 customers × 1 game (with result)");
{
  const customers = [
    { id: "c1", name: "あ" },
    { id: "c2", name: "い" },
  ];
  // c1: 100pt 出. c2: 50pt 受.
  // ハンデ1, 1点差勝 → 出し側 勝負無し(0%) / 受け側 勝負無し(0%)
  const day = {
    games: [
      {
        id: "g1",
        teamId: "t1",
        handicap: "1",
        result: { won: true, draw: false, scoreDiff: 1 },
      },
    ],
    bets: [
      { customerId: "c1", gameId: "g1", points: 100, side: "give" },
      { customerId: "c2", gameId: "g1", points: 50, side: "receive" },
    ],
  };
  const agg = aggregateDay(day, customers);
  expectApprox(agg.cells.c1.g1, 0, "c1 cell = 0 (勝負無し)");
  expectApprox(agg.cells.c2.g1, 0, "c2 cell = 0 (勝負無し)");
  expectApprox(agg.rowTotals.c1, 0, "c1 row total = 0");
  expectApprox(agg.rowTotals.c2, 0, "c2 row total = 0");
  expectApprox(agg.colTotals.g1, 0, "g1 col total = 0");
  expectApprox(agg.grandTotal, 0, "grand total = 0");
}

// ─── aggregateDay: 3 games, mixed results ────────────────────────────────
console.log("\n■ aggregateDay: 2 customers × 3 games, mixed");
{
  const customers = [
    { id: "c1", name: "あ" },
    { id: "c2", name: "い" },
  ];
  // g1: ハンデ1.5 出し側 1点差勝ち (出=-50, 受=+50)
  // g2: ハンデ0.3 出し側 引分     (出=-30, 受=+30)
  // g3: 結果未入力                 (cell null, 合計に含めない)
  const day = {
    games: [
      {
        id: "g1",
        teamId: "t1",
        handicap: "1.5",
        result: { won: true, draw: false, scoreDiff: 1 },
      },
      {
        id: "g2",
        teamId: "t2",
        handicap: "0.3",
        result: { won: false, draw: true, scoreDiff: 0 },
      },
      { id: "g3", teamId: "t3", handicap: "2", result: null },
    ],
    bets: [
      // c1: 100 出 (g1), 50 受 (g2), 30 出 (g3 — but no result)
      { customerId: "c1", gameId: "g1", points: 100, side: "give" },
      { customerId: "c1", gameId: "g2", points: 50, side: "receive" },
      { customerId: "c1", gameId: "g3", points: 30, side: "give" },
      // c2: 100 受 (g1), 200 出 (g2)
      { customerId: "c2", gameId: "g1", points: 100, side: "receive" },
      { customerId: "c2", gameId: "g2", points: 200, side: "give" },
    ],
  };
  const agg = aggregateDay(day, customers);

  // c1 cells:
  //   g1: 100 × -50% = -50
  //   g2: 50 × applySide(-30%, "receive") = 50 × +30% = +15
  //   g3: null (未結果)
  expectApprox(agg.cells.c1.g1, -50, "c1.g1 = -50");
  expectApprox(agg.cells.c1.g2, 15, "c1.g2 = +15");
  expect(agg.cells.c1.g3, null, "c1.g3 = null (未結果)");

  // c2 cells:
  //   g1: 100 × applySide(-50, "receive") = 100 × +50% = +50
  //   g2: 200 × -30% = -60
  expectApprox(agg.cells.c2.g1, 50, "c2.g1 = +50");
  expectApprox(agg.cells.c2.g2, -60, "c2.g2 = -60");

  // row totals (null セル除外)
  expectApprox(agg.rowTotals.c1, -50 + 15, "c1 row total = -35");
  expectApprox(agg.rowTotals.c2, 50 + -60, "c2 row total = -10");

  // col totals
  expectApprox(agg.colTotals.g1, -50 + 50, "g1 col total = 0");
  expectApprox(agg.colTotals.g2, 15 + -60, "g2 col total = -45");
  expectApprox(agg.colTotals.g3, 0, "g3 col total = 0 (null cells)");

  // grand total
  expectApprox(agg.grandTotal, -35 + -10, "grand total = -45");
}

// ─── aggregateWeek ───────────────────────────────────────────────────────
console.log("\n■ aggregateWeek");
{
  const customers = [
    { id: "c1", name: "あ" },
    { id: "c2", name: "い" },
  ];
  // Mon: c1 +70 / c2 -30
  // Tue: c1 -50 / c2 +0
  // Other days: empty
  const week = {
    monday: {
      games: [
        {
          id: "g1",
          teamId: "t1",
          handicap: "0.3",
          result: { won: true, draw: false, scoreDiff: 1 },
        },
      ],
      // ハンデ0.3 1点差勝 → 出=+70%, 受=-70%
      bets: [
        { customerId: "c1", gameId: "g1", points: 100, side: "give" }, // +70
        { customerId: "c2", gameId: "g1", points: 50, side: "give" }, // +35 (not -30)
      ],
    },
    tuesday: {
      games: [
        {
          id: "g2",
          teamId: "t2",
          handicap: "1.5",
          result: { won: true, draw: false, scoreDiff: 1 },
        },
      ],
      // ハンデ1.5 1点差勝 → 出=-50%
      bets: [
        { customerId: "c1", gameId: "g2", points: 100, side: "give" }, // -50
      ],
    },
    wednesday: { games: [], bets: [] },
    thursday: { games: [], bets: [] },
    friday: { games: [], bets: [] },
    saturday: { games: [], bets: [] },
    sunday: { games: [], bets: [] },
  };
  const totals = aggregateWeek(week, customers);
  expectApprox(totals.c1, 70 + -50, "c1 week total = +20");
  expectApprox(totals.c2, 35, "c2 week total = +35");
}

// ─── fmtPoints ───────────────────────────────────────────────────────────
console.log("\n■ fmtPoints");
expect(fmtPoints(0), "0", "0 → '0'");
expect(fmtPoints(70), "70", "70 → '70'");
expect(fmtPoints(-50), "-50", "-50 → '-50'");
expect(fmtPoints(7.5), "7.5", "7.5 → '7.5'");
expect(fmtPoints(7.0), "7", "7.0 → '7' (trailing zero dropped)");
expect(fmtPoints(0.3), "0.3", "0.3 → '0.3'");

console.log(
  `\n${failed === 0 ? "✓ ALL PASS" : `✗ ${failed} FAIL`}  (${passed}/${passed + failed})`,
);
process.exit(failed === 0 ? 0 : 1);
