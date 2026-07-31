import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordField } from "@/components/auth/PasswordField";
import { Button } from "@/components/ui/button";
import { AUTH_MESSAGES, mapAuthError } from "@/auth/auth.errors";
import { routeForContext } from "@/auth/auth.redirects";
import { AUTH_ROUTES } from "@/auth/auth.routes";
import { describePasswordPolicy, validatePassword } from "@/auth/passwordPolicy";
import { useAuth } from "@/auth/useAuth";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({
    meta: [
      { title: "Redefinir senha | Pediu Aqui" },
      { name: "description", content: "Defina uma nova senha para a sua conta Pediu Aqui." },
      { property: "og:title", content: "Redefinir senha | Pediu Aqui" },
      { property: "og:description", content: "Defina uma nova senha para a sua conta." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { updatePassword, authContext, isAuthenticated, isInitializing, refreshAuthContext } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const check = validatePassword(password);
    if (!check.valid) {
      setError(check.message);
      return;
    }
    if (password !== confirmation) {
      setError(AUTH_MESSAGES.passwordsDiffer);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updatePassword(password);
      const context = await refreshAuthContext();
      setPassword("");
      setConfirmation("");
      await navigate({
        to: (context ? routeForContext(context) : AUTH_ROUTES.storeSignIn) as never,
        replace: true,
      });
    } catch (cause) {
      setError(mapAuthError(cause, AUTH_MESSAGES.recoveryFailed));
      setBusy(false);
    }
  }

  if (!isInitializing && !isAuthenticated) {
    return (
      <AuthShell
        title="Link inválido ou expirado"
        description="Peça um novo link de redefinição para continuar."
        footer={
          <Link to={AUTH_ROUTES.recovery} className="underline underline-offset-4">
            Pedir novo link
          </Link>
        }
      >
        <p className="text-sm text-muted-foreground">
          Por segurança, os links de redefinição expiram após pouco tempo e só podem ser usados uma vez.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Definir nova senha"
      description={authContext ? "Escolha uma senha que só você conheça." : undefined}
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {error ? (
          <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <PasswordField
          label="Nova senha"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          disabled={busy}
        />
        <p className="text-sm text-muted-foreground">{describePasswordPolicy()}</p>

        <PasswordField
          label="Repetir nova senha"
          value={confirmation}
          onChange={setConfirmation}
          autoComplete="new-password"
          disabled={busy}
        />

        <Button type="submit" disabled={busy} className="w-full text-base" size="lg">
          {busy ? "Salvando…" : "Salvar nova senha"}
        </Button>
      </form>
    </AuthShell>
  );
}
