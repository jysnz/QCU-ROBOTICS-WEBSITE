import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV !== 'production';

const nextConfig: NextConfig = {
  async headers() {
    const scriptSrc = isDevelopment
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self'";

    return [
      {
        source: '/:path*',
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
              "connect-src 'self' https:",
              "form-action 'self' https://forms.gle",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
