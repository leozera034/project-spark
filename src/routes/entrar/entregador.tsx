import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { AuthAlert } from "@/components/auth/AuthAlert";
import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordField } from "@/components/auth/PasswordField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUTH_MESSAGES, mapAuthError } from "@/auth/auth.errors";
import { routeForContext } from "@/auth/auth.redirects";
import { AUTH_ROUTES } from "@/auth/auth.routes";
import { PublicOnlyRoute } from "@/auth/guards";
import { useAuth } from "@/auth/useAuth";

export const Route = createFileRoute("/entrar/entregador")({
  head: () => ({
    meta: [
      { title: "Entrar como entregador | Comandiva" },
      {
        name: "description",
        content: "Acesso do entregador ao aplicativo de entregas da sua loja na Comandiva.",
      },
      { property: "og:title", content: "Entrar como entregador | Comandiva" },
      { property: "og:description", content: "Acesso do entregador às entregas da sua loja." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <PublicOnlyRoute>
      <CourierSignInPage />
    </PublicOnlyRoute>
  ),
});

function CourierSignInPage() {
  const { signInCourier } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const context = await signInCourier(identifier, password);
      setPassword("");
      const target = context.requires_password_change
        ? AUTH_ROUTES.initialPasswordChange
        : routeForContext(context);
      await navigate({ to: target as never, replace: true });
    } catch (cause) {
      setError(mapAuthError(cause, AUTH_MESSAGES.courierSignInFailed));
      setBusy(false);
    }
  }

  return (
    <AuthShell
      tone="operational"
      badge="Ambiente do entregador"
      title="Entrar"
      description="Use o identificador que a sua loja criou para você."
      footer={
        <div className="space-y-4">
          <p>
            Esqueceu a senha? Peça ao responsável da sua loja para redefinir o seu acesso. Ele gera
            uma senha temporária para você.
          </p>
          <p className="border-t border-border pt-4 text-xs text-muted-foreground">
            Não é entregador?{" "}
            <Link to={AUTH_ROUTES.storeSignIn} search={{ retorno: undefined }} className="underline underline-offset-4">
              Entrar na loja
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
          <Label htmlFor="identificador" className="text-base">
            Identificador
          </Label>
          <Input
            id="identificador"
            type="text"
            inputMode="text"
            enterKeyHint="next"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="username"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            disabled={busy}
            autoFocus
            className="h-14 text-lg"
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
          className="h-14 w-full text-lg"
          size="lg"
        >
          {busy ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </AuthShell>
  );
}
