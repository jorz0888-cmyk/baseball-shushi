/**
 * ISO 8601 週番号 (週は月曜始まり) のユーティリティ。
 * 週 ID は "2026-W23" 形式で localStorage キーに使う。
 */

const DAY_KEYS = /** @type {const} */ ([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

const DAY_LABELS_JP = /** @type {const} */ ([
  "月",
  "火",
  "水",
  "木",
  "金",
  "土",
  "日",
]);

/**
 * ISO 週番号を計算 (週は月曜始まり、年は ISO 規則)。
 * 標準アルゴリズム — Thursday の年が ISO 週番号の年。
 *
 * @param {Date} date
 * @returns {{ year: number, week: number }}
 */
export function getIsoWeek(date) {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  // ISO weeks: Monday=1..Sunday=7
  const dayNum = d.getUTCDay() || 7;
  // Shift to the Thursday of this week — Thursday's year is the ISO year.
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNum };
}

/**
 * "YYYY-WNN" 形式の週 ID を返す。
 * @param {Date} date
 * @returns {string}
 */
export function weekIdFor(date) {
  const { year, week } = getIsoWeek(date);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/**
 * 週 ID をパース。
 * @param {string} id  — "YYYY-WNN"
 * @returns {{ year: number, week: number } | null}
 */
export function parseWeekId(id) {
  const m = /^(\d{4})-W(\d{2})$/.exec(id);
  if (!m) return null;
  return { year: parseInt(m[1], 10), week: parseInt(m[2], 10) };
}

/**
 * 指定週 ID の月曜日を返す。
 * @param {string} id
 * @returns {Date | null}
 */
export function mondayOfWeek(id) {
  const parsed = parseWeekId(id);
  if (!parsed) return null;
  const { year, week } = parsed;
  // ISO week 1 contains Jan 4. Find the Monday of week 1.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const mondayOfWeek1 = new Date(jan4);
  mondayOfWeek1.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const target = new Date(mondayOfWeek1);
  target.setUTCDate(mondayOfWeek1.getUTCDate() + (week - 1) * 7);
  return target;
}

/**
 * 週 ID を `n` だけ進める / 戻す。
 * @param {string} id
 * @param {number} delta  — +1 = 翌週, -1 = 前週
 * @returns {string}
 */
export function shiftWeekId(id, delta) {
  const mon = mondayOfWeek(id);
  if (!mon) return id;
  const shifted = new Date(mon);
  shifted.setUTCDate(mon.getUTCDate() + delta * 7);
  return weekIdFor(shifted);
}

/**
 * 週 ID + 曜日キー → その日の Date オブジェクト。
 * @param {string} id
 * @param {typeof DAY_KEYS[number]} dayKey
 * @returns {Date | null}
 */
export function dateOfDay(id, dayKey) {
  const mon = mondayOfWeek(id);
  if (!mon) return null;
  const idx = DAY_KEYS.indexOf(dayKey);
  if (idx < 0) return null;
  const d = new Date(mon);
  d.setUTCDate(mon.getUTCDate() + idx);
  return d;
}

export { DAY_KEYS, DAY_LABELS_JP };
