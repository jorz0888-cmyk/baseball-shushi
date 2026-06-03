// Vercel Serverless Function — /api/sync/[code]
//
// 6 文字の同期コードを key に、エクスポートしたアプリ状態 JSON を 1
// レコードとして読み書きする。Upstash Redis (Marketplace 経由) の
// REST API を直接叩く。@vercel/kv の薄いラッパーは Marketplace 経由
// の Upstash 連携で初期化が失敗するケースがあるため、@upstash/redis
// を直接使用。
//
// 必要な環境変数 (Marketplace 連携でプレフィックス = KV にした場合):
//   KV_REST_API_URL
//   KV_REST_API_TOKEN
//
// 動作確認:
//   curl -X GET https://<your-app>.vercel.app/api/sync/AAA-AAA → 404
//   curl -X PUT -H 'content-type: application/json' \
//     -d '{"data":{"foo":1}}' https://<your-app>.vercel.app/api/sync/AAA-AAA
//   curl -X GET https://<your-app>.vercel.app/api/sync/AAA-AAA → 200

import { Redis } from "@upstash/redis";

const CODE_RE = /^[A-HJ-NP-Z2-9-]{6,12}$/i;
const TTL_SEC = 60 * 60 * 24 * 90;  // 90 days
const MAX_BODY_BYTES = 1_000_000;   // 1 MB

/** 起動時に envar を確認しつつ Redis クライアントを 1 度だけ作る。*/
let _redis = null;
let _initError = null;
function getRedis() {
  if (_redis) return _redis;
  if (_initError) throw _initError;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    _initError = new Error(
      `Missing Upstash env vars — KV_REST_API_URL=${
        url ? "set" : "MISSING"
      }, KV_REST_API_TOKEN=${token ? "set" : "MISSING"}. Connect a Vercel KV / Upstash Redis database to this project and redeploy.`,
    );
    throw _initError;
  }
  _redis = new Redis({ url, token });
  return _redis;
}

export default async function handler(req, res) {
  // どの段階で落ちたかを返せるよう、try の中で each step を分けて
  // メッセージに含める。
  let stage = "init";
  try {
    const code = String(req.query?.code || "").toUpperCase().trim();
    stage = "validate-code";
    if (!CODE_RE.test(code)) {
      return res.status(400).json({
        error: "Invalid sync code format",
        received: code,
        hint: "Expected 6-12 chars of A-Z (excluding I/O) and 2-9, optionally with hyphens",
      });
    }

    stage = "init-redis";
    const redis = getRedis();
    const key = `bbsync:${code}`;

    if (req.method === "GET") {
      stage = "get";
      const data = await redis.get(key);
      if (!data) return res.status(404).json({ error: "No data for this code" });
      return res.status(200).json(data);
    }

    if (req.method === "PUT") {
      stage = "parse-body";
      let body = req.body;
      // Vercel は通常 JSON を自動 parse するが、保険で文字列なら parse
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch (e) {
          return res.status(400).json({ error: "Body is not valid JSON" });
        }
      }
      if (!body || typeof body !== "object") {
        return res.status(400).json({ error: "Body must be a JSON object" });
      }
      stage = "check-size";
      const serialized = JSON.stringify(body);
      const size = new TextEncoder().encode(serialized).length;
      if (size > MAX_BODY_BYTES) {
        return res.status(413).json({
          error: `Payload too large (${size} > ${MAX_BODY_BYTES})`,
        });
      }
      stage = "set";
      const stored = { ...body, cloudUpdatedAt: new Date().toISOString() };
      await redis.set(key, stored, { ex: TTL_SEC });
      return res
        .status(200)
        .json({ ok: true, cloudUpdatedAt: stored.cloudUpdatedAt });
    }

    if (req.method === "DELETE") {
      stage = "del";
      await redis.del(key);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, PUT, DELETE");
    return res
      .status(405)
      .json({ error: `Method ${req.method} not allowed` });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : null;
    console.error("[sync] error at", stage, "—", message, stack);
    return res.status(500).json({
      error: "Internal error",
      stage,
      message,
      // 本番でもメッセージは返す ── ユーザに直接見せて原因切り分けを
      // 速くするため。クレデンシャル本体は元から含めていない。
    });
  }
}
