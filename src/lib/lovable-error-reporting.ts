type LovableErrorOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

type LovableEvents = {
  captureException?: (
    error: unknown,
    context?: Record<string, unknown>,
    options?: LovableErrorOptions,
  ) => void;
};

declare global {
  interface Window {
    __lovableEvents?: LovableEvents;
    __lovableReportRuntimeError?: (payload: {
      message: string;
      stack?: string;
      filename?: string;
    }) => void;
  }
}

function errorMessage(error: unknown) {
  return error instanceof Response
    ? `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`
    : error instanceof Error
      ? error.message
      : String(error);
}

export function reportLovableError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;

  const message = errorMessage(error);
  const route = window.location.pathname;
  const boundary = typeof context.boundary === "string" ? context.boundary : undefined;

  window.__lovableEvents?.captureException?.(
    error,
    {
      source: "react_error_boundary",
      route,
      ...context,
    },
    {
      mechanism: "react_error_boundary",
      handled: false,
      severity: "error",
    },
  );

  // The Lovable preview hook helps while editing, but production also gets its own
  // sanitized, server-side persisted event in audit_logs.
  window.__lovableReportRuntimeError?.({
    message,
    stack: error instanceof Error ? error.stack : undefined,
    filename: route,
  });

  void import("@/lib/app-observability.functions")
    .then(({ recordClientError }) =>
      recordClientError({
        data: {
          message,
          stack: error instanceof Error ? error.stack : undefined,
          route,
          source: "react_error_boundary",
          boundary,
          userAgent: window.navigator.userAgent,
        },
      }),
    )
    .catch(() => undefined);
}
