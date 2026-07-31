import { APP_ROUTES, AUTH_ROUTES } from "./auth.routes";
import type { AuthContextData } from "./auth.types";

/**
 * Aceita somente caminho interno. Rejeita URL absoluta, protocolo,
 * `javascript:`, domínio externo e caminhos protocolo-relativos.
 */
export function sanitizeReturnPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (/^\/\\/.test(value)) return null;
  if (/[a-z][a-z0-9+.-]*:/i.test(value.split("?")[0] ?? "")) return null;
  return value;
}

/** Rota inicial derivada do contexto retornado pelo servidor. */
export function routeForContext(context: AuthContextData | null): string {
  if (!context) return AUTH_ROUTES.noAccess;
  if (!context.profile_active) return AUTH_ROUTES.noAccess;

  switch (context.account_environment) {
    case "platform_admin":
      return APP_ROUTES.admin;
    case "store":
      return APP_ROUTES.store;
    case "courier":
      if (!context.courier_login_enabled) return AUTH_ROUTES.noAccess;
      return context.requires_password_change
        ? AUTH_ROUTES.initialPasswordChange
        : APP_ROUTES.courier;
    default:
      return AUTH_ROUTES.noAccess;
  }
}

/** Origem permitida para redirecionamento de recuperação por e-mail. */
export function allowedOrigin(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}
