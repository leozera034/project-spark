import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

import { reportLovableError } from "@/lib/lovable-error-reporting";

import { AppErrorScreen, classifyAppError, recoverFromStaleBuild } from "./AppErrorScreen";

/**
 * Fallback padrão de qualquer rota que lance sem boundary próprio.
 * Sempre em português, com a causa classificada e a ação que resolve.
 */
export function RouteErrorScreen({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const kind = classifyAppError(error);

  useEffect(() => {
    console.error(error);
    reportLovableError(error, { boundary: "tanstack_route_error_component" });
  }, [error]);

  useEffect(() => {
    if (kind === "stale_build") recoverFromStaleBuild();
  }, [kind]);

  return (
    <AppErrorScreen
      kind={kind}
      detail={import.meta.env.DEV ? (error.stack ?? error.message) : undefined}
      onRetry={() => {
        void router.invalidate();
        reset();
      }}
    />
  );
}
