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
      <div className="grid min-h-screen place-items-center bg-background" role="status" aria-live="polite">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-2 border-brand/20 border-t-brand" />
          <span className="text-sm font-medium text-muted-foreground">Preparando seu acesso…</span>
        </div>
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

export function RequireEnvironment({ environment, children }: { environment: AccountEnvironment; children: ReactNode }) {
  const { authContext } = useAuth();
  if (!authContext) return <Navigate to={AUTH_ROUTES.noAccess} replace />;
  if (authContext.account_environment !== environment) {
    try {
      return <Navigate to={routeForContext(authContext)} replace />;
    } catch (error) {
      console.error("Failed to resolve account environment route", error);
      return <Navigate to={AUTH_ROUTES.noAccess} replace />;
    }
  }
  return <>{children}</>;
}

export function RequirePasswordChangeCompleted({ children }: { children: ReactNode }) {
  const { authContext } = useAuth();
  if (authContext?.requires_password_change) {
    return <Navigate to={AUTH_ROUTES.initialPasswordChange} replace />;
  }
  return <>{children}</>;
}

/**
 * Public login pages must never crash because a stale local session cannot be mapped.
 * If the context is valid we redirect; if it is inconsistent we fail open to the
 * sign-in screen and let the user recover the session normally.
 */
export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, authContext, isInitializing } = useAuth();
  if (isInitializing) return <AuthLoadingBoundary>{null}</AuthLoadingBoundary>;
  if (isAuthenticated && authContext) {
    try {
      const target = routeForContext(authContext);
      return <Navigate to={target} replace />;
    } catch (error) {
      console.error("Failed to resolve authenticated public-route redirect", error);
      return <>{children}</>;
    }
  }
  return <>{children}</>;
}
