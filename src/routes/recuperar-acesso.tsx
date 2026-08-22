import { Link, createFileRoute } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";

import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUTH_ROUTES } from "@/auth/auth.routes";
import { useAuth } from "@/auth/useAuth";

export const Route = createFileRoute("/recuperar-acesso")({
  head: () => ({
    meta: [
      { title: "Recuperar acesso | Comandiva" },
      {
        name: "description",
        content: "Receba um link por e-mail para redefinir a senha da sua conta Comandiva.",
      },
      { property: "og:title", content: "Recuperar acesso | Comandiva" },
      { property: "og:description", content: "Redefina a senha da sua conta Comandiva." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RecoveryPage,
});

function RecoveryPage() {
  const { sendPasswordRecovery } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    await sendPasswordRecovery(email);
    setBusy(false);
    setSent(true);
  }

  return (
    <AuthShell
      title="Recuperar acesso"
      description="Informe o e-mail da sua conta. Se existir uma conta, enviaremos um link de redefinição."
      footer={
        <Link
          to={AUTH_ROUTES.storeSignIn}
          search={{ retorno: undefined }}
          className="inline-flex min-h-11 items-center underline underline-offset-4"
        >
          Voltar para o login
        </Link>
      }
    >
      {sent ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-success/30 bg-success-soft p-4 text-sm text-success"
        >
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p>
            Se existir uma conta com esse e-mail, o link de redefinição foi enviado. Verifique também
            a caixa de spam.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="recovery-email">E-mail</Label>
            <Input
              id="recovery-email"
              type="email"
              inputMode="email"
              enterKeyHint="go"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={busy}
              autoFocus
              className="h-12 text-base"
            />
          </div>
          <Button type="submit" loading={busy} loadingLabel="Enviando" className="w-full text-base" size="lg">
            {busy ? "Enviando…" : "Enviar link"}
          </Button>
          <p className="text-sm text-muted-foreground">
            Entregadores não usam e-mail. Peça a redefinição ao responsável da sua loja.
          </p>
        </form>
      )}
    </AuthShell>
  );
}
