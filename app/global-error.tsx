"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/* Last-resort error screen: shown only when the whole page crashed. The error is sent to Sentry. */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#020617", color: "#e2e8f0", fontFamily: "system-ui, sans-serif", textAlign: "center", padding: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ color: "#94a3b8", margin: "0 0 20px" }}>The team has been notified. Please try again.</p>
          <a href="/" style={{ color: "#c8f560" }}>Back to home</a>
        </div>
      </body>
    </html>
  );
}
