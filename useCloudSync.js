import { useEffect, useRef, useState } from "react";
import { exportAll } from "./backup.js";
import {
  pushToCloud,
  pullFromCloud,
  shouldApplyRemote,
  applyRemote,
  getStoredCode,
  setStoredCode,
} from "./cloudSync.js";

// Upstash Free tier は 10,000 commands/日 が上限。30 秒間隔なら 2 端末
// 合計で約 5,760 GET/日 + 編集の PUT 数十回で収まる。体感上の同期
// 遅延は最大 30 秒だが、ユーザ操作の即時性を要求する用途ではないので
// 受容可能。タイトな同期が要るユースケースなら短くする。
const PULL_INTERVAL_MS = 30_000;
const PUSH_DEBOUNCE_MS = 1_500;
const LOCAL_POLL_MS = 1_500;

/**
 * クラウド同期の React フック。
 *
 * 状態:
 *   code: 現在の同期コード or null
 *   status: "idle" | "pushing" | "pulling" | "error" | "off"
 *   lastSync: 最後に成功した同期時刻 (Date | null)
 *   error: 直近の失敗メッセージ
 *
 * 操作:
 *   start(code): 同期開始（コードを localStorage に保存）
 *   stop(): 同期停止
 *   pushNow(): 手動で即 PUT
 *   pullNow(): 手動で即 GET
 *
 * 自動動作:
 *   code が設定されている間、1 秒ごとに localStorage のスナップショット
 *   差分を見て、変化があれば 1.5 秒 debounce 後に PUT。同時に 10 秒
 *   ごとに pull、cloudUpdatedAt が新しければ apply + reload。
 */
export function useCloudSync() {
  const [code, setCodeState] = useState(() => getStoredCode());
  const [status, setStatus] = useState(code ? "idle" : "off");
  const [lastSync, setLastSync] = useState(null);
  const [error, setError] = useState(null);

  const lastSnapshotRef = useRef(null);
  const pushTimerRef = useRef(null);
  const pullTimerRef = useRef(null);
  const localPollTimerRef = useRef(null);
  const isPushingRef = useRef(false);

  function start(newCode) {
    setStoredCode(newCode);
    setCodeState(newCode);
    setStatus("idle");
    setError(null);
  }

  function stop() {
    setStoredCode(null);
    setCodeState(null);
    setStatus("off");
    setError(null);
  }

  async function doPush(currentCode) {
    if (isPushingRef.current) return;
    isPushingRef.current = true;
    try {
      setStatus("pushing");
      await pushToCloud(currentCode);
      setLastSync(new Date());
      setStatus("idle");
      setError(null);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      isPushingRef.current = false;
    }
  }

  async function doPull(currentCode) {
    try {
      setStatus("pulling");
      const remote = await pullFromCloud(currentCode);
      if (remote && shouldApplyRemote(remote)) {
        applyRemote(remote);
        // useLocalStorage hook は外部書き換えを検知しない → reload
        window.location.reload();
        return;
      }
      setLastSync(new Date());
      setStatus("idle");
      setError(null);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function pushNow() {
    if (code) void doPush(code);
  }

  function pullNow() {
    if (code) void doPull(code);
  }

  // ── pull loop ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!code) return;
    // 初回は即 pull
    void doPull(code);
    const t = setInterval(() => doPull(code), PULL_INTERVAL_MS);
    pullTimerRef.current = t;
    return () => clearInterval(t);
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── push loop ──────────────────────────────────────────────────────
  // localStorage の内容変化を 1 秒 polling で検知、変化を見つけたら
  // 1.5 秒 debounce で PUT。
  useEffect(() => {
    if (!code) return;
    lastSnapshotRef.current = JSON.stringify(exportAll());

    const localTimer = setInterval(() => {
      const current = JSON.stringify(exportAll());
      if (current === lastSnapshotRef.current) return;
      lastSnapshotRef.current = current;
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
      pushTimerRef.current = setTimeout(() => doPush(code), PUSH_DEBOUNCE_MS);
    }, LOCAL_POLL_MS);
    localPollTimerRef.current = localTimer;

    return () => {
      clearInterval(localTimer);
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    };
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  return { code, status, lastSync, error, start, stop, pushNow, pullNow };
}
