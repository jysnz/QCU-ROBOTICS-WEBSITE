import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV !== 'production';

// Public addresses of the Cloudflare R2 buckets (otherphotos, matches). *.r2.dev is allowed below already; this also
// covers a custom domain if one is connected to a bucket later.
const r2Hosts = ['NEXT_PUBLIC_R2_URL_OTHERPHOTOS', 'NEXT_PUBLIC_R2_URL_MATCHES']
  .map((k) => process.env[k])
  .filter((u): u is string => !!u)
  .map((u) => { try { return new URL(u).hostname; } catch { return ''; } })
  .filter(Boolean);

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        // Match videos + thumbnails live in a Cloudflare R2 public bucket.
        protocol: 'https',
        hostname: '*.r2.dev',
      },
      ...r2Hosts.map((hostname) => ({ protocol: 'https' as const, hostname })),
    ],
    // r2.dev public URLs are rate-limited by Cloudflare and stall under bursts,
    // so route thumbnails through the image optimizer and cache them for 31 days.
    minimumCacheTTL: 2678400,
  },
  async rewrites() {
    // The member registration page is a static app in public/member-reg/.
    return {
      beforeFiles: [{ source: '/member-reg', destination: '/member-reg/index.html' }],
    };
  },
  async headers() {
    const scriptSrc = isDevelopment
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'"
      : "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'";

    return [
      {
        // /member-reg loads Cloudflare Turnstile + Google Fonts, so it gets its own (still strict) policy below.
        source: '/((?!member-reg|admin).*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'credentialless',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "base-uri 'self'",
              "frame-ancestors 'none'",
              "object-src 'none'",
              scriptSrc,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' https: data: blob:",
              "media-src 'self' https: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https: blob:",
              "worker-src 'self' blob:",
              "form-action 'self' https://forms.gle",
            ].join('; '),
          },
        ],
      },
      {
        // /admin loads Cloudflare Turnstile and talks to Supabase from the browser.
        source: '/admin/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Cache-Control', value: 'no-store' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "base-uri 'self'",
              "frame-ancestors 'none'",
              "object-src 'none'",
              `${scriptSrc} https://challenges.cloudflare.com`,
              "frame-src https://challenges.cloudflare.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' https: data: blob:",
              "media-src 'self' https: blob:",
              "worker-src 'self' blob:",
              "font-src 'self' data:",
              "connect-src 'self' https:",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
      {
        source: '/member-reg/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' }, // the registration page isn't meant to be found through search
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          // No COEP/CORP/COOP here: they would block the Turnstile iframe.
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "base-uri 'self'",
              "frame-ancestors 'none'",
              "object-src 'none'",
              "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
              "frame-src https://challenges.cloudflare.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' data: https://fonts.gstatic.com",
              "img-src 'self' data: blob:",
              "connect-src 'self' https://challenges.cloudflare.com https://*.r2.cloudflarestorage.com",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
