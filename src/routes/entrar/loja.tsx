import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { KeyRound, Mail } from "lucide-react";
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
      { title: "Entrar na loja | Comandiva" },
      {
        name: "description",
        content: "Acesso da equipe da loja ao painel de pedidos da Comandiva.",
      },
      { property: "og:title", content: "Entrar na loja | Comandiva" },
      { property: "og:description", content: "Acesso da equipe da loja ao painel da Comandiva." },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { retorno?: string } =>
    typeof search.retorno === "string" ? { retorno: search.retorno } : {},
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
        <div className="space-y-5">
          <Link
            to={AUTH_ROUTES.recovery}
            className="inline-flex min-h-11 items-center gap-2 font-semibold text-[#55207A] underline decoration-[#55207A]/25 underline-offset-4 transition hover:text-[#431861]"
          >
            <KeyRound className="size-4" />
            Esqueci minha senha
          </Link>
          <p className="border-t border-[#EAE5ED] pt-5 text-sm leading-6 text-[#7B7280]">
            Não é da loja?{" "}
            <Link to={AUTH_ROUTES.courierSignIn} className="font-semibold text-[#55207A] hover:underline">
              Entrar como entregador
            </Link>{" "}
            <span className="px-1 text-[#FF681F]">•</span>{" "}
            <Link
              to={AUTH_ROUTES.adminSignIn}
              search={{ retorno: undefined }}
              className="font-semibold text-[#55207A] hover:underline"
            >
              Administração
            </Link>
          </p>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {error ? <AuthAlert message={error} /> : null}

        <div className="space-y-2.5">
          <Label htmlFor="email" className="text-sm font-bold text-[#2B183B]">
            E-mail
          </Label>
          <div className="relative">
            <Mail
              className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#55207A]"
              aria-hidden
            />
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
              placeholder="seu@email.com"
              className="h-14 rounded-2xl border-[#DED7E3] bg-white pl-12 text-base text-[#17131C] shadow-none placeholder:text-[#9B929F] focus-visible:border-[#55207A]/45 focus-visible:ring-[#55207A]/12"
            />
          </div>
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
          className="h-14 w-full rounded-2xl bg-[#FF681F] text-base font-extrabold text-white shadow-[0_10px_24px_rgba(255,104,31,.20)] hover:bg-[#E95612]"
          size="lg"
        >
          {busy ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </AuthShell>
  );
}
