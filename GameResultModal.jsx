import { useState, useEffect } from "react";

/**
 * 試合結果入力モーダル。勝ち / 引分 / 負け の3択 + 勝/負時のみ点差を入力。
 * 点差は「出し側視点」── 勝ちなら点差プラス、負けなら点差マイナス扱い
 * で内部記録（draw=true のときは点差無視）。
 *
 * @param {{
 *   teamName: string,
 *   handicap: string,
 *   initial: { won: boolean, draw: boolean, scoreDiff: number } | null,
 *   onSave: (result: { won: boolean, draw: boolean, scoreDiff: number }) => void,
 *   onCancel: () => void,
 *   onClear?: () => void,
 * }} props
 */
export default function GameResultModal({
  teamName,
  opponentTeamName,
  handicap,
  initial,
  onSave,
  onCancel,
  onClear,
}) {
  /** @type {["win"|"draw"|"lose", Function]} */
  const [outcome, setOutcome] = useState(() => {
    if (!initial) return "win";
    if (initial.draw) return "draw";
    return initial.won ? "win" : "lose";
  });
  const [scoreDiffStr, setScoreDiffStr] = useState(() => {
    if (!initial || initial.draw) return "1";
    return String(Math.abs(initial.scoreDiff || 1));
  });

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  function save() {
    if (outcome === "draw") {
      onSave({ won: false, draw: true, scoreDiff: 0 });
      return;
    }
    const n = Math.max(1, parseInt(scoreDiffStr, 10) || 1);
    onSave({ won: outcome === "win", draw: false, scoreDiff: n });
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <p className="modal-message">
          <strong>{teamName}</strong>
          {opponentTeamName && (
            <>
              <span className="neutral"> vs </span>
              {opponentTeamName}
            </>
          )}{" "}
          <span className="neutral">
            (ハンデ {handicap === "0" ? "スクラッチ" : handicap})
          </span>
          <br />
          試合結果を入力（{teamName} の勝/負/引分）
        </p>

        <div className="outcome-buttons">
          <button
            type="button"
            className={`outcome${outcome === "win" ? " active win" : ""}`}
            onClick={() => setOutcome("win")}
          >
            勝ち
          </button>
          <button
            type="button"
            className={`outcome${outcome === "draw" ? " active draw" : ""}`}
            onClick={() => setOutcome("draw")}
          >
            引分
          </button>
          <button
            type="button"
            className={`outcome${outcome === "lose" ? " active lose" : ""}`}
            onClick={() => setOutcome("lose")}
          >
            負け
          </button>
        </div>

        {outcome !== "draw" && (
          <div className="score-diff">
            <label>点差</label>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="99"
              value={scoreDiffStr}
              onChange={(e) => setScoreDiffStr(e.target.value)}
            />
            <span className="neutral">点</span>
          </div>
        )}

        <div className="modal-buttons">
          {initial && onClear ? (
            <button className="danger-outline" onClick={onClear}>
              結果クリア
            </button>
          ) : (
            <button onClick={onCancel}>キャンセル</button>
          )}
          <button className="primary" onClick={save}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
