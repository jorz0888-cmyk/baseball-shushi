/**
 * クラウド同期 ── 同期コード方式。
 *
 * 両端末で同じコード (例: "ABC-234") を入力すると、その KV キーに
 * アプリ状態が読み書きされる。認証なし、コードを知っている人だけが
 * アクセスできる。
 *
 * 仕組み:
 *   - PUT は localStorage 変更を 1 秒 debounce してから API に送る
 *   - GET は 10 秒ごとにポーリング。reply の cloudUpdatedAt が
 *     ローカルの最終 push 時刻より新しければ取り込み + リロード
 *   - 競合解決は last-write-wins (シンプル)
 *
 * オフライン / API 不達時はサイレントに skip。次回成功時に最新で
 * 上書きする (localStorage は常にローカルの真実)。
 */

import { exportAll, applyBackup } from "./backup.js";

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

function recordLastPush(iso) {
  localStorage.setItem(LAST_PUSH_KEY, iso);
}

/**
 * ローカルデータをクラウドに PUT。
 * @param {string} code  — "ABC-234"
 * @returns {Promise<{cloudUpdatedAt: string}>}
 */
export async function pushToCloud(code) {
  const payload = exportAll();
  const res = await fetch(`/api/sync/${code}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Push failed: HTTP ${res.status}`);
  }
  const reply = await res.json();
  if (reply?.cloudUpdatedAt) {
    recordLastPush(reply.cloudUpdatedAt);
  }
  return reply;
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
 * クラウドのデータを localStorage に書き戻し、最終 push 時刻も
 * クラウドの cloudUpdatedAt に揃える (次の pull で自分が apply
 * しないように)。
 */
export function applyRemote(remote) {
  applyBackup(remote);
  if (remote.cloudUpdatedAt) {
    recordLastPush(remote.cloudUpdatedAt);
  }
}
