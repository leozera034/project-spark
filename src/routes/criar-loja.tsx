import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check } from "lucide-react";
import { useState } from "react";

import { AuthAlert } from "@/components/auth/AuthAlert";
import { PasswordField } from "@/components/auth/PasswordField";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
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

const STEPS = [
  { title: "Identidade da loja", description: "Nome, endereço do cardápio e segmento" },
  { title: "Localização e contato", description: "Cidade, estado e WhatsApp" },
  { title: "Seu acesso", description: "Como você vai entrar no painel" },
  { title: "Revisão", description: "Confira e crie sua loja" },
] as const;

type FieldErrors = Partial<
  Record<
    | "storeName"
    | "slug"
    | "city"
    | "state"
    | "phone"
    | "ownerName"
    | "email"
    | "password",
    string
  >
>;

function CreateStorePage() {
  const navigate = useNavigate();
  const { signInStore } = useAuth();
  const checkSlug = useServerFn(checkStoreSlug);
  const createStore = useServerFn(createStoreAccount);

  const [step, setStep] = useState(0);

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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

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

  function validateStep(target: number): boolean {
    const errors: FieldErrors = {};
    if (target === 0) {
      if (storeName.trim().length < 3) errors.storeName = "Informe o nome completo da loja.";
      if (effectiveSlug.length < 3) errors.slug = "O endereço precisa ter ao menos 3 caracteres.";
      else if (slugState && !slugState.available) errors.slug = "Esse endereço já está em uso.";
    }
    if (target === 1) {
      if (city.trim().length < 2) errors.city = "Informe a cidade da loja.";
      if (state.trim().length !== 2) errors.state = "Use a sigla do estado, com 2 letras.";
      if (phone.trim().length < 8) errors.phone = "Informe um WhatsApp válido.";
    }
    if (target === 2) {
      if (ownerName.trim().length < 3) errors.ownerName = "Informe o seu nome.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Informe um e-mail válido.";
      if (password.length < 8) errors.password = "A senha precisa ter ao menos 8 caracteres.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function goNext() {
    if (!validateStep(step)) return;
    if (step === 0) void verifySlug(effectiveSlug);
    setError(null);
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function goBack() {
    setError(null);
    setStep((current) => Math.max(current - 1, 0));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!validateStep(0) || !validateStep(1) || !validateStep(2)) {
      setError("Revise os campos destacados antes de continuar.");
      return;
    }
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

  const isLastStep = step === STEPS.length - 1;

  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:py-16">
        <section className="hidden space-y-6 lg:block">
          <Link to="/" className="inline-flex" aria-label="Pediu Aqui, ir para o início">
            <BrandLogo lockup="horizontal" className="h-8 w-auto" />
          </Link>
          <h1 className="text-balance font-display text-4xl font-semibold tracking-tight sm:text-5xl">
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
                <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel space-y-6 p-5 sm:p-8">
          <div className="flex items-center justify-between lg:hidden">
            <Link to="/" aria-label="Pediu Aqui, ir para o início">
              <BrandLogo lockup="horizontal" className="h-7 w-auto" />
            </Link>
          </div>

          {/* Indicador de progresso */}
          <div>
            <ol className="flex items-center gap-1.5" aria-label="Etapas do cadastro">
              {STEPS.map((s, index) => (
                <li key={s.title} className="flex flex-1 flex-col gap-2">
                  <span
                    aria-hidden
                    className={cn(
                      "h-1.5 w-full rounded-full transition-colors",
                      index <= step ? "bg-brand" : "bg-muted",
                    )}
                  />
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs font-medium text-muted-foreground">
              Etapa {step + 1} de {STEPS.length}
            </p>
            <h2 className="mt-1 font-display text-xl font-semibold tracking-tight text-foreground">
              {STEPS[step].title}
            </h2>
            <p className="text-sm text-muted-foreground">{STEPS[step].description}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {error ? <AuthAlert message={error} /> : null}

            {step === 0 ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="storeName">Nome da loja</Label>
                  <Input
                    id="storeName"
                    value={storeName}
                    onChange={(event) => setStoreName(event.target.value)}
                    onBlur={() => verifySlug(effectiveSlug)}
                    disabled={busy}
                    required
                    autoFocus
                    aria-invalid={Boolean(fieldErrors.storeName)}
                    className="h-12"
                  />
                  {fieldErrors.storeName ? (
                    <p role="alert" className="text-sm text-danger">
                      {fieldErrors.storeName}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
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
                      aria-invalid={Boolean(fieldErrors.slug)}
                      className="h-12"
                    />
                  </div>
                  {fieldErrors.slug ? (
                    <p role="alert" className="text-sm text-danger">
                      {fieldErrors.slug}
                    </p>
                  ) : slugState ? (
                    <p className={cn("text-xs", slugState.available ? "text-brand" : "text-danger")}>
                      {slugState.available
                        ? "Endereço disponível."
                        : slugState.reason === "em_uso"
                          ? "Esse endereço já está em uso."
                          : "Escolha um endereço com 3 a 60 caracteres."}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="segment">Segmento (opcional)</Label>
                  <Input
                    id="segment"
                    placeholder="Mercado, pizzaria, farmácia…"
                    value={segment}
                    onChange={(event) => setSegment(event.target.value)}
                    disabled={busy}
                    className="h-12"
                  />
                </div>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="phone">WhatsApp da loja</Label>
                  <Input
                    id="phone"
                    inputMode="tel"
                    enterKeyHint="next"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    disabled={busy}
                    required
                    autoFocus
                    aria-invalid={Boolean(fieldErrors.phone)}
                    className="h-12"
                  />
                  {fieldErrors.phone ? (
                    <p role="alert" className="text-sm text-danger">
                      {fieldErrors.phone}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    enterKeyHint="next"
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    disabled={busy}
                    required
                    aria-invalid={Boolean(fieldErrors.city)}
                    className="h-12"
                  />
                  {fieldErrors.city ? (
                    <p role="alert" className="text-sm text-danger">
                      {fieldErrors.city}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">UF</Label>
                  <Input
                    id="state"
                    maxLength={2}
                    enterKeyHint="done"
                    value={state}
                    onChange={(event) => setState(event.target.value.toUpperCase())}
                    disabled={busy}
                    required
                    aria-invalid={Boolean(fieldErrors.state)}
                    className="h-12 uppercase"
                  />
                  {fieldErrors.state ? (
                    <p role="alert" className="text-sm text-danger">
                      {fieldErrors.state}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ownerName">Seu nome</Label>
                  <Input
                    id="ownerName"
                    enterKeyHint="next"
                    value={ownerName}
                    onChange={(event) => setOwnerName(event.target.value)}
                    disabled={busy}
                    required
                    autoFocus
                    aria-invalid={Boolean(fieldErrors.ownerName)}
                    className="h-12"
                  />
                  {fieldErrors.ownerName ? (
                    <p role="alert" className="text-sm text-danger">
                      {fieldErrors.ownerName}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail de acesso</Label>
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    enterKeyHint="next"
                    autoComplete="username"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={busy}
                    required
                    aria-invalid={Boolean(fieldErrors.email)}
                    className="h-12"
                  />
                  {fieldErrors.email ? (
                    <p role="alert" className="text-sm text-danger">
                      {fieldErrors.email}
                    </p>
                  ) : null}
                </div>

                <PasswordField
                  label="Senha"
                  value={password}
                  onChange={setPassword}
                  autoComplete="new-password"
                  disabled={busy}
                  enterKeyHint="done"
                  error={fieldErrors.password}
                />

                <fieldset className="space-y-3">
                  <legend className="text-sm font-medium">Plano após o período de cortesia</legend>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {PLANS.map((plan) => (
                      <label
                        key={plan.code}
                        className={cn(
                          "min-h-11 cursor-pointer rounded-xl border p-3 text-sm transition",
                          planCode === plan.code
                            ? "border-brand bg-brand-soft"
                            : "border-border hover:border-brand/50",
                        )}
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
              </div>
            ) : null}

            {isLastStep ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-surface-muted p-4 text-sm">
                  <p className="mb-3 font-medium text-foreground">Revise antes de criar sua loja</p>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-muted-foreground">
                    <dt>Loja</dt>
                    <dd className="text-foreground">{storeName || "—"}</dd>
                    <dt>Endereço</dt>
                    <dd className="text-foreground">/loja/{effectiveSlug || "—"}</dd>
                    <dt>Segmento</dt>
                    <dd className="text-foreground">{segment || "—"}</dd>
                    <dt>Cidade/UF</dt>
                    <dd className="text-foreground">
                      {city || "—"}
                      {state ? `/${state}` : ""}
                    </dd>
                    <dt>WhatsApp</dt>
                    <dd className="text-foreground">{phone || "—"}</dd>
                    <dt>Responsável</dt>
                    <dd className="text-foreground">{ownerName || "—"}</dd>
                    <dt>E-mail</dt>
                    <dd className="text-foreground">{email || "—"}</dd>
                    <dt>Plano</dt>
                    <dd className="text-foreground">
                      {PLANS.find((plan) => plan.code === planCode)?.label}
                    </dd>
                  </dl>
                </div>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  {["Dados conferidos", "Endereço do cardápio disponível", "14 dias de cortesia inclusos"].map(
                    (item) => (
                      <li key={item} className="flex items-center gap-2">
                        <Check className="size-3.5 text-brand" aria-hidden />
                        {item}
                      </li>
                    ),
                  )}
                </ul>
              </div>
            ) : null}

            <div className="flex gap-3 pt-2">
              {step > 0 ? (
                <Button type="button" variant="outline" className="h-12 flex-1" onClick={goBack} disabled={busy}>
                  Voltar
                </Button>
              ) : null}

              {isLastStep ? (
                <Button
                  type="submit"
                  size="lg"
                  loading={busy}
                  loadingLabel="Criando loja"
                  className="h-12 flex-[2] text-base"
                >
                  {busy ? "Criando sua loja…" : "Criar minha loja"}
                </Button>
              ) : (
                <Button type="button" size="lg" className="h-12 flex-[2] text-base" onClick={goNext}>
                  Continuar
                </Button>
              )}
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Já tem conta?{" "}
              <Link to="/entrar/loja" search={{ retorno: undefined }} className="underline underline-offset-4">
                Entrar na loja
              </Link>
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}
