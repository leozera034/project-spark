import type { Session, User } from "@supabase/supabase-js";

export type AccountEnvironment = "platform_admin" | "store" | "courier" | "unconfigured";

export type AppRole =
  "admin_plataforma" | "proprietario" | "gerente" | "atendente" | "cozinha" | "entregador";

/** Contexto retornado por get_my_auth_context(). Nunca contém senha, token ou e-mail sintético. */
export interface AuthContextData {
  user_id: string;
  full_name: string | null;
  profile_active: boolean;
  roles: AppRole[];
  store_ids: string[];
  account_environment: AccountEnvironment;
  courier_id: string | null;
  courier_login_enabled: boolean;
  requires_password_change: boolean;
  default_route: string;
}

export interface AuthState {
  session: Session | null;
  user: User | null;
  authContext: AuthContextData | null;
  isInitializing: boolean;
  isAuthenticated: boolean;
  requiresPasswordChange: boolean;
  isRecoverySession: boolean;
}

export interface AuthActions {
  signInStore: (email: string, password: string) => Promise<AuthContextData>;
  signInAdmin: (email: string, password: string) => Promise<AuthContextData>;
  signInCourier: (identifier: string, password: string) => Promise<AuthContextData>;
  signOut: (scope?: "local" | "global") => Promise<void>;
  refreshAuthContext: () => Promise<AuthContextData | null>;
  sendPasswordRecovery: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  completeInitialPasswordChange: (password: string) => Promise<void>;
}

export type AuthValue = AuthState & AuthActions;
