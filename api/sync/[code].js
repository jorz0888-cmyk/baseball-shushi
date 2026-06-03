// Vercel Serverless Function — /api/sync/[code]
//
// 6 文字の同期コードを key に、エクスポートしたアプリ状態 JSON を 1
// レコードとして読み書きする。認証なし（コードを知っている人だけが
// アクセス）。Upstash Redis (Vercel KV integration) を裏に使う。
//
// セットアップ手順:
//   1. Vercel Dashboard → 該当プロジェクト → Storage タブ
//   2. 「Create Database」 → Marketplace から Upstash Redis を選択
//   3. 連携後、KV_REST_API_URL / KV_REST_API_TOKEN 等が自動で本番
//      環境変数に設定される
//
// データ保持期間 90 日 (EX = 7,776,000秒)。最終 PUT から 90 日経つと
// 自動で消える。それでいいレベルの想定。

import { kv } from "@vercel/kv";

// 同期コードの許容文字: 紛らわしい 0/O、1/I/l を除いた英数字 + ハイフン
const CODE_RE = /^[A-HJ-NP-Z2-9-]{6,12}$/i;

const TTL_SEC = 60 * 60 * 24 * 90; // 90 days
const MAX_BODY_BYTES = 1_000_000;  // 1 MB ── 通常用途には十分

export default async function handler(req, res) {
  const code = String(req.query.code || "")
    .toUpperCase()
    .trim();

  if (!CODE_RE.test(code)) {
    return res
      .status(400)
      .json({ error: "Invalid sync code format" });
  }

  const key = `bbsync:${code}`;

  try {
    if (req.method === "GET") {
      const data = await kv.get(key);
      if (!data) {
        return res.status(404).json({ error: "No data for this code" });
      }
      return res.status(200).json(data);
    }

    if (req.method === "PUT") {
      const body = req.body;
      if (!body || typeof body !== "object") {
        return res.status(400).json({ error: "Body must be a JSON object" });
      }
      const size = Buffer.byteLength(JSON.stringify(body), "utf8");
      if (size > MAX_BODY_BYTES) {
        return res
          .status(413)
          .json({ error: `Payload too large (${size} > ${MAX_BODY_BYTES})` });
      }
      const stored = {
        ...body,
        cloudUpdatedAt: new Date().toISOString(),
      };
      await kv.set(key, stored, { ex: TTL_SEC });
      return res
        .status(200)
        .json({ ok: true, cloudUpdatedAt: stored.cloudUpdatedAt });
    }

    if (req.method === "DELETE") {
      await kv.del(key);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, PUT, DELETE");
    return res
      .status(405)
      .json({ error: `Method ${req.method} not allowed` });
  } catch (err) {
    console.error("[sync] error:", err);
    return res
      .status(500)
      .json({
        error: "Internal error",
        message: err instanceof Error ? err.message : String(err),
      });
  }
}
