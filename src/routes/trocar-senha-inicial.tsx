import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { AuthAlert } from "@/components/auth/AuthAlert";
import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordField } from "@/components/auth/PasswordField";
import { Button } from "@/components/ui/button";
import { AUTH_MESSAGES, mapAuthError } from "@/auth/auth.errors";
import { routeForContext } from "@/auth/auth.redirects";
import { AUTH_ROUTES } from "@/auth/auth.routes";
import { RequireAuth } from "@/auth/guards";
import { describePasswordPolicy, validatePassword } from "@/auth/passwordPolicy";
import { useAuth } from "@/auth/useAuth";

export const Route = createFileRoute("/trocar-senha-inicial")({
  head: () => ({
    meta: [
      { title: "Criar sua senha | Comandiva" },
      {
        name: "description",
        content: "Troca obrigatória da senha temporária no primeiro acesso à Comandiva.",
      },
      { property: "og:title", content: "Criar sua senha | Comandiva" },
      { property: "og:description", content: "Troca obrigatória da senha temporária." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RequireAuth signIn={AUTH_ROUTES.courierSignIn}>
      <InitialPasswordChangePage />
    </RequireAuth>
  ),
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

function InitialPasswordChangePage() {
  const { completeInitialPasswordChange, authContext, signOut } = useAuth();
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
      await completeInitialPasswordChange(password);
      setPassword("");
      setConfirmation("");
      await navigate({
        to: (authContext ? routeForContext({ ...authContext, requires_password_change: false }) : "/") as never,
        replace: true,
      });
    } catch (cause) {
      setError(mapAuthError(cause, AUTH_MESSAGES.recoveryFailed));
      setBusy(false);
    }
  }

  return (
    <AuthShell
      tone="operational"
      badge="Ambiente do entregador"
      title="Crie a sua senha"
      description="A senha temporária serve apenas para o primeiro acesso. Escolha agora uma senha só sua."
      footer={
        <button
          type="button"
          className="inline-flex min-h-11 items-center underline underline-offset-4"
          onClick={() => void signOut("local").then(() => navigate({ to: AUTH_ROUTES.courierSignIn as never }))}
        >
          Sair
        </button>
      }
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
          label="Repetir a senha"
          value={confirmation}
          onChange={setConfirmation}
          autoComplete="new-password"
          disabled={busy}
          enterKeyHint="go"
        />

        <Button type="submit" loading={busy} loadingLabel="Salvando" className="h-14 w-full text-lg" size="lg">
          {busy ? "Salvando…" : "Salvar e continuar"}
        </Button>
      </form>
    </AuthShell>
  );
}
