import { NextResponse, type NextRequest } from "next/server";
import { MAX_ORIGINAL_BYTES, ORIGINAL_TYPES, ORIGINALS_PREFIX, presignPuts, r2Enabled, readTicket } from "../../_r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Step 2 of a registration: right after the form is saved, the browser asks for signed upload links so it can send
   the ORIGINAL photos straight to Cloudflare R2 (they never pass through the website, so there's no size limit).
   The ticket from the saved registration is the proof; links are for that registration's folder only. */
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

const hits = new Map<string, { n: number; reset: number }>();
const clientIp = (req: NextRequest) => req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

export async function POST(req: NextRequest) {
  if (!r2Enabled) return json({ error: "Original uploads aren't enabled." }, 404);
  const ip = clientIp(req);
  const now = Date.now();
  const h = hits.get(ip);
  if (h && h.reset > now && h.n >= 20) return json({ error: "Too many attempts." }, 429);
  hits.set(ip, h && h.reset > now ? { n: h.n + 1, reset: h.reset } : { n: 1, reset: now + 10 * 60 * 1000 });

  let b: { ticket?: unknown; files?: unknown };
  try { b = await req.json(); } catch { return json({ error: "Bad request." }, 400); }
  const folder = readTicket(b.ticket);
  if (!folder) return json({ error: "That upload link has expired. Your registration was still saved." }, 403);

  const files = Array.isArray(b.files) ? b.files.slice(0, 5) : [];
  if (files.length === 0) return json({ error: "No files." }, 400);

  const items: { key: string; type: string }[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i] as { type?: unknown; size?: unknown };
    const ext = typeof f.type === "string" ? ORIGINAL_TYPES[f.type.toLowerCase()] : undefined;
    const size = Number(f.size);
    if (!ext || !Number.isFinite(size) || size <= 0 || size > MAX_ORIGINAL_BYTES) return json({ error: `Photo ${i + 1} isn't a supported image or is over 25 MB.` }, 400);
    items.push({ key: `${ORIGINALS_PREFIX}/${folder}/orig-${i + 1}.${ext}`, type: (f.type as string).toLowerCase() });
  }
  let urls: string[];
  try { urls = await presignPuts(items); } catch (e) { console.error("Upload links failed:", (e as Error).message); return json({ error: "Original uploads are unavailable right now." }, 502); }
  const uploads = items.map((it, i) => ({ url: urls[i], type: it.type }));
  return json({ uploads });
}
