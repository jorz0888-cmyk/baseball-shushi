/**
 * クラウド同期 ── 同期コード方式 + CAS + 並行編集マージ。
 *
 * 両端末で同じコード (例: "ABC-234") を入力すると、その KV キーに
 * アプリ状態が読み書きされる。認証なし、コードを知っている人だけが
 * アクセスできる。
 *
 * 仕組み:
 *   - PUT は localStorage 変更を 1 秒 debounce してから API に送る
 *   - PUT のたびに `expectedCloudUpdatedAt` を添える（CAS）
 *   - サーバーが現在の cloudUpdatedAt と不一致なら 409 を返し、
 *     現状の cloud を body に含める
 *   - クライアントは local-wins でマージしてから retry（自分の編集を
 *     保ったまま、相手の追加もちゃんと取り込む）
 *   - GET は 60 秒ごとにポーリング。reply の cloudUpdatedAt が
 *     ローカルの最終 push 時刻より新しければ remote-wins でマージ
 *     してから reload
 *
 * 旧仕様（last-write-wins on 全状態）では、両端末が pull 待ち窓
 * （最大 60 秒）で並行編集すると、後から push した側が前の push を
 * **まるごと** 上書きして「試合 / 数字が消える」事故が起きていた。
 * 今は per-record 和集合マージ + CAS で、追加は絶対に失われない。
 *
 * オフライン / API 不達時はサイレントに skip。次回成功時に最新で
 * 上書きする (localStorage は常にローカルの真実)。
 */

import { exportAll, applyBackup } from "./backup.js";
import { mergeData } from "./mergeState.js";

const CODE_KEY = "bb-calc-sync-code";
const LAST_PUSH_KEY = "bb-calc-sync-last-push";

/** 同期コードの許容文字 — 紛らわしい O/0、I/1 を除外して読みやすく */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** 6 文字のランダムコードを「ABC-234」形式で生成 */
export function generateSyncCode() {
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `${s.slice(0, 3)}-${s.slice(3, 6)}`;
}

/** 入力文字列を同期コード形式に正規化 (大文字化、ハイフン除去再付与) */
export function normalizeSyncCode(raw) {
  const cleaned = String(raw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (cleaned.length < 6 || cleaned.length > 12) return null;
  if (!/^[A-HJ-NP-Z2-9]+$/.test(cleaned)) return null;
  if (cleaned.length === 6) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}`;
  }
  return cleaned;
}

export function getStoredCode() {
  return localStorage.getItem(CODE_KEY);
}

export function setStoredCode(code) {
  if (code) {
    localStorage.setItem(CODE_KEY, code);
  } else {
    localStorage.removeItem(CODE_KEY);
    localStorage.removeItem(LAST_PUSH_KEY);
  }
}

export function getLastPushTime() {
  const raw = localStorage.getItem(LAST_PUSH_KEY);
  return raw ? new Date(raw) : null;
}

function getLastPushIso() {
  return localStorage.getItem(LAST_PUSH_KEY);
}

function recordLastPush(iso) {
  localStorage.setItem(LAST_PUSH_KEY, iso);
}

/**
 * ローカルデータをクラウドに PUT。
 *
 * CAS (expectedCloudUpdatedAt) 付き。サーバー側の現在値と不一致なら
 * 409 が返ってくるので、サーバーが返した現状値とローカルを local-wins
 * でマージし、新しい expected で retry する。
 *
 * @param {string} code  — "ABC-234"
 * @param {{maxRetries?: number}} [options]
 * @returns {Promise<{ok:true, cloudUpdatedAt:string}>}
 */
export async function pushToCloud(code, options = {}) {
  const maxRetries = options.maxRetries ?? 3;
  let lastErr = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const localSnapshot = exportAll();
    const expected = getLastPushIso(); // null = 初回 / 未同期

    const res = await fetch(`/api/sync/${code}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...localSnapshot,
        expectedCloudUpdatedAt: expected,
      }),
    });

    if (res.status === 409) {
      // 他端末が我々の last-known cloudUpdatedAt より後に push 済み。
      // サーバーが返した current cloud を取得、local-wins でマージして
      // 新しい expected で retry。
      let reply = null;
      try {
        reply = await res.json();
      } catch {
        // 形式不正は致命的、retry してもムダ
        throw new Error("Push 409 reply was not valid JSON");
      }
      const cloud = reply?.current;
      if (cloud?.data) {
        const merged = mergeData(cloud.data, localSnapshot.data); // local wins
        applyBackup({ data: merged }); // localStorage に書き戻す
        if (cloud.cloudUpdatedAt) recordLastPush(cloud.cloudUpdatedAt);
      } else {
        // current が無い 409 はおかしいが、念のため expected を消して retry
        localStorage.removeItem(LAST_PUSH_KEY);
      }
      lastErr = new Error(`CAS conflict (attempt ${attempt + 1})`);
      continue;
    }

    if (!res.ok) {
      throw new Error(`Push failed: HTTP ${res.status}`);
    }
    const reply = await res.json();
    if (reply?.cloudUpdatedAt) {
      recordLastPush(reply.cloudUpdatedAt);
    }
    return reply;
  }

  // ここに到達 = 連続で 409 が続いた。レアケース。
  throw lastErr ?? new Error("Push failed: too many CAS conflicts");
}

/**
 * クラウドから GET。データなければ null。
 * @param {string} code
 * @returns {Promise<Object | null>}
 */
export async function pullFromCloud(code) {
  const res = await fetch(`/api/sync/${code}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Pull failed: HTTP ${res.status}`);
  return res.json();
}

/**
 * クラウドの cloudUpdatedAt がローカルの最終 push より新しければ
 * バックアップを適用して true を返す。リロードは呼び出し側で。
 */
export function shouldApplyRemote(remote) {
  if (!remote || !remote.cloudUpdatedAt) return false;
  const last = getLastPushTime();
  if (!last) return true; // 初回 pull はクラウドのを採用
  return new Date(remote.cloudUpdatedAt).getTime() > last.getTime();
}

/**
 * クラウドのデータを localStorage に書き戻す。
 *
 * 旧仕様では applyBackup(remote) で wholesale 置換していたが、それだと
 * ローカルが last push 後に追加したレコード (まだ push できていない
 * 試合 / ベット) を消してしまう。今は remote-wins で deep merge し、
 * ローカル追加は保ったまま remote の編集を取り込む。
 *
 * 最終 push 時刻は remote.cloudUpdatedAt に揃える (次の pull で自分が
 * 再度 apply しないため)。
 */
export function applyRemote(remote) {
  if (!remote?.data) return;
  const local = exportAll();
  const merged = mergeData(local.data, remote.data); // remote wins
  applyBackup({ data: merged });
  if (remote.cloudUpdatedAt) {
    recordLastPush(remote.cloudUpdatedAt);
  }
}
