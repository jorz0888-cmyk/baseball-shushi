/**
 * バックアップ / 復元 ── localStorage 内のアプリデータを JSON
 * ファイルとして書き出し / 読み込みする。
 *
 * 対象キーは STORAGE_KEYS で定義された 3 つ
 * (bb-calc-customers / bb-calc-teams / bb-calc-weeks)。それ以外の
 * 補助キー (bb-calc-current-week 等) は含めない。理由: 復元時に
 * 「いつ作成したデータか」が明確になるよう、永続的なユーザー/チーム
 * /試合データだけを対象にする。
 *
 * 復元後は localStorage を直接書き換えているので React 側の
 * useLocalStorage hook は値の変更に気付かない。呼び出し側で
 * `window.location.reload()` を実行して反映させる。
 */

import { STORAGE_KEYS } from "./storage.js";

const BACKUP_VERSION = 1;
const BACKUP_KEYS = Object.freeze([
  STORAGE_KEYS.customers,
  STORAGE_KEYS.teams,
  STORAGE_KEYS.weeks,
]);

/**
 * 現在の localStorage 内容をオブジェクトに集約。
 * @returns {{version: number, exportedAt: string, appName: string, data: Object}}
 */
export function exportAll() {
  /** @type {Record<string, unknown>} */
  const data = {};
  for (const key of BACKUP_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw === null) continue;
    try {
      data[key] = JSON.parse(raw);
    } catch {
      // 不正な JSON は文字列として保存
      data[key] = raw;
    }
  }
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    appName: "野球収支計算機",
    data,
  };
}

/**
 * バックアップを JSON ファイルとしてダウンロードトリガー。
 * 一時 <a> を生成して click() し、URL を revoke する標準的な手法。
 */
export function downloadBackup() {
  const payload = exportAll();
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const date = new Date().toISOString().slice(0, 10);
  a.download = `baseball-shushi-backup-${date}.json`;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * File 入力からバックアップ JSON を読み込んでパース。
 * 形式チェックも兼ねる。
 *
 * @param {File} file
 * @returns {Promise<{version:number, exportedAt:string, appName:string, data:Object}>}
 */
export function readBackupFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (
          typeof parsed !== "object" ||
          parsed === null ||
          !parsed.data ||
          typeof parsed.data !== "object"
        ) {
          reject(new Error("バックアップファイルの形式が不正です"));
          return;
        }
        if (typeof parsed.version !== "number") {
          reject(new Error("バックアップのバージョン情報がありません"));
          return;
        }
        if (parsed.version > BACKUP_VERSION) {
          reject(
            new Error(
              `このアプリは v${BACKUP_VERSION} までのバックアップに対応しています (ファイル: v${parsed.version})`,
            ),
          );
          return;
        }
        resolve(parsed);
      } catch (err) {
        reject(
          new Error(
            `JSON の解析に失敗しました: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
      }
    };
    reader.onerror = () => reject(new Error("ファイル読み込みに失敗しました"));
    reader.readAsText(file);
  });
}

/**
 * 検証済みバックアップを localStorage に書き戻す。
 * 既存値を上書きすることに注意 (呼び出し側で確認ダイアログを出す)。
 *
 * @param {{data: Record<string, unknown>}} backup
 */
export function applyBackup(backup) {
  for (const key of Object.keys(backup.data)) {
    if (!BACKUP_KEYS.includes(key)) continue;
    localStorage.setItem(key, JSON.stringify(backup.data[key]));
  }
}

/**
 * BACKUP_KEYS で管理している全てのデータを localStorage から削除する。
 * 同時に、PWA Service Worker のキャッシュも掃除して、次回ロード時に
 * 最新のクライアントコードがネットワークから取得されるようにする。
 * 「スマホでブラウザのキャッシュクリアを手動でやるのが面倒」という
 * 実運用要件を吸収する。
 *
 * 呼び出し側で確認ダイアログを出してから実行すること。実行後は
 * useLocalStorage hook の値を再初期化するため window.location.reload()
 * が必要。
 *
 * @returns {Promise<void>}
 */
export async function clearAll() {
  // 1) アプリ管理の localStorage キー
  for (const key of BACKUP_KEYS) {
    localStorage.removeItem(key);
  }

  // 1.5) 同期タイムスタンプもリセット。
  //   - bb-calc-sync-last-push を残すと、cleanAll 直後の reload で
  //     「cloud.cloudUpdatedAt == 自分の lastPush」と判定されて
  //     pull-apply が走らず、空のローカルを cloud に push して
  //     cloud まで wipe してしまう (致命)。null にしておけば pull が
  //     必ず apply されて cloud データがローカルに戻る。
  //   - bb-calc-sync-last-pushed-data も合わせて消しておく
  //     (applyRemote で再設定される)。
  localStorage.removeItem("bb-calc-sync-last-push");
  localStorage.removeItem("bb-calc-sync-last-pushed-data");

  // 2) sessionStorage（あれば）
  try {
    sessionStorage.clear();
  } catch {
    // private mode / disabled storage は黙って無視
  }

  // 3) Cache API（PWA Service Worker が握っているシェル/バンドル）
  if (typeof caches !== "undefined") {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch {
      // キャッシュ削除失敗は致命的ではない（次回 SW で揃え直す）
    }
  }

  // 4) Service Worker を unregister。次回ロードで sw.js が新規取得され、
  //    install→activate で最新キャッシュが作り直される。
  if (typeof navigator !== "undefined" && navigator.serviceWorker) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    } catch {
      // ブラウザ未対応 / 失敗時は黙って無視
    }
  }
}

export { BACKUP_KEYS, BACKUP_VERSION };
