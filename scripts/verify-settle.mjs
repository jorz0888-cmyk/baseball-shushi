// Verifies settle.js — week-level settlement + B収支式.
// Run: node scripts/verify-settle.mjs

import {
  settleCustomer,
  settleAll,
  SETTLE_RATES,
  FIRST_HALF_DAYS,
  SECOND_HALF_DAYS,
} from "../settle.js";

let failed = 0;
let passed = 0;

function approxEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) < 1e-6;
}

function expect(actual, expected, label) {
  if (actual === expected) {
    passed++;
    return;
  }
  failed++;
  console.log(`  ✗ ${label}  expected=${expected}  actual=${actual}`);
}

function expectApprox(actual, expected, label) {
  if (approxEqual(actual, expected)) {
    passed++;
    return;
  }
  failed++;
  console.log(`  ✗ ${label}  expected≈${expected}  actual=${actual}`);
}

// ─── sanity: rate constants & day grouping ───────────────────────────────
console.log("\n■ rates & day grouping");
expect(SETTLE_RATES.with2bu.plus, 0.92, "with2bu.plus = 0.92");
expect(SETTLE_RATES.with2bu.minus, 0.98, "with2bu.minus = 0.98");
expect(SETTLE_RATES.without2bu.plus, 0.9, "without2bu.plus = 0.90");
expect(SETTLE_RATES.without2bu.minus, 1.0, "without2bu.minus = 1.00");
expect(FIRST_HALF_DAYS.length, 3, "前半 = 3 days (月火水)");
expect(SECOND_HALF_DAYS.length, 4, "後半 = 4 days (木金土日)");
expect(FIRST_HALF_DAYS[0], "monday", "first-half[0] = monday");
expect(SECOND_HALF_DAYS[3], "sunday", "second-half[3] = sunday");

// ─── empty week → all zeros ──────────────────────────────────────────────
console.log("\n■ empty week");
{
  const customer = { id: "c1", name: "あ" };
  const weekData = {
    monday: { games: [], bets: [] },
    tuesday: { games: [], bets: [] },
    wednesday: { games: [], bets: [] },
    thursday: { games: [], bets: [] },
    friday: { games: [], bets: [] },
    saturday: { games: [], bets: [] },
    sunday: { games: [], bets: [] },
  };
  const s = settleCustomer(weekData, customer);
  expectApprox(s.weekTotal, 0, "weekTotal = 0");
  expectApprox(s.plusSum, 0, "plusSum = 0");
  expectApprox(s.minusSum, 0, "minusSum = 0");
  expectApprox(s.with2bu, 0, "with2bu = 0");
  expectApprox(s.without2bu, 0, "without2bu = 0");
}

// ─── worked example (spec-style) ─────────────────────────────────────────
console.log("\n■ worked example: 1 customer, mixed days");
{
  const customer = { id: "c1", name: "あ" };
  // Mon: ハンデ1.5 1点差勝 (-50%) × 100pt give → -50
  // Tue: ハンデ0.3 1点差勝 (+70%) × 100pt give → +70
  // Wed: empty → 0
  // Thu: ハンデ1.3 引分    (引分は scoreDiff<base→丸負け=-100%) × 50pt give → -50
  // Fri-Sun: empty → 0
  //
  // dailyTotals: [-50, +70, 0, -50, 0, 0, 0]
  // firstHalf = -50+70+0 = +20
  // secondHalf = -50+0+0+0 = -50
  // weekTotal = -30
  // plusSum = 70 (Tue only)
  // minusSum = -100 (Mon -50 + Thu -50)
  // with2bu = 70*0.92 + -100*0.98 = 64.4 - 98 = -33.6
  // without2bu = 70*0.90 + -100*1.00 = 63 - 100 = -37
  const weekData = {
    monday: {
      games: [
        {
          id: "g_mon",
          teamId: "t1",
          handicap: "1.5",
          result: { won: true, draw: false, scoreDiff: 1 },
        },
      ],
      bets: [
        { customerId: "c1", gameId: "g_mon", points: 100, side: "give" },
      ],
    },
    tuesday: {
      games: [
        {
          id: "g_tue",
          teamId: "t1",
          handicap: "0.3",
          result: { won: true, draw: false, scoreDiff: 1 },
        },
      ],
      bets: [
        { customerId: "c1", gameId: "g_tue", points: 100, side: "give" },
      ],
    },
    wednesday: { games: [], bets: [] },
    thursday: {
      games: [
        {
          id: "g_thu",
          teamId: "t1",
          handicap: "1.3",
          result: { won: false, draw: true, scoreDiff: 0 },
        },
      ],
      bets: [
        { customerId: "c1", gameId: "g_thu", points: 50, side: "give" },
      ],
    },
    friday: { games: [], bets: [] },
    saturday: { games: [], bets: [] },
    sunday: { games: [], bets: [] },
  };
  const s = settleCustomer(weekData, customer);
  expectApprox(s.dailyTotals.monday, -50, "daily mon = -50");
  expectApprox(s.dailyTotals.tuesday, 70, "daily tue = +70");
  expectApprox(s.dailyTotals.wednesday, 0, "daily wed = 0");
  expectApprox(s.dailyTotals.thursday, -50, "daily thu = -50 (ハンデ1.3 引分=丸負け × 50pt)");
  expectApprox(s.firstHalfSubtotal, 20, "前半 (月火水) = +20");
  expectApprox(s.secondHalfSubtotal, -50, "後半 (木金土日) = -50");
  expectApprox(s.weekTotal, -30, "週合計 = -30");
  expectApprox(s.plusSum, 70, "plusSum = +70 (Tue only)");
  expectApprox(s.minusSum, -100, "minusSum = -100 (Mon -50 + Thu -50)");
  expectApprox(
    s.with2bu,
    70 * 0.92 + -100 * 0.98,
    "with2bu = 70*0.92 + -100*0.98 = -33.6",
  );
  expectApprox(
    s.without2bu,
    70 * 0.9 + -100 * 1.0,
    "without2bu = 70*0.90 + -100*1.00 = -37",
  );
  // bonus2bu = with2bu - without2bu = -33.6 - -37 = 3.4
  expectApprox(
    s.bonus2bu,
    -33.6 - -37,
    "bonus2bu = with2bu − without2bu = +3.4",
  );
}

// ─── all-plus week (only positive days) ──────────────────────────────────
console.log("\n■ all positive: minusSum = 0");
{
  const customer = { id: "c1", name: "あ" };
  // Mon, Tue: +100 each. Other days empty.
  // plusSum = 200, minusSum = 0
  // with2bu = 200 × 0.92 = 184
  // without2bu = 200 × 0.90 = 180
  const day = (handi) => ({
    games: [
      {
        id: "g",
        teamId: "t1",
        handicap: handi,
        result: { won: true, draw: false, scoreDiff: 3 }, // 3点差勝 → 必ず丸勝ち
      },
    ],
    bets: [{ customerId: "c1", gameId: "g", points: 100, side: "give" }],
  });
  const weekData = {
    monday: day("1.5"),
    tuesday: day("1.5"),
    wednesday: { games: [], bets: [] },
    thursday: { games: [], bets: [] },
    friday: { games: [], bets: [] },
    saturday: { games: [], bets: [] },
    sunday: { games: [], bets: [] },
  };
  const s = settleCustomer(weekData, customer);
  expectApprox(s.plusSum, 200, "plusSum = 200");
  expectApprox(s.minusSum, 0, "minusSum = 0");
  expectApprox(s.with2bu, 184, "with2bu = 200 × 0.92 = 184");
  expectApprox(s.without2bu, 180, "without2bu = 200 × 0.90 = 180");
  expectApprox(s.bonus2bu, 4, "bonus2bu = 184 − 180 = 4");
}

// ─── all-minus week (only negative days) ─────────────────────────────────
console.log("\n■ all negative: plusSum = 0");
{
  const customer = { id: "c1", name: "あ" };
  // 100pt 出 ハンデ1.5 1点差勝 → -50 (3 days)
  const day = () => ({
    games: [
      {
        id: "g",
        teamId: "t1",
        handicap: "1.5",
        result: { won: true, draw: false, scoreDiff: 1 },
      },
    ],
    bets: [{ customerId: "c1", gameId: "g", points: 100, side: "give" }],
  });
  const weekData = {
    monday: day(),
    tuesday: day(),
    wednesday: day(),
    thursday: { games: [], bets: [] },
    friday: { games: [], bets: [] },
    saturday: { games: [], bets: [] },
    sunday: { games: [], bets: [] },
  };
  const s = settleCustomer(weekData, customer);
  expectApprox(s.plusSum, 0, "plusSum = 0");
  expectApprox(s.minusSum, -150, "minusSum = -150");
  expectApprox(s.with2bu, -150 * 0.98, "with2bu = -150 × 0.98 = -147");
  expectApprox(s.without2bu, -150, "without2bu = -150 (as-is)");
  expectApprox(s.bonus2bu, -147 - -150, "bonus2bu = -147 − -150 = +3");
}

// ─── settleAll: shape ────────────────────────────────────────────────────
console.log("\n■ settleAll");
{
  const customers = [
    { id: "c1", name: "あ" },
    { id: "c2", name: "い" },
  ];
  const weekData = {
    monday: { games: [], bets: [] },
    tuesday: { games: [], bets: [] },
    wednesday: { games: [], bets: [] },
    thursday: { games: [], bets: [] },
    friday: { games: [], bets: [] },
    saturday: { games: [], bets: [] },
    sunday: { games: [], bets: [] },
  };
  const list = settleAll(weekData, customers);
  expect(list.length, 2, "2 customers settled");
  expect(list[0].customer.id, "c1", "list[0] is c1");
  expect(list[1].customer.id, "c2", "list[1] is c2");
  expectApprox(list[0].settlement.weekTotal, 0, "list[0] weekTotal = 0");
}

console.log(
  `\n${failed === 0 ? "✓ ALL PASS" : `✗ ${failed} FAIL`}  (${passed}/${passed + failed})`,
);
process.exit(failed === 0 ? 0 : 1);
