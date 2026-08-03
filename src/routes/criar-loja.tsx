import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "@/components/auth/PasswordField";
import { useAuth } from "@/auth/useAuth";
import { checkStoreSlug, createStoreAccount } from "@/lib/store-onboarding.functions";

export const Route = createFileRoute("/criar-loja")({
  head: () => ({
    meta: [
      { title: "Criar minha loja no Pediu Aqui | Cardápio digital com entrega" },
      {
        name: "description",
        content:
          "Crie sua loja no Pediu Aqui em minutos: cardápio digital, pedidos, cozinha, entregadores e acompanhamento em tempo real. 14 dias para testar.",
      },
      { property: "og:title", content: "Criar minha loja no Pediu Aqui" },
      {
        property: "og:description",
        content: "Cardápio digital, pedidos, cozinha e entregas em uma única plataforma.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CreateStorePage,
});

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

const PLANS = [
  { code: "essencial", label: "Essencial", price: "R$ 99/mês" },
  { code: "profissional", label: "Profissional", price: "R$ 189/mês" },
  { code: "avancado", label: "Avançado", price: "R$ 299/mês" },
] as const;

function CreateStorePage() {
  const navigate = useNavigate();
  const { signInStore } = useAuth();
  const checkSlug = useServerFn(checkStoreSlug);
  const createStore = useServerFn(createStoreAccount);

  const [storeName, setStoreName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugState, setSlugState] = useState<{ available: boolean; reason: string | null } | null>(
    null,
  );
  const [segment, setSegment] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [phone, setPhone] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [planCode, setPlanCode] = useState<(typeof PLANS)[number]["code"]>("essencial");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const effectiveSlug = slugTouched ? slug : slugify(storeName);

  async function verifySlug(value: string) {
    const normalized = slugify(value);
    if (normalized.length < 3) {
      setSlugState({ available: false, reason: "formato" });
      return;
    }
    try {
      const result = await checkSlug({ data: { slug: normalized } });
      setSlugState({ available: result.available, reason: result.reason });
    } catch {
      setSlugState(null);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await createStore({
        data: {
          storeName,
          slug: slugify(effectiveSlug),
          segment: segment || undefined,
          city,
          state: state.toUpperCase(),
          phone,
          ownerName,
          email,
          password,
          planCode,
        },
      });

      await signInStore(email, password);
      setPassword("");
      await navigate({ to: "/app/loja", replace: true });
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : "Não foi possível criar a loja agora.",
      );
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 lg:grid-cols-[1fr_1.1fr] lg:py-20">
        <section className="space-y-6">
          <Link to="/" className="text-sm text-muted-foreground underline underline-offset-4">
            Voltar para a página inicial
          </Link>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Crie sua loja e comece a receber pedidos hoje
          </h1>
          <p className="text-lg text-muted-foreground">
            Cardápio digital com o seu link, painel de pedidos, modo cozinha, entregadores e
            acompanhamento em tempo real para o cliente. Você tem 14 dias de cortesia.
          </p>
          <ul className="space-y-3 text-sm text-muted-foreground">
            {[
              "Link exclusivo: pediuaqui.app/loja/sua-loja",
              "Pedidos de entrega e retirada com recálculo seguro no servidor",
              "Modo cozinha e fila de preparo em tempo real",
              "Entregadores próprios com atribuição e histórico de entregas",
              "Impressão de cupom em impressora térmica 80mm",
            ].map((item) => (
              <li key={item} className="flex gap-3">
                <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-border/70 bg-card p-6 shadow-lg sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {error ? (
              <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="storeName">Nome da loja</Label>
                <Input
                  id="storeName"
                  value={storeName}
                  onChange={(event) => setStoreName(event.target.value)}
                  onBlur={() => verifySlug(effectiveSlug)}
                  disabled={busy}
                  required
                  className="h-12"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="slug">Endereço do cardápio</Label>
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-sm text-muted-foreground">/loja/</span>
                  <Input
                    id="slug"
                    value={effectiveSlug}
                    onChange={(event) => {
                      setSlugTouched(true);
                      setSlug(slugify(event.target.value));
                      setSlugState(null);
                    }}
                    onBlur={(event) => verifySlug(event.target.value)}
                    disabled={busy}
                    className="h-12"
                  />
                </div>
                {slugState ? (
                  <p
                    className={`text-xs ${slugState.available ? "text-primary" : "text-destructive"}`}
                  >
                    {slugState.available
                      ? "Endereço disponível."
                      : slugState.reason === "em_uso"
                        ? "Esse endereço já está em uso."
                        : "Escolha um endereço com 3 a 60 caracteres."}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="segment">Segmento</Label>
                <Input
                  id="segment"
                  placeholder="Mercado, pizzaria, farmácia…"
                  value={segment}
                  onChange={(event) => setSegment(event.target.value)}
                  disabled={busy}
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">WhatsApp da loja</Label>
                <Input
                  id="phone"
                  inputMode="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  disabled={busy}
                  required
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  disabled={busy}
                  required
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">UF</Label>
                <Input
                  id="state"
                  maxLength={2}
                  value={state}
                  onChange={(event) => setState(event.target.value.toUpperCase())}
                  disabled={busy}
                  required
                  className="h-12 uppercase"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="ownerName">Seu nome</Label>
                <Input
                  id="ownerName"
                  value={ownerName}
                  onChange={(event) => setOwnerName(event.target.value)}
                  disabled={busy}
                  required
                  className="h-12"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="email">E-mail de acesso</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={busy}
                  required
                  className="h-12"
                />
              </div>

              <div className="sm:col-span-2">
                <PasswordField
                  label="Senha"
                  value={password}
                  onChange={setPassword}
                  autoComplete="new-password"
                  disabled={busy}
                />
              </div>
            </div>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Plano após o período de cortesia</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {PLANS.map((plan) => (
                  <label
                    key={plan.code}
                    className={`cursor-pointer rounded-xl border p-3 text-sm transition ${
                      planCode === plan.code
                        ? "border-primary bg-primary/10"
                        : "border-border/70 hover:border-primary/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="plan"
                      className="sr-only"
                      value={plan.code}
                      checked={planCode === plan.code}
                      onChange={() => setPlanCode(plan.code)}
                      disabled={busy}
                    />
                    <span className="block font-medium">{plan.label}</span>
                    <span className="block text-xs text-muted-foreground">{plan.price}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <Button
              type="submit"
              size="lg"
              loading={busy}
              loadingLabel="Criando loja"
              className="h-13 w-full text-base"
            >
              {busy ? "Criando sua loja…" : "Criar minha loja"}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Já tem conta?{" "}
              <Link to="/entrar/loja" className="underline underline-offset-4">
                Entrar na loja
              </Link>
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}
