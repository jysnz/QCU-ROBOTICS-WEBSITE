// Supabase Edge Function: r2-media
//
// Signs, copies and deletes files in the three Cloudflare R2 buckets. Like r2-photos, this is the ONLY place that
// holds the R2 keys: the website's server calls it with the service-role key, and the browser only ever sees
// short-lived signed links.
//
// Buckets (names can be overridden with the secrets in brackets):
//   memberpictures [R2_BUCKET]               registration photos (registrations/...); keep it PRIVATE, links are signed
//   tasks          [R2_BUCKET_TASKS]         task attachments (<task id>/...); keep it PRIVATE, links are signed
//   otherphotos    [R2_BUCKET_OTHERPHOTOS]   public: every other picture in the app, one folder per kind
//   matches        [R2_BUCKET_MATCHES]       public: competition match videos and thumbnails
// The API token behind R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY must be allowed to read and write all four buckets.
//
// Deploy: supabase functions deploy r2-media --project-ref szbtmeyoctkscwjcdrvg   ("Verify JWT" stays ON)
//
// Actions (POST JSON):
//   { action: "sign",   items: [{ bucket, key, method: "PUT" | "GET", type?, filename?, expires? }] } -> { urls: string[] }
//   { action: "delete", bucket, keys: string[] }                                                      -> { ok: true }
//   { action: "copy",   from: { bucket, key }, to: { bucket, key } }  or  items: [{ from, to }] (max 100) -> { ok: true }
//   { action: "list",   bucket: "matches", prefix?, token? }                                          -> { keys: [{ key, size }], next? }
import { AwsClient } from "npm:aws4fetch@1.0.20";

const env = (k: string) => Deno.env.get(k) ?? "";
const ACCOUNT = env("R2_ACCOUNT_ID");
const SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY"); // injected by Supabase

const BUCKETS: Record<string, string> = {
  memberpictures: env("R2_BUCKET") || "memberpictures",
  tasks: env("R2_BUCKET_TASKS") || "tasks",
  otherphotos: env("R2_BUCKET_OTHERPHOTOS") || "otherphotos",
  matches: env("R2_BUCKET_MATCHES") || "matches",
};
const LISTABLE = new Set(["matches"]);

// What may be written or read in each bucket. Anything else is refused, so a bug elsewhere can't spray files around.
const ALLOWED: Record<string, RegExp> = {
  memberpictures: /^registrations\//,
  tasks: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\//i,
  otherphotos: /^(members|media_team|team_members|coaches|Competition_pictures|Achievement_pictures|Sponsor_pictures|uploads)\//,
  matches: /^[A-Za-z0-9]/,
};
const KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._\-\/ ()]{0,400}$/;
const TYPE_RE = /^[a-z]+\/[a-z0-9.+\-]+$/i;
const MAX_ITEMS = 600;

const r2 = new AwsClient({ accessKeyId: env("R2_ACCESS_KEY_ID"), secretAccessKey: env("R2_SECRET_ACCESS_KEY"), service: "s3", region: "auto" });

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

function target(bucket: unknown, key: unknown) {
  if (typeof bucket !== "string" || !(bucket in BUCKETS)) throw new Error("bad bucket");
  if (typeof key !== "string" || !KEY_RE.test(key) || key.includes("..") || key.includes("//") || !ALLOWED[bucket].test(key)) throw new Error("bad key");
  return { name: BUCKETS[bucket], key, url: new URL(`https://${ACCOUNT}.r2.cloudflarestorage.com/${BUCKETS[bucket]}/${key.split("/").map(encodeURIComponent).join("/")}`) };
}

async function sign(it: { bucket?: unknown; key?: unknown; method?: unknown; type?: unknown; filename?: unknown; expires?: unknown }) {
  const { url } = target(it.bucket, it.key);
  const method = it.method === "PUT" ? "PUT" : it.method === "GET" ? "GET" : null;
  if (!method) throw new Error("bad method");
  const expires = Math.min(Math.max(Number(it.expires) || (method === "PUT" ? 600 : 3600), 60), 3600);
  url.searchParams.set("X-Amz-Expires", String(expires));
  const headers: Record<string, string> = {};
  if (method === "PUT" && typeof it.type === "string") {
    if (!TYPE_RE.test(it.type)) throw new Error("bad type");
    headers["Content-Type"] = it.type;
  }
  if (method === "GET" && typeof it.filename === "string" && it.filename) {
    // download under the real name instead of opening in the browser
    const safe = it.filename.replace(/[^\w.\- ()]+/g, "_").slice(0, 150);
    url.searchParams.set("response-content-disposition", `attachment; filename="${safe}"`);
  }
  const signed = await r2.sign(new Request(url, { method, headers }), { aws: { signQuery: true } });
  return signed.url;
}

// "Verify JWT" stays ON, so the gateway has checked the signature; here we require a service-role token.
function isServiceRole(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (SERVICE_KEY && token === SERVICE_KEY) return true;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!isServiceRole(req)) return json({ error: "Unauthorized" }, 401);
  if (!ACCOUNT || !env("R2_ACCESS_KEY_ID") || !env("R2_SECRET_ACCESS_KEY")) return json({ error: "R2 is not configured" }, 503);

  let b: { action?: string; items?: unknown[]; prefix?: unknown; token?: unknown; bucket?: unknown; keys?: unknown; from?: { bucket?: unknown; key?: unknown }; to?: { bucket?: unknown; key?: unknown } };
  try { b = await req.json(); } catch { return json({ error: "Bad request" }, 400); }

  try {
    if (b.action === "sign") {
      const items = Array.isArray(b.items) ? b.items.slice(0, MAX_ITEMS) : [];
      if (!items.length) return json({ error: "No items" }, 400);
      return json({ urls: await Promise.all(items.map((it) => sign(it as Parameters<typeof sign>[0]))) });
    }

    if (b.action === "delete") {
      const keys = Array.isArray(b.keys) ? (b.keys as unknown[]).slice(0, MAX_ITEMS) : [];
      await Promise.all(keys.map(async (k) => {
        const t = target(b.bucket, k);
        const res = await r2.fetch(t.url, { method: "DELETE" });
        if (!res.ok && res.status !== 404) throw new Error(`R2 delete ${res.status}`);
      }));
      return json({ ok: true });
    }

    if (b.action === "copy") {
      const pairs = (Array.isArray(b.items) ? b.items : [{ from: b.from, to: b.to }]).slice(0, 100) as { from?: { bucket?: unknown; key?: unknown }; to?: { bucket?: unknown; key?: unknown } }[];
      const copyOne = async (p: (typeof pairs)[number]) => {
        const from = target(p.from?.bucket, p.from?.key);
        const to = target(p.to?.bucket, p.to?.key);
        const res = await r2.fetch(to.url, { method: "PUT", headers: { "x-amz-copy-source": `/${from.name}/${from.key.split("/").map(encodeURIComponent).join("/")}` } });
        if (!res.ok) throw new Error(`R2 copy ${res.status}`);
      };
      for (let i = 0; i < pairs.length; i += 20) await Promise.all(pairs.slice(i, i + 20).map(copyOne));
      return json({ ok: true, copied: pairs.length });
    }

    if (b.action === "list") {
      const bucket = String(b.bucket);
      if (!LISTABLE.has(bucket)) throw new Error("bad bucket");
      const u = new URL(`https://${ACCOUNT}.r2.cloudflarestorage.com/${BUCKETS[bucket]}`);
      u.searchParams.set("list-type", "2");
      u.searchParams.set("max-keys", "1000");
      const prefix = (b as { prefix?: unknown }).prefix;
      const token = (b as { token?: unknown }).token;
      if (typeof prefix === "string" && prefix) u.searchParams.set("prefix", prefix);
      if (typeof token === "string" && token) u.searchParams.set("continuation-token", token);
      const res = await r2.fetch(u);
      if (!res.ok) throw new Error(`R2 list ${res.status}`);
      const xml = await res.text();
      const unxml = (v: string) => v.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
      const keys = [...xml.matchAll(/<Contents>[\s\S]*?<Key>([\s\S]*?)<\/Key>[\s\S]*?<Size>(\d+)<\/Size>[\s\S]*?<\/Contents>/g)].map((m) => ({ key: unxml(m[1]), size: Number(m[2]) }));
      const next = /<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/.exec(xml)?.[1];
      return json({ keys, ...(next ? { next: unxml(next) } : {}) });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    const m = (e as Error).message;
    if (m === "bad bucket" || m === "bad key" || m === "bad method" || m === "bad type") return json({ error: "Invalid request" }, 400);
    console.error("r2-media failed:", m);
    return json({ error: "Storage request failed" }, 502);
  }
});
