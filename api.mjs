// Storyteller word games — site API (Netlify Function + Netlify Blobs)
//
// Setup:
//   1. Put this file at netlify/functions/api.mjs in your site repo.
//   2. npm i @netlify/blobs
//   3. In Netlify site settings, add an environment variable HOST_KEY (any secret string).
//   4. Deploy. The Host Console's "Host key" field must match HOST_KEY.
//
// Routes (config.path maps /api/* to this function):
//   GET  /api/game   -> active game JSON (or null)
//   PUT  /api/game   -> publish (requires x-host-key header)
//   GET  /api/track  -> { click, win, fail, login } counters
//   POST /api/track  -> { event: "click" | "win" | "fail" | "login" } increments one
import { getStore } from "@netlify/blobs";

const EVENTS = ["click", "win", "fail", "login"];
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

export default async (req) => {
  const store = getStore("storyteller");
  const path = new URL(req.url).pathname;

  if (path.endsWith("/game")) {
    if (req.method === "PUT") {
      if (req.headers.get("x-host-key") !== process.env.HOST_KEY) return json({ error: "bad host key" }, 401);
      const body = await req.text();
      try { JSON.parse(body); } catch { return json({ error: "invalid JSON" }, 400); }
      await store.set("active-game", body);
      return json({ ok: true });
    }
    const game = await store.get("active-game");
    return new Response(game ?? "null", { headers: { "content-type": "application/json" } });
  }

  if (path.endsWith("/track")) {
    if (req.method === "POST") {
      const { event } = await req.json().catch(() => ({}));
      if (!EVENTS.includes(event)) return json({ error: "unknown event" }, 400);
      const n = Number((await store.get("count-" + event)) ?? 0);
      await store.set("count-" + event, String(n + 1));
      return json({ ok: true });
    }
    const out = {};
    for (const k of EVENTS) out[k] = Number((await store.get("count-" + k)) ?? 0);
    return json(out);
  }

  return json({ error: "not found" }, 404);
};

export const config = { path: "/api/*" };
