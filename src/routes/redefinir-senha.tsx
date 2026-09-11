import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { AuthAlert } from "@/components/auth/AuthAlert";
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
      { title: "Redefinir senha | Comandiva" },
      { name: "description", content: "Defina uma nova senha para a sua conta Comandiva." },
      { property: "og:title", content: "Redefinir senha | Comandiva" },
      { property: "og:description", content: "Defina uma nova senha para a sua conta." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function constantTimeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const size = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < size; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

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
    if (!constantTimeEqual(password, confirmation)) {
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
          <Link to={AUTH_ROUTES.recovery} className="inline-flex min-h-11 items-center underline underline-offset-4">
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
        {error ? <AuthAlert message={error} /> : null}

        <PasswordField
          label="Nova senha"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          disabled={busy}
          enterKeyHint="next"
        />
        <p className="text-sm text-muted-foreground">{describePasswordPolicy()}</p>

        <PasswordField
          label="Repetir nova senha"
          value={confirmation}
          onChange={setConfirmation}
          autoComplete="new-password"
          disabled={busy}
          enterKeyHint="go"
        />

        <Button type="submit" loading={busy} loadingLabel="Salvando" className="w-full text-base" size="lg">
          {busy ? "Salvando…" : "Salvar nova senha"}
        </Button>
      </form>
    </AuthShell>
  );
}
