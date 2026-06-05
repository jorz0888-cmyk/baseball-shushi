/**
 * クラウド同期用の deep merge ── 2 端末で並行編集された
 * スナップショットをマージする。
 *
 * 衝突解決ポリシー:
 *   片側にしか無いレコード   → そのまま残す（add は絶対消さない）
 *   両側に同じ id がある場合 → overlay 側の値を採用 (overlay wins)
 *
 * push 時は merge(cloud, local) = local-wins。自分の編集を保ち、相手の追加を取り込む。
 * pull 時は merge(local, cloud) = cloud-wins。相手の編集を取り込み、自分の追加を保つ。
 *
 * 衝突する同一レコードの value は per-record の編集時刻を持たないので
 * 「呼び出し側が新しいと判断した方」を採用する last-write-wins。
 *
 * データ形:
 *   customers[]  ── id を持つ
 *   teams[]      ── id を持つ
 *   weeks{wid:{day:{games[],bets[]}}}
 *     games[]   ── id を持つ
 *     bets[]    ── id が無い → (customerId, gameId, side) を合成キーにする
 */

import { STORAGE_KEYS } from "./storage.js";
import { DAY_KEYS } from "./week.js";

/** id を持つレコード配列の和集合。overlay が同 id を上書き。 */
function unionById(a = [], b = []) {
  const out = new Map();
  if (Array.isArray(a)) {
    for (const x of a) if (x && x.id != null) out.set(x.id, x);
  }
  if (Array.isArray(b)) {
    for (const x of b) if (x && x.id != null) out.set(x.id, x);
  }
  return [...out.values()];
}

/** bet の合成キー。id 相当として扱う。 */
function betKey(bet) {
  return `${bet?.customerId ?? ""}|${bet?.gameId ?? ""}|${bet?.side ?? ""}`;
}

function unionBets(a = [], b = []) {
  const out = new Map();
  if (Array.isArray(a)) for (const bet of a) if (bet) out.set(betKey(bet), bet);
  if (Array.isArray(b)) for (const bet of b) if (bet) out.set(betKey(bet), bet);
  return [...out.values()];
}

function mergeDay(a, b) {
  if (!a && !b) return { games: [], bets: [] };
  const left = a ?? { games: [], bets: [] };
  const right = b ?? { games: [], bets: [] };
  return {
    games: unionById(left.games ?? [], right.games ?? []),
    bets: unionBets(left.bets ?? [], right.bets ?? []),
  };
}

function mergeWeek(a, b) {
  if (!a && !b) return undefined;
  const left = a ?? {};
  const right = b ?? {};
  const out = {};
  for (const d of DAY_KEYS) {
    out[d] = mergeDay(left[d], right[d]);
  }
  return out;
}

function mergeWeeks(a = {}, b = {}) {
  const out = {};
  const keys = new Set([
    ...Object.keys(a ?? {}),
    ...Object.keys(b ?? {}),
  ]);
  for (const k of keys) {
    const merged = mergeWeek(a?.[k], b?.[k]);
    if (merged) out[k] = merged;
  }
  return out;
}

/**
 * backup.data 形式（{ "bb-calc-customers": [...], "bb-calc-teams": [...],
 * "bb-calc-weeks": {...} }）の deep merge。overlay が衝突時に勝つ。
 *
 * @param {Object} base
 * @param {Object} overlay
 * @returns {Object}
 */
export function mergeData(base = {}, overlay = {}) {
  const b = base ?? {};
  const o = overlay ?? {};
  return {
    [STORAGE_KEYS.customers]: unionById(
      b[STORAGE_KEYS.customers],
      o[STORAGE_KEYS.customers],
    ),
    [STORAGE_KEYS.teams]: unionById(
      b[STORAGE_KEYS.teams],
      o[STORAGE_KEYS.teams],
    ),
    [STORAGE_KEYS.weeks]: mergeWeeks(
      b[STORAGE_KEYS.weeks],
      o[STORAGE_KEYS.weeks],
    ),
  };
}

/**
 * top-level snapshot (exportAll() の戻り値 + cloudUpdatedAt 等メタを含む)
 * の merge。メタは overlay 側を採用し、data だけ deep merge する。
 */
export function mergeSnapshots(base, overlay) {
  return {
    ...(overlay ?? {}),
    data: mergeData(base?.data, overlay?.data),
  };
}
