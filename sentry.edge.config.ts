import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./app/lib/sentryCommon";

Sentry.init(sentryOptions);
