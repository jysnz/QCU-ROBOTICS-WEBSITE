import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Public Cloudflare Turnstile site key for the /member-reg page.
export function GET() {
  return NextResponse.json(
    { turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || "" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
