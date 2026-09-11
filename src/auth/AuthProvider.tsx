import type { Session, User } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  prioritizeStoreIds,
  setSelectedStoreId,
  useSelectedStoreId,
} from "@/store-scope/store-scope";

import { AuthContext } from "./AuthContext";
import { AUTH_MESSAGES, AuthFlowError, logAuthFailure } from "./auth.errors";
import { allowedOrigin } from "./auth.redirects";
import { AUTH_ROUTES } from "./auth.routes";
import type { AuthContextData, AuthValue } from "./auth.types";
import { courierIdentifierToSyntheticEmail, validateCourierIdentifier } from "./courierIdentifier";

async function loadAuthContext(): Promise<AuthContextData | null> {
  const { data, error } = await supabase.rpc("get_my_auth_context");
  if (error) {
    logAuthFailure("carregar_contexto");
    return null;
  }
  const context = (data as unknown as AuthContextData) ?? null;
  if (!context) return null;
  return { ...context, store_ids: prioritizeStoreIds(context.store_ids ?? []) };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const selectedStoreId = useSelectedStoreId();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authContext, setAuthContext] = useState<AuthContextData | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isRecoverySession, setIsRecoverySession] = useState(false);
  const mounted = useRef(true);

  const effectiveAuthContext = useMemo<AuthContextData | null>(() => {
    if (!authContext) return null;
    if (!selectedStoreId || !authContext.store_ids.includes(selectedStoreId)) return authContext;
    return {
      ...authContext,
      store_ids: [selectedStoreId, ...authContext.store_ids.filter((id) => id !== selectedStoreId)],
    };
  }, [authContext, selectedStoreId]);

  const refreshAuthContext = useCallback(async () => {
    const next = await loadAuthContext();
    if (mounted.current) setAuthContext(next);
    return next;
  }, []);

  useEffect(() => {
    mounted.current = true;

    let unsubscribe: () => void = () => undefined;

    try {
      // Única assinatura de onAuthStateChange em toda a aplicação.
      const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
        if (!mounted.current) return;
        setSession(nextSession);
        setUser(nextSession?.user ?? null);

        if (event === "PASSWORD_RECOVERY") setIsRecoverySession(true);
        if (event === "SIGNED_OUT") {
          setSelectedStoreId(null);
          setAuthContext(null);
          setIsRecoverySession(false);
          return;
        }
        if (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "INITIAL_SESSION") {
          // Trabalho assíncrono fora do callback para não bloquear o SDK.
          if (nextSession) queueMicrotask(() => void refreshAuthContext());
        }
      });
      unsubscribe = () => subscription.subscription.unsubscribe();

      void (async () => {
        try {
          const { data } = await supabase.auth.getSession();
          if (!mounted.current) return;
          setSession(data.session);
          setUser(data.session?.user ?? null);
          if (data.session) await refreshAuthContext();
        } catch (error) {
          console.error("[auth] sessão inicial indisponível", error);
        } finally {
          if (mounted.current) setIsInitializing(false);
        }
      })();
    } catch (error) {
      // Uma configuração ausente não pode derrubar páginas públicas.
      console.error("[auth] cliente de autenticação indisponível", error);
      setIsInitializing(false);
    }

    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, [refreshAuthContext]);

  const signInWithEmail = useCallback(
    async (email: string, password: string, expected: "store" | "platform_admin") => {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        logAuthFailure("login_email");
        throw new AuthFlowError(AUTH_MESSAGES.signInFailed);
      }
      const context = await refreshAuthContext();
      const ok =
        context?.profile_active === true &&
        (expected === "platform_admin"
          ? context.account_environment === "platform_admin"
          : context.account_environment === "store");
      if (!ok) {
        await supabase.auth.signOut({ scope: "local" });
        throw new AuthFlowError(AUTH_MESSAGES.noAccess);
      }
      return context as AuthContextData;
    },
    [refreshAuthContext],
  );

  const value = useMemo<AuthValue>(() => {
    return {
      session,
      user,
      authContext: effectiveAuthContext,
      isInitializing,
      isAuthenticated: Boolean(session),
      requiresPasswordChange: effectiveAuthContext?.requires_password_change === true,
      isRecoverySession,

      signInStore: (email, password) => signInWithEmail(email, password, "store"),
      signInAdmin: (email, password) => signInWithEmail(email, password, "platform_admin"),

      async signInCourier(identifier, password) {
        const validation = validateCourierIdentifier(identifier);
        if (!validation.valid) {
          throw new AuthFlowError(AUTH_MESSAGES.courierSignInFailed);
        }
        const syntheticEmail = await courierIdentifierToSyntheticEmail(validation.value);
        const { error } = await supabase.auth.signInWithPassword({
          email: syntheticEmail,
          password,
        });
        if (error) {
          logAuthFailure("login_entregador");
          throw new AuthFlowError(AUTH_MESSAGES.courierSignInFailed);
        }
        const context = await refreshAuthContext();
        if (
          !context ||
          context.account_environment !== "courier" ||
          !context.courier_login_enabled ||
          !context.profile_active
        ) {
          await supabase.auth.signOut({ scope: "local" });
          throw new AuthFlowError(AUTH_MESSAGES.courierSignInFailed);
        }
        return context;
      },

      async signOut(scope = "local") {
        await supabase.auth.signOut({ scope });
        setSelectedStoreId(null);
        if (mounted.current) {
          setAuthContext(null);
          setSession(null);
          setUser(null);
          setIsRecoverySession(false);
        }
      },

      refreshAuthContext,

      async sendPasswordRecovery(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
          redirectTo: `${allowedOrigin()}${AUTH_ROUTES.resetPassword}`,
        });
        // A mensagem exibida é sempre a mesma; nunca revelamos existência de conta.
        if (error) logAuthFailure("recuperacao_email");
      },

      async updatePassword(password) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
          logAuthFailure("atualizar_senha");
          throw new AuthFlowError(AUTH_MESSAGES.weakPassword);
        }
      },

      async completeInitialPasswordChange(password) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
          logAuthFailure("atualizar_senha");
          throw new AuthFlowError(AUTH_MESSAGES.weakPassword);
        }
        // Só após o sucesso real da alteração o indicador é removido.
        const { error: rpcError } = await supabase.rpc("complete_my_initial_password_change");
        if (rpcError) {
          logAuthFailure("concluir_troca_inicial");
          throw new AuthFlowError(AUTH_MESSAGES.recoveryFailed);
        }
        await refreshAuthContext();
      },
    };
  }, [session, user, effectiveAuthContext, isInitializing, isRecoverySession, refreshAuthContext, signInWithEmail]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
