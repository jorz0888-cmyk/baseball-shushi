/**
 * NPB 試合スケジュール (yyyy-mm-dd → 対戦カードの配列)。
 *
 * 各エントリのキーは JST 日付（"2026-05-31" など）。値はその日の
 * 対戦カードの配列で、各要素は { home, away } 形式。チーム名は
 * npbTeams.js の NPB_TEAMS_PRESET の name と完全一致させる。
 *
 * ★ 重要：このファイルは現時点で**空** ★
 *
 * 実シーズン日程は外部データ（NPB 公式 / 球団公式 / スポーツ媒体 等）
 * から供給して埋める想定。「今日の試合を追加」ボタンは gamesOn() を
 * 通して読み込むので、ここを充填するだけでアプリ側のロジック変更は
 * 不要。1日分のサンプルだけコメントアウトで残してある（フォーマット
 * 確認用）。
 *
 * 日付キーを増やす際の注意:
 *   - "home" / "away" の名前は NPB_TEAMS_PRESET の name と一致必須
 *   - 同じ日に複数試合（最大 6 試合）OK
 *   - 雨天中止などで試合が無い日はキー自体を作らない（gamesOn が
 *     空配列を返し、UI で「試合なし」表示）
 */
export const NPB_SCHEDULE = Object.freeze({
  // 形式サンプル (実データではない):
  // "2026-05-31": [
  //   { home: "巨人", away: "阪神" },
  //   { home: "DeNA", away: "中日" },
  //   { home: "広島", away: "ヤクルト" },
  //   { home: "ソフトバンク", away: "ロッテ" },
  //   { home: "楽天", away: "西武" },
  //   { home: "オリックス", away: "日本ハム" },
  // ],
});

/**
 * 指定日の試合カード配列を返す。データなしなら空配列。
 *
 * @param {string} yyyyMmDd  — "2026-05-31" 形式
 * @returns {{ home: string, away: string }[]}
 */
export function gamesOn(yyyyMmDd) {
  return NPB_SCHEDULE[yyyyMmDd] || [];
}

/**
 * Date オブジェクトから JST の "yyyy-mm-dd" キーを生成。
 * @param {Date} date
 * @returns {string}
 */
export function dateKey(date) {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(jst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
