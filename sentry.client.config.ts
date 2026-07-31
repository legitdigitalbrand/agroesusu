import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || "",
  environment: process.env.NODE_ENV === "production" ? "production" : "development",
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  // Don't capture user IP
  sendDefaultPii: false,
  // Scrub sensitive data
  beforeSend(event) {
    if (event.request?.data) {
      const data = event.request.data as Record<string, unknown>;
      const sensitiveKeys = ['password', 'pin', 'token', 'secret', 'key', 'authorization', 'bvn', 'nin'];
      for (const key of Object.keys(data)) {
        if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
          data[key] = '[REDACTED]';
        }
      }
    }
    return event;
  },
});
