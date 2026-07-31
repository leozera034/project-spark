import { Navigate, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { AUTH_ROUTES } from "./auth.routes";
import type { AccountEnvironment } from "./auth.types";
import { routeForContext } from "./auth.redirects";
import { useAuth } from "./useAuth";

/**
 * Guards são proteção de experiência. Eles NÃO substituem RLS,
 * autorização por ação nem validação no servidor.
 */

export function AuthLoadingBoundary({ children }: { children: ReactNode }) {
  const { isInitializing } = useAuth();
  if (isInitializing) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-background"
        role="status"
        aria-live="polite"
      >
        <span className="text-sm text-muted-foreground">Carregando…</span>
      </div>
    );
  }
  return <>{children}</>;
}

export function RequireAuth({ children, signIn }: { children: ReactNode; signIn: string }) {
  const { isAuthenticated, authContext, isInitializing } = useAuth();
  const location = useLocation();
  if (isInitializing) return <AuthLoadingBoundary>{null}</AuthLoadingBoundary>;
  if (!isAuthenticated) {
    return <Navigate to={signIn} search={{ retorno: location.pathname }} replace />;
  }
  if (!authContext || !authContext.profile_active) {
    return <Navigate to={AUTH_ROUTES.noAccess} replace />;
  }
  return <>{children}</>;
}

export function RequireEnvironment({
  environment,
  children,
}: {
  environment: AccountEnvironment;
  children: ReactNode;
}) {
  const { authContext } = useAuth();
  if (!authContext) return <Navigate to={AUTH_ROUTES.noAccess} replace />;
  if (authContext.account_environment !== environment) {
    return <Navigate to={routeForContext(authContext)} replace />;
  }
  return <>{children}</>;
}

/** Nenhuma rota autenticada abre enquanto a troca inicial estiver pendente. */
export function RequirePasswordChangeCompleted({ children }: { children: ReactNode }) {
  const { authContext } = useAuth();
  if (authContext?.requires_password_change) {
    return <Navigate to={AUTH_ROUTES.initialPasswordChange} replace />;
  }
  return <>{children}</>;
}

export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, authContext, isInitializing } = useAuth();
  if (isInitializing) return <AuthLoadingBoundary>{null}</AuthLoadingBoundary>;
  if (isAuthenticated && authContext) {
    return <Navigate to={routeForContext(authContext)} replace />;
  }
  return <>{children}</>;
}
