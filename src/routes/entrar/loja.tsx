import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { AuthAlert } from "@/components/auth/AuthAlert";
import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordField } from "@/components/auth/PasswordField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUTH_MESSAGES, mapAuthError } from "@/auth/auth.errors";
import { routeForContext, sanitizeReturnPath } from "@/auth/auth.redirects";
import { AUTH_ROUTES } from "@/auth/auth.routes";
import { PublicOnlyRoute } from "@/auth/guards";
import { useAuth } from "@/auth/useAuth";

export const Route = createFileRoute("/entrar/loja")({
  head: () => ({
    meta: [
      { title: "Entrar na loja | Pediu Aqui" },
      {
        name: "description",
        content: "Acesso da equipe da loja ao painel de pedidos do Pediu Aqui.",
      },
      { property: "og:title", content: "Entrar na loja | Pediu Aqui" },
      { property: "og:description", content: "Acesso da equipe da loja ao painel do Pediu Aqui." },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    retorno: typeof search.retorno === "string" ? search.retorno : undefined,
  }),
  component: () => (
    <PublicOnlyRoute>
      <StoreSignInPage />
    </PublicOnlyRoute>
  ),
});

function StoreSignInPage() {
  const { signInStore } = useAuth();
  const navigate = useNavigate();
  const { retorno } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const context = await signInStore(email, password);
      const target = sanitizeReturnPath(retorno) ?? routeForContext(context);
      setPassword("");
      await navigate({ to: target as never, replace: true });
    } catch (cause) {
      setError(mapAuthError(cause, AUTH_MESSAGES.signInFailed));
      setBusy(false);
    }
  }

  return (
    <AuthShell
      badge="Ambiente da loja"
      title="Entrar na loja"
      description="Use o e-mail cadastrado pela sua loja."
      footer={
        <div className="space-y-4">
          <Link to={AUTH_ROUTES.recovery} className="inline-flex min-h-11 items-center underline underline-offset-4">
            Esqueci minha senha
          </Link>
          <p className="border-t border-border pt-4 text-xs text-muted-foreground">
            Não é da loja?{" "}
            <Link to={AUTH_ROUTES.courierSignIn} className="underline underline-offset-4">
              Entrar como entregador
            </Link>{" "}
            ·{" "}
            <Link to={AUTH_ROUTES.adminSignIn} search={{ retorno: undefined }} className="underline underline-offset-4">
              Administração
            </Link>
          </p>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {error ? <AuthAlert message={error} /> : null}

        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            enterKeyHint="next"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={busy}
            autoFocus
            className="h-12 text-base"
          />
        </div>

        <PasswordField
          label="Senha"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          disabled={busy}
          enterKeyHint="go"
        />

        <Button
          type="submit"
          loading={busy}
          loadingLabel="Entrando"
          className="h-13 w-full text-base"
          size="lg"
        >
          {busy ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </AuthShell>
  );
}
