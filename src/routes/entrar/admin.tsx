import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

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

export const Route = createFileRoute("/entrar/admin")({
  head: () => ({
    meta: [
      { title: "Entrar na administração | Pediu Aqui" },
      {
        name: "description",
        content: "Acesso restrito da administração da plataforma Pediu Aqui.",
      },
      { property: "og:title", content: "Entrar na administração | Pediu Aqui" },
      { property: "og:description", content: "Acesso restrito da administração do Pediu Aqui." },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    retorno: typeof search.retorno === "string" ? search.retorno : undefined,
  }),
  component: () => (
    <PublicOnlyRoute>
      <AdminSignInPage />
    </PublicOnlyRoute>
  ),
});

function AdminSignInPage() {
  const { signInAdmin } = useAuth();
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
      const context = await signInAdmin(email, password);
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
      title="Administração da plataforma"
      description="Área restrita da equipe Pediu Aqui."
      footer={
        <div className="flex flex-col gap-2">
          <Link to={AUTH_ROUTES.recovery} className="underline underline-offset-4">
            Esqueci minha senha
          </Link>
          <Link to="/" className="underline underline-offset-4">
            Voltar
          </Link>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {error ? (
          <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="admin-email">E-mail</Label>
          <Input
            id="admin-email"
            type="email"
            inputMode="email"
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
        />

        <Button
          type="submit"
          loading={busy}
          loadingLabel="Entrando"
          className="w-full text-base"
          size="lg"
        >
          {busy ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </AuthShell>
  );
}
