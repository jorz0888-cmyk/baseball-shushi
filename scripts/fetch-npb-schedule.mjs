// NPB 公式日程ページから 1 年分の試合カードを取得して
// schedule.js 形式の JSON を吐く補助スクリプト。
//
// 依存ゼロ (Node 22+ の組み込み fetch を使う)。実行:
//   node scripts/fetch-npb-schedule.mjs 2026 > /tmp/sched.json
//
// 出力をそのまま schedule.js の NPB_SCHEDULE オブジェクトに
// 貼り付ける（または手で diff して必要な日だけマージする）。
//
// パース戦略:
//   NPB 公式の月別 HTML は「日付ヘッダ → 当日の各カードを 1 行」で
//   並ぶシンプルな構造。チーム名は 12 通りの正規化辞書で揃える。
//   球場名や順位表など余計な行は正規化辞書に当たらないので落ちる。
//
// 注意:
//   - 雨天中止 / 休養日 は HTML 上「-」表示。空配列にせずキー自体を
//     作らない方針 (gamesOn が空を返して UI 側で「試合なし」を出す)。
//   - CS / 日本シリーズはチーム名が「未定」で出力されるので除外。
//   - WebFetch の方が表現の揺れを LLM が吸収してくれて安定するが、
//     こちらは「自分の環境でいつでも再実行できる」という利点がある。

const YEAR = parseInt(process.argv[2] ?? "2026", 10);

const TEAMS = [
  "巨人",
  "阪神",
  "DeNA",
  "広島",
  "中日",
  "ヤクルト",
  "ソフトバンク",
  "ロッテ",
  "楽天",
  "西武",
  "オリックス",
  "日本ハム",
];

// HTML 内に出現しうる表記揺れを正規形に揃える。NPB 公式は概ね略称
// (巨人 / 阪神 / DeNA / ...) だが、媒体や年度によって正式名や愛称
// が混ざることがあるので念のため。
const ALIASES = {
  読売: "巨人",
  ジャイアンツ: "巨人",
  タイガース: "阪神",
  横浜: "DeNA",
  横浜DeNA: "DeNA",
  ベイスターズ: "DeNA",
  カープ: "広島",
  ドラゴンズ: "中日",
  東京ヤクルト: "ヤクルト",
  スワローズ: "ヤクルト",
  福岡ソフトバンク: "ソフトバンク",
  ホークス: "ソフトバンク",
  千葉ロッテ: "ロッテ",
  マリーンズ: "ロッテ",
  東北楽天: "楽天",
  イーグルス: "楽天",
  埼玉西武: "西武",
  ライオンズ: "西武",
  オリックスバファローズ: "オリックス",
  バファローズ: "オリックス",
  北海道日本ハム: "日本ハム",
  ファイターズ: "日本ハム",
};

/** 入力チーム名を正規化。マッチしなければ null。*/
function normalizeTeam(raw) {
  const s = String(raw ?? "").trim();
  if (TEAMS.includes(s)) return s;
  if (ALIASES[s]) return ALIASES[s];
  return null;
}

/** HTML タグ除去 + 連続空白圧縮。*/
function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 1 ヶ月分の HTML から「日付 → 対戦カード配列」を作る。
 * NPB 公式は <h3> 等で日付ヘッダ、<tr> 行で各試合を出すので、
 * 行を順に走査して直近の日付ヘッダに紐付ける、という戦略。
 */
function parseMonthHtml(year, month, html) {
  const result = {};
  // 日付ヘッダ (例: "5月31日") と試合行 (12球団のいずれかが
  // 2チーム並ぶ行) を同時に抽出してオフセット順に並べる。
  const tokens = [];

  const dateRe = /(\d{1,2})月(\d{1,2})日/g;
  let m;
  while ((m = dateRe.exec(html)) !== null) {
    const mo = parseInt(m[1], 10);
    const da = parseInt(m[2], 10);
    if (mo !== month) continue;
    tokens.push({ pos: m.index, type: "date", day: da });
  }

  // 試合行はおおまかに「チームA ... チームB」が同じ行に並ぶ。
  // HTML が安定しないので、TEAMS の正規表現で 2 つの隣接する
  // チーム名 (間が 200 文字以内) を 1 試合とみなす素朴な戦略。
  const teamPattern = TEAMS.concat(Object.keys(ALIASES))
    .sort((a, b) => b.length - a.length) // longest-match first
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const pairRe = new RegExp(
    `(${teamPattern})[^]{0,200}?(${teamPattern})`,
    "g",
  );
  while ((m = pairRe.exec(html)) !== null) {
    const home = normalizeTeam(m[1]);
    const away = normalizeTeam(m[2]);
    if (!home || !away || home === away) continue;
    tokens.push({ pos: m.index, type: "game", home, away });
  }

  tokens.sort((a, b) => a.pos - b.pos);

  let currentDay = null;
  for (const tk of tokens) {
    if (tk.type === "date") {
      currentDay = tk.day;
      continue;
    }
    if (currentDay == null) continue;
    const key = `${year}-${String(month).padStart(2, "0")}-${String(currentDay).padStart(2, "0")}`;
    if (!result[key]) result[key] = [];
    // 同日に重複する組合せは捨てる（正規表現が重複マッチしやすい）
    const dup = result[key].some(
      (g) => g.home === tk.home && g.away === tk.away,
    );
    if (!dup) result[key].push({ home: tk.home, away: tk.away });
  }
  return result;
}

async function main() {
  const monthly = [3, 4, 5, 6, 7, 8, 9, 10];
  const combined = {};
  for (const mo of monthly) {
    const url = `https://npb.jp/games/${YEAR}/schedule_${String(mo).padStart(2, "0")}_detail.html`;
    process.stderr.write(`fetching ${url}\n`);
    let html;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        process.stderr.write(`  HTTP ${res.status}\n`);
        continue;
      }
      html = await res.text();
    } catch (err) {
      process.stderr.write(`  fetch failed: ${err.message}\n`);
      continue;
    }
    const dayMap = parseMonthHtml(YEAR, mo, html);
    Object.assign(combined, dayMap);
    process.stderr.write(`  parsed ${Object.keys(dayMap).length} days\n`);
  }
  process.stdout.write(JSON.stringify(combined, null, 2) + "\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
