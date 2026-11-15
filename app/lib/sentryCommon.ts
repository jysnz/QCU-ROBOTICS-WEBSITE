import type { ErrorEvent } from "@sentry/nextjs";

/* Shared Sentry settings (browser, server and edge). Errors only: no tracing, no session replay, no personal data.
   The site handles members' private details (names, mobile numbers, birthdays) and sign-in tokens, so request bodies,
   cookies, headers and query strings are stripped before anything leaves the server or the browser. */
export const sentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // only report from the live site (VERCEL_ENV is "production" there); local dev stays quiet
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.NODE_ENV === "production",
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV,
  tracesSampleRate: 0,
  sendDefaultPii: false,
  ignoreErrors: [
    "ResizeObserver loop",
    "AbortError",
    "Failed to fetch",
    "Load failed",
    "NetworkError",
    "ChunkLoadError",
    "Non-Error promise rejection captured",
  ],
  beforeSend(event: ErrorEvent) {
    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;
      delete event.request.headers;
      delete event.request.query_string;
    }
    delete event.user;
    return event;
  },
};
