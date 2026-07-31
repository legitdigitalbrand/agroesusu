import * as Sentry from "@sentry/nextjs";

export function register() {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || "",
    environment: process.env.NODE_ENV === "production" ? "production" : "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    profilesSampleRate: 0.0,
    // Don't capture sensitive data
    beforeSend(event) {
      // Scrub any potential sensitive data from request bodies
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
    // Ignore common non-critical errors
    ignoreErrors: [
      'NEXT_NOT_FOUND',
      'NEXT_REDIRECT',
      'ResizeObserver loop limit exceeded',
    ],
  });
}
