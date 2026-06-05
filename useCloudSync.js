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

/**
 * シリアライズ済み snapshot 用ヘルパ。pull 中にローカルが変わっていないか
 * 判定するために使う。JSON.stringify は同じデータなら（同じブラウザ内では）
 * 同じ文字列を返すという挙動に依拠した素朴な等価判定。
 *
 * ★ exportAll() の戻り値全体ではなく .data だけを取る点に注意。
 * exportAll() は呼び出すたび新しい exportedAt (ISO 文字列) を含むため、
 * そのまま stringify すると preSnapshot と postSnapshot が必ず変わって
 * 「ローカルが変わった」と誤判定 → apply 永久スキップ → 60 秒自動同期が
 * 効かなくなる。比較対象は実データ部分だけ。
 */
function snapshotKey() {
  try {
    return JSON.stringify(exportAll().data);
  } catch {
    return null;
  }
}

// Upstash Free 30 MB tier の 10,000 commands/日 に余裕を持たせて 60 秒
// ポーリング。2 端末で約 2,880 GET/日 + 編集の PUT 数十回。1日 3,000
// commands 程度で済むので、複数ペアが同居しても枠内に収まる。
// 編集の反映は最大 60 秒の遅延だが、家族間 2 台運用なら受容可能。
const PULL_INTERVAL_MS = 60_000;
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
  // ★ doPull の fetch 中にコンポーネントが unmount したり sync が停止
  //   されたりした場合、apply / reload を行わないためのフラグ。
  //   Home から Daily Input に画面遷移すると CloudSyncCard が unmount
  //   されるが、unmount 前に発火していた pull の Promise はそのまま走り続ける。
  //   そのままだと別画面でユーザー編集中に reload してしまい、入力が消える。
  const aliveRef = useRef(true);
  const currentCodeRef = useRef(code);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    currentCodeRef.current = code;
  }, [code]);

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
      // pull 開始時のローカル snapshot。fetch 中にユーザーが編集していたら
      // apply はスキップして、後続の push に同期を任せる（編集を上書きしない）。
      const preSnapshot = snapshotKey();
      const remote = await pullFromCloud(currentCode);

      // unmount / sync 停止された後は apply / reload を行わない。
      // Home → Daily Input 遷移中に pull が resolve するケースの保護。
      // これが無いと、別画面でのユーザー編集が reload で消える。
      if (!aliveRef.current) return;
      if (currentCodeRef.current !== currentCode) return;

      if (remote && shouldApplyRemote(remote)) {
        // pull の往復中にローカルが変わったら、ユーザーが入力したばかりの
        // 値を remote(古い)で上書きしないように apply をスキップ。push が
        // 1〜3 秒後に走って cloud と整合する。
        const postSnapshot = snapshotKey();
        if (postSnapshot !== preSnapshot) {
          setLastSync(new Date());
          setStatus("idle");
          setError(null);
          return;
        }
        applyRemote(remote);
        // useLocalStorage hook は外部書き換えを検知しない → reload
        window.location.reload();
        return;
      }
      setLastSync(new Date());
      setStatus("idle");
      setError(null);
    } catch (err) {
      if (!aliveRef.current) return; // unmount 後の setState は noop
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
