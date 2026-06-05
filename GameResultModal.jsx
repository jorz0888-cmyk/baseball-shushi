import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

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

  // ★ 本命修正: iOS Safari の position:fixed + virtual keyboard 互換問題。
  //
  // iOS でソフトキーボードが開くと「視覚ビューポート」だけ縮み、「レイアウト
  // ビューポート」はそのまま。`position: fixed; inset: 0` はレイアウト基準
  // なので、見た目では中央にあるモーダルが、当たり判定的には画面上端に
  // 貼り付いたまま → ユーザのタップ座標は実際にはモーダルの「下にあるはず
  // の場所」=日別入力グリッドや戻るボタンに当たる。「背景をずらすと直る」
  // 現象はこのズレの大きさが変わるため。
  //
  // 対策: visualViewport API で本当に見えている領域に backdrop を毎フレーム
  // 追従させる。これで当たり判定と見た目が一致する。
  const backdropRef = useRef(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    function adjust() {
      const el = backdropRef.current;
      if (!el) return;
      el.style.top = `${vv.offsetTop}px`;
      el.style.left = `${vv.offsetLeft}px`;
      el.style.width = `${vv.width}px`;
      el.style.height = `${vv.height}px`;
    }
    adjust();
    vv.addEventListener("resize", adjust);
    vv.addEventListener("scroll", adjust);
    return () => {
      vv.removeEventListener("resize", adjust);
      vv.removeEventListener("scroll", adjust);
    };
  }, []);

  // 加えて iOS 流の body スクロールロック (overflow:hidden だけだと iOS は
  // 効かないので position:fixed + top:-scrollY のトリックを使う)。これで
  // ユーザがモーダル裏の背景を引きずって動かせなくなる。
  useEffect(() => {
    const scrollY = window.scrollY;
    const prev = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
    };
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    return () => {
      document.body.style.overflow = prev.overflow;
      document.body.style.position = prev.position;
      document.body.style.top = prev.top;
      document.body.style.left = prev.left;
      document.body.style.right = prev.right;
      document.body.style.width = prev.width;
      window.scrollTo(0, scrollY);
    };
  }, []);

  function save() {
    if (outcome === "draw") {
      onSave({ won: false, draw: true, scoreDiff: 0 });
      return;
    }
    const n = Math.max(1, parseInt(scoreDiffStr, 10) || 1);
    onSave({ won: outcome === "win", draw: false, scoreDiff: n });
  }

  // ★ document.body 直下に Portal で描画する。
  // モーダルを DailyInputScreen の DOM サブツリーに置くと、親 (グリッド・
  // スティッキー列・スクロール領域) のイベントやスタッキングコンテキストと
  // 干渉して、特にスマホで「タップが背景に届く」「画面が戻る」など説明し
  // にくい挙動が起きる。body 直下に出すことで物理的に独立させ、影響を切る。
  return createPortal(
    // バックドロップ click は target が背景そのもの (= currentTarget) のときだけ
    // onCancel する。タップ位置がドリフトして input 上の click が backdrop に
    // 来てもモーダルを閉じないようにする保険 (内側 div の stopPropagation と
    // 併用)。スマホで「点差をタップしたら画面がバックする」現象の対策。
    <div
      ref={backdropRef}
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
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
          // 入力エリアに対するタッチイベントも明示的に stopPropagation して、
          // どんな経路でも backdrop に届かないようにする保険。
          <div
            className="score-diff"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            <label>点差</label>
            {/* iOS の type=number ピッカーが「タップ→キーボード→スクロール
                →click が backdrop に届く」みたいな副作用を起こすことがあるので
                type=text + inputMode=numeric にしてテンキー表示だけ確保する。
                pattern は iOS でテンキー表示を確実にするためのおまじない。 */}
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={2}
              value={scoreDiffStr}
              onChange={(e) =>
                setScoreDiffStr(e.target.value.replace(/[^0-9]/g, ""))
              }
              onClick={(e) => e.stopPropagation()}
            />
            <span className="neutral">点</span>
          </div>
        )}

        <div className="modal-buttons">
          {/* キャンセルは常に表示。既存結果の編集中は 結果クリア も別ボタンで
              出す。旧仕様だと「編集中はキャンセルが消える」という地味に困る
              UX だった (スマホで誤タップ閉じてもやり直せない)。 */}
          <button onClick={onCancel}>キャンセル</button>
          {initial && onClear && (
            <button className="danger-outline" onClick={onClear}>
              結果クリア
            </button>
          )}
          <button className="primary" onClick={save}>
            保存
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
