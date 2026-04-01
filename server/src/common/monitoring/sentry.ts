import * as Sentry from '@sentry/node';

let sentryInitialized = false;

export function initSentry(dsn?: string | null) {
  if (!dsn || sentryInitialized) {
    return;
  }

  Sentry.init({
    dsn,
    tracesSampleRate: 0.2,
    environment: process.env.NODE_ENV,
  });

  sentryInitialized = true;
}

export function captureSentryException(exception: unknown) {
  if (!sentryInitialized) {
    return;
  }

  Sentry.captureException(exception);
}
