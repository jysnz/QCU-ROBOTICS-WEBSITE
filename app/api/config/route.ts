import { NextResponse } from "next/server";

// Rebuilt at most once an hour instead of on every request: the value is the same public key for everyone.
export const revalidate = 3600;

// Public Cloudflare Turnstile site key for the /member-reg page.
export function GET() {
  return NextResponse.json(
    { turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || "" },
    // browsers keep it 5 minutes, Vercel's CDN an hour, and either may show the old copy for a day while refreshing
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
