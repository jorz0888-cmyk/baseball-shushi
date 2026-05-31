/**
 * NPB 12 球団プリセット。
 *
 * 「12球団を一括追加」ボタンで一気に登録できるよう、確実に変わらない
 * 球団名のみを保持。ハンデは試合ごと（DailyInput）で個別に設定する
 * のでここでは持たない。
 *
 * `league` は schedule.js から「同リーグ vs 同リーグ」と「交流戦」を
 * 区別したい場面で参照される。UI 上は使わない。
 */
export const NPB_TEAMS_PRESET = Object.freeze([
  // セ・リーグ
  { name: "巨人", league: "セ" },
  { name: "阪神", league: "セ" },
  { name: "DeNA", league: "セ" },
  { name: "広島", league: "セ" },
  { name: "中日", league: "セ" },
  { name: "ヤクルト", league: "セ" },
  // パ・リーグ
  { name: "ソフトバンク", league: "パ" },
  { name: "ロッテ", league: "パ" },
  { name: "楽天", league: "パ" },
  { name: "西武", league: "パ" },
  { name: "オリックス", league: "パ" },
  { name: "日本ハム", league: "パ" },
]);
