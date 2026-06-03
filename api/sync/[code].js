// Vercel Serverless Function — /api/sync/[code]
//
// node-redis (v4) で Redis URL に TCP 接続する版。Vercel KV / Upstash
// 連携で REST credentials (KV_REST_API_URL / TOKEN) が無く、Redis URL
// (KV_REDIS_URL) しか提供されないケースに対応。
//
// Vercel API routes はデフォルトで Node.js runtime なので TCP 接続可能。
//
// 接続再利用: グローバル変数に Promise をキャッシュし、warm invocation
// では既存接続を使い回す。cold start のみ新規接続。
//
// 環境変数（優先順位順、いずれかが設定されていれば動く）:
//   KV_REDIS_URL
//   KV_URL
//   REDIS_URL
//   UPSTASH_REDIS_URL

import { createClient } from "redis";

const CODE_RE = /^[A-HJ-NP-Z2-9-]{6,12}$/i;
const TTL_SEC = 60 * 60 * 24 * 90;  // 90 days
const MAX_BODY_BYTES = 1_000_000;   // 1 MB

const URL_CANDIDATES = [
  "KV_REDIS_URL",
  "KV_URL",
  "REDIS_URL",
  "UPSTASH_REDIS_URL",
];

function findRedisUrl() {
  for (const name of URL_CANDIDATES) {
    const v = process.env[name];
    if (v) return { name, url: v };
  }
  return null;
}

let _clientPromise = null;
function getClient() {
  if (_clientPromise) return _clientPromise;
  const got = findRedisUrl();
  if (!got) {
    return Promise.reject(
      new Error(
        `Missing Redis URL env var. Tried: ${URL_CANDIDATES.join(", ")}. Configure Vercel KV / Upstash Redis on the project and redeploy.`,
      ),
    );
  }
  const client = createClient({
    url: got.url,
    socket: {
      connectTimeout: 5_000,
    },
  });
  // error イベントは silent にせず log（serverless では function 終了
  // までしか効かないが、Vercel Logs で原因確認できる）
  client.on("error", (e) => {
    console.error("[redis] client error:", e?.message ?? e);
  });
  _clientPromise = client
    .connect()
    .then(() => client)
    .catch((err) => {
      // 次の呼び出しで再試行できるようキャッシュをクリア
      _clientPromise = null;
      throw err;
    });
  return _clientPromise;
}

export default async function handler(req, res) {
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

    stage = "connect-redis";
    const client = await getClient();
    const key = `bbsync:${code}`;

    if (req.method === "GET") {
      stage = "get";
      const raw = await client.get(key);
      if (!raw) {
        return res.status(404).json({ error: "No data for this code" });
      }
      stage = "parse-stored";
      const data = JSON.parse(raw);
      return res.status(200).json(data);
    }

    if (req.method === "PUT") {
      stage = "parse-body";
      let body = req.body;
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
      stage = "serialize";
      const stored = { ...body, cloudUpdatedAt: new Date().toISOString() };
      const serialized = JSON.stringify(stored);
      const size = new TextEncoder().encode(serialized).length;
      if (size > MAX_BODY_BYTES) {
        return res.status(413).json({
          error: `Payload too large (${size} > ${MAX_BODY_BYTES})`,
        });
      }
      stage = "set";
      await client.set(key, serialized, { EX: TTL_SEC });
      return res
        .status(200)
        .json({ ok: true, cloudUpdatedAt: stored.cloudUpdatedAt });
    }

    if (req.method === "DELETE") {
      stage = "del";
      await client.del(key);
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
    });
  }
}
