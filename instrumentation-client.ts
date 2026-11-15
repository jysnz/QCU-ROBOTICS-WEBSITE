import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./app/lib/sentryCommon";

// Browser errors (public site and admin panel).
Sentry.init(sentryOptions);

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
