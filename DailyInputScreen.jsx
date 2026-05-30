import { useEffect, useMemo, useState } from "react";
import {
  useLocalStorage,
  STORAGE_KEYS,
  emptyDay,
  emptyWeek,
  makeId,
} from "./storage.js";
import { weekIdFor, DAY_KEYS, DAY_LABELS_JP } from "./week.js";
import { HANDICAP_OPTIONS } from "./handicap.js";
import { aggregateDay, fmtPoints } from "./aggregate.js";
import ConfirmDialog from "./ConfirmDialog.jsx";
import GameResultModal from "./GameResultModal.jsx";

/**
 * 日別入力グリッド画面。
 *
 * - 上部: 月〜日タブで対象日を切り替え
 * - 中段: 試合追加フォーム（チーム＋ハンデ）
 * - グリッド: 顧客 × 試合。各セルでポイントと出/バックを入力
 * - 列計（試合別） / 行計（顧客別） / 全体計をリアルタイム表示
 *
 * 状態は localStorage の bb-calc-weeks 配下に書き戻す。週は ISO 週 ID
 * （月曜始まり）でキー化。
 */
export default function DailyInputScreen({ back }) {
  const wid = useMemo(() => weekIdFor(new Date()), []);
  const [weeks, setWeeks] = useLocalStorage(STORAGE_KEYS.weeks, {});
  const [customers] = useLocalStorage(STORAGE_KEYS.customers, []);
  const [teams] = useLocalStorage(STORAGE_KEYS.teams, []);

  // Default-select today's weekday.
  const [selectedDay, setSelectedDay] = useState(() => {
    const todayJs = new Date().getDay(); // 0=Sun..6=Sat
    const monStart = (todayJs + 6) % 7; // 0=Mon..6=Sun
    return DAY_KEYS[monStart];
  });

  const week = weeks[wid] ?? emptyWeek();
  const day = week[selectedDay] ?? emptyDay();

  const agg = useMemo(
    () => aggregateDay(day, customers),
    [day, customers],
  );

  const [newGameTeamId, setNewGameTeamId] = useState("");
  const [newOpponentTeamId, setNewOpponentTeamId] = useState("");
  const [newGameHandi, setNewGameHandi] = useState("1");
  /** @type {[null | any, Function]} */
  const [resultEditGame, setResultEditGame] = useState(null);
  const [confirmDeleteGame, setConfirmDeleteGame] = useState(null);

  // Auto-select first team when the team list arrives / changes.
  useEffect(() => {
    if (!newGameTeamId && teams.length > 0) {
      setNewGameTeamId(teams[0].id);
    }
  }, [teams, newGameTeamId]);

  function updateDay(mutator) {
    setWeeks((prev) => {
      const w = prev[wid] ?? emptyWeek();
      const d = w[selectedDay] ?? emptyDay();
      const nd = mutator(d);
      return { ...prev, [wid]: { ...w, [selectedDay]: nd } };
    });
  }

  function addGame() {
    if (!newGameTeamId) return;
    updateDay((d) => ({
      ...d,
      games: [
        ...d.games,
        {
          id: makeId("game"),
          teamId: newGameTeamId,
          // 対戦相手は任意。未指定なら null。
          opponentTeamId: newOpponentTeamId || null,
          handicap: newGameHandi,
          result: null,
        },
      ],
    }));
    // 同チームを連続で出すケースは稀なので相手側はリセット
    setNewOpponentTeamId("");
  }

  function updateGameHandicap(gameId, handicap) {
    updateDay((d) => ({
      ...d,
      games: d.games.map((g) => (g.id === gameId ? { ...g, handicap } : g)),
    }));
  }

  function updateGameResult(gameId, result) {
    updateDay((d) => ({
      ...d,
      games: d.games.map((g) => (g.id === gameId ? { ...g, result } : g)),
    }));
    setResultEditGame(null);
  }

  function clearGameResult(gameId) {
    updateDay((d) => ({
      ...d,
      games: d.games.map((g) => (g.id === gameId ? { ...g, result: null } : g)),
    }));
    setResultEditGame(null);
  }

  function deleteGame(gameId) {
    updateDay((d) => ({
      games: d.games.filter((g) => g.id !== gameId),
      bets: d.bets.filter((b) => b.gameId !== gameId),
    }));
    setConfirmDeleteGame(null);
  }

  function upsertBet(customerId, gameId, pointsStr, side) {
    updateDay((d) => {
      const other = d.bets.filter(
        (b) => !(b.customerId === customerId && b.gameId === gameId),
      );
      const n = parseInt(pointsStr, 10);
      if (!Number.isFinite(n) || n <= 0) {
        return { ...d, bets: other };
      }
      return { ...d, bets: [...other, { customerId, gameId, points: n, side }] };
    });
  }

  function teamName(teamId) {
    return teams.find((t) => t.id === teamId)?.name ?? "—";
  }

  function getBet(customerId, gameId) {
    return day.bets.find(
      (b) => b.customerId === customerId && b.gameId === gameId,
    );
  }

  const dayIdx = DAY_KEYS.indexOf(selectedDay);

  return (
    <div className="app">
      <header className="screen-header">
        <button className="back" onClick={back}>← 戻る</button>
        <h1>日別入力</h1>
        <p className="meta">{wid}</p>
      </header>

      <nav className="day-tabs" role="tablist">
        {DAY_KEYS.map((dk, i) => (
          <button
            key={dk}
            role="tab"
            aria-selected={dk === selectedDay}
            className={`day-tab${dk === selectedDay ? " active" : ""}`}
            onClick={() => setSelectedDay(dk)}
          >
            {DAY_LABELS_JP[i]}
          </button>
        ))}
      </nav>

      <main>
        {customers.length === 0 || teams.length === 0 ? (
          <section className="card">
            <h2>準備中</h2>
            <p className="empty">
              {customers.length === 0 && "顧客が未登録です。"}
              {customers.length === 0 && teams.length === 0 && " "}
              {teams.length === 0 && "チームが未登録です。"}
              <br />
              ← 戻る から「管理」で先に登録してください。
            </p>
          </section>
        ) : (
          <>
            <section className="card">
              <h2>試合追加 ({DAY_LABELS_JP[dayIdx]})</h2>
              <div className="add-game-grid">
                <label className="add-game-label">出し側（強）</label>
                <select
                  value={newGameTeamId}
                  onChange={(e) => setNewGameTeamId(e.target.value)}
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>

                <label className="add-game-label">対戦相手</label>
                <select
                  value={newOpponentTeamId}
                  onChange={(e) => setNewOpponentTeamId(e.target.value)}
                >
                  <option value="">（指定なし）</option>
                  {teams
                    .filter((t) => t.id !== newGameTeamId)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>

                <label className="add-game-label">ハンデ</label>
                <select
                  value={newGameHandi}
                  onChange={(e) => setNewGameHandi(e.target.value)}
                >
                  {HANDICAP_OPTIONS.map((h) => (
                    <option key={h} value={h}>
                      {h === "0" ? "0 (スクラッチ)" : h}
                    </option>
                  ))}
                </select>

                <button className="primary add-game-btn" onClick={addGame}>
                  追加
                </button>
              </div>
            </section>

            <section className="card grid-card">
              <h2>{DAY_LABELS_JP[dayIdx]}曜日 グリッド</h2>
              {day.games.length === 0 ? (
                <p className="empty">この日の試合がまだ登録されていません</p>
              ) : (
                <div className="grid-scroll">
                  <table className="bet-grid">
                    <thead>
                      <tr>
                        <th className="sticky-left corner">顧客</th>
                        {day.games.map((g) => (
                          <th key={g.id} className="game-col-head">
                            <div className="game-team-row">
                              <span className="game-team-name">
                                <span className="give-team">
                                  {teamName(g.teamId)}
                                </span>
                                <span className="give-handi">
                                  {g.handicap === "0"
                                    ? ""
                                    : ` -${g.handicap}`}
                                </span>
                                {g.opponentTeamId && (
                                  <>
                                    <span className="vs-sep"> vs </span>
                                    <span className="opp-team">
                                      {teamName(g.opponentTeamId)}
                                    </span>
                                  </>
                                )}
                              </span>
                              <button
                                className="game-delete"
                                onClick={() => setConfirmDeleteGame(g)}
                                aria-label="試合を削除"
                              >
                                ×
                              </button>
                            </div>
                            <select
                              className="handi-select"
                              value={g.handicap}
                              onChange={(e) =>
                                updateGameHandicap(g.id, e.target.value)
                              }
                            >
                              {HANDICAP_OPTIONS.map((h) => (
                                <option key={h} value={h}>
                                  {h === "0" ? "0 (スクラッチ)" : h}
                                </option>
                              ))}
                            </select>
                            <button
                              className={`result-btn${
                                g.result ? " set" : ""
                              }`}
                              onClick={() => setResultEditGame(g)}
                            >
                              {formatResultLabel(g.result)}
                            </button>
                          </th>
                        ))}
                        <th className="sticky-right corner">行計</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.map((c) => (
                        <tr key={c.id}>
                          <th className="sticky-left customer-name">
                            {c.name}
                          </th>
                          {day.games.map((g) => {
                            const bet = getBet(c.id, g.id);
                            const value = agg.cells[c.id]?.[g.id];
                            return (
                              <td key={g.id} className="bet-cell-td">
                                <BetCell
                                  bet={bet}
                                  value={value}
                                  gameHasResult={Boolean(g.result)}
                                  onChange={(p, s) =>
                                    upsertBet(c.id, g.id, p, s)
                                  }
                                />
                              </td>
                            );
                          })}
                          <td className="sticky-right num row-total">
                            <ResultPoint value={agg.rowTotals[c.id]} />
                          </td>
                        </tr>
                      ))}
                      <tr className="totals-row">
                        <th className="sticky-left corner">列計</th>
                        {day.games.map((g) => (
                          <td key={g.id} className="num col-total">
                            <ResultPoint value={agg.colTotals[g.id]} />
                          </td>
                        ))}
                        <td className="sticky-right num grand-total">
                          <ResultPoint value={agg.grandTotal} strong />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {resultEditGame && (
        <GameResultModal
          teamName={teamName(resultEditGame.teamId)}
          opponentTeamName={
            resultEditGame.opponentTeamId
              ? teamName(resultEditGame.opponentTeamId)
              : null
          }
          handicap={resultEditGame.handicap}
          initial={resultEditGame.result}
          onSave={(r) => updateGameResult(resultEditGame.id, r)}
          onCancel={() => setResultEditGame(null)}
          onClear={() => clearGameResult(resultEditGame.id)}
        />
      )}

      {confirmDeleteGame && (
        <ConfirmDialog
          message={`「${teamName(confirmDeleteGame.teamId)}${
            confirmDeleteGame.opponentTeamId
              ? ` vs ${teamName(confirmDeleteGame.opponentTeamId)}`
              : ""
          }」の試合を削除しますか？\n（この試合の全顧客の賭けも消えます）`}
          confirmLabel="削除する"
          onConfirm={() => deleteGame(confirmDeleteGame.id)}
          onCancel={() => setConfirmDeleteGame(null)}
        />
      )}
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────

function formatResultLabel(result) {
  if (!result) return "結果";
  if (result.draw) return "引分";
  return result.won ? `勝 ${result.scoreDiff}` : `負 ${result.scoreDiff}`;
}

/**
 * 1セル分の入力ウィジェット。
 * 親が bet オブジェクトを真値として渡し、内部で side のみローカル状態
 * （bet が無くても「バック」を先に選べるようにするため）。
 */
function BetCell({ bet, value, gameHasResult, onChange }) {
  const [side, setSide] = useState(bet?.side ?? "give");

  // External update synced (e.g., bet edited elsewhere).
  useEffect(() => {
    if (bet?.side && bet.side !== side) setSide(bet.side);
  }, [bet?.side]); // eslint-disable-line react-hooks/exhaustive-deps

  const pointsDisplay = bet?.points ?? "";

  function handlePointsInput(val) {
    onChange(val, side);
  }

  function changeSide(newSide) {
    setSide(newSide);
    if (bet?.points) {
      onChange(String(bet.points), newSide);
    }
  }

  return (
    <div className="bet-cell">
      <input
        type="number"
        inputMode="numeric"
        min="0"
        max="9999"
        placeholder="—"
        value={pointsDisplay}
        onChange={(e) => handlePointsInput(e.target.value)}
      />
      <div className="side-toggle">
        <button
          type="button"
          className={`side-btn${side === "give" ? " active" : ""}`}
          onClick={() => changeSide("give")}
          title="ハンデ出し側"
        >
          出
        </button>
        <button
          type="button"
          className={`side-btn${side === "receive" ? " active" : ""}`}
          onClick={() => changeSide("receive")}
          title="ハンデ受け側 (バック)"
        >
          バック
        </button>
      </div>
      <div className="bet-result">
        {gameHasResult && bet ? (
          <ResultPoint value={value ?? 0} small />
        ) : (
          <span className="neutral small">—</span>
        )}
      </div>
    </div>
  );
}

/**
 * ポイント値を符号付きで色分け表示。
 *  - 正: 緑 (+xx)
 *  - 負: 赤 (-xx)
 *  - 0:  グレー (±0)
 */
function ResultPoint({ value, small = false, strong = false }) {
  if (value == null) {
    return <span className={`neutral${small ? " small" : ""}`}>—</span>;
  }
  if (value === 0) {
    return (
      <span
        className={`neutral${small ? " small" : ""}${strong ? " strong" : ""}`}
      >
        ±0
      </span>
    );
  }
  const cls = value > 0 ? "plus" : "minus";
  const sign = value > 0 ? "+" : "−";
  const abs = Math.abs(value);
  return (
    <span
      className={`${cls}${small ? " small" : ""}${strong ? " strong" : ""}`}
    >
      {sign}
      {fmtPoints(abs)}
    </span>
  );
}
