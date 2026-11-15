import * as Sentry from "@sentry/nextjs";

/** Tells Sentry about a problem the route handled itself (it still answers the visitor normally).
 *  Only a short label and the error text are sent, never the request, so no member details leave the server. */
export function reportError(label: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err ?? "");
  Sentry.captureException(err instanceof Error ? err : new Error(`${label}: ${message}`.slice(0, 300)), { tags: { area: label }, extra: { message: message.slice(0, 300) } });
}
