import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  CircleEllipsis,
  Coffee,
  IceCreamCone,
  Mail,
  MapPin,
  Package,
  Phone,
  Pizza,
  Sandwich,
  ShoppingBasket,
  Store,
  UserRound,
  UtensilsCrossed,
  Wine,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { validatePassword } from "@/auth/passwordPolicy";
import { useAuth } from "@/auth/useAuth";
import { AuthAlert } from "@/components/auth/AuthAlert";
import { PasswordField } from "@/components/auth/PasswordField";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkStoreSlug, createStoreAccount } from "@/lib/store-onboarding.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/criar-loja")({
  head: () => ({
    meta: [
      { title: "Criar minha loja na Comandiva | Cardápio digital com entrega" },
      {
        name: "description",
        content: "Crie sua loja na Comandiva em minutos e continue para o plano que você escolheu.",
      },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: CreateStorePage,
});

type PlanCode = "gratis" | "essencial" | "profissional" | "avancado";
type Interval = "monthly" | "annual";
type StoreProfileCode =
  | "pizzaria"
  | "hamburgueria"
  | "acai"
  | "sorveteria"
  | "restaurante"
  | "lanchonete"
  | "pastelaria"
  | "adega"
  | "mercado"
  | "outros";

type StoreProfile = {
  code: StoreProfileCode;
  name: string;
  hint: string;
  icon: LucideIcon;
};

const STORE_PROFILES: StoreProfile[] = [
  { code: "pizzaria", name: "Pizzaria", hint: "Pizzas, sabores e bordas", icon: Pizza },
  { code: "hamburgueria", name: "Hamburgueria", hint: "Lanches, adicionais e combos", icon: Sandwich },
  { code: "acai", name: "Açaí", hint: "Frutas, cremes e complementos", icon: Store },
  { code: "sorveteria", name: "Sorveteria", hint: "Sabores, coberturas e recipientes", icon: IceCreamCone },
  { code: "restaurante", name: "Restaurante / Marmitaria", hint: "Pratos, marmitas e acompanhamentos", icon: UtensilsCrossed },
  { code: "lanchonete", name: "Lanchonete", hint: "Lanches, porções e bebidas", icon: Coffee },
  { code: "pastelaria", name: "Pastelaria", hint: "Pastéis, sabores e combos", icon: Package },
  { code: "adega", name: "Bebidas / Adega", hint: "Bebidas, volumes, kits e gelo", icon: Wine },
  { code: "mercado", name: "Padaria / Mercado", hint: "Produtos, variações, peso e estoque", icon: ShoppingBasket },
  { code: "outros", name: "Outro", hint: "Meu negócio não está nessa lista", icon: CircleEllipsis },
];

const STEPS = [
  {
    title: "Identidade e tipo da loja",
    description: "Essas escolhas básicas definem a configuração inicial da sua loja e podem ser alteradas depois.",
  },
  {
    title: "Localização e contato",
    description: "Informe onde sua loja atende e qual número será usado para contato operacional.",
  },
  {
    title: "Seu acesso",
    description: "Crie os dados do primeiro responsável pela administração da loja.",
  },
  {
    title: "Revisão",
    description: "Confira as informações antes de criar sua loja.",
  },
] as const;

const PLAN_NAMES: Record<PlanCode, string> = {
  gratis: "Gratuito",
  essencial: "Essencial",
  profissional: "Profissional",
  avancado: "Avançado",
};

function intent() {
  if (typeof window === "undefined") {
    return { plan: "gratis" as PlanCode, interval: "monthly" as Interval };
  }

  const query = new URLSearchParams(window.location.search);
  const rawPlan = query.get("plan");
  const rawInterval = query.get("interval");
  const plan: PlanCode =
    rawPlan && ["gratis", "essencial", "profissional", "avancado"].includes(rawPlan)
      ? (rawPlan as PlanCode)
      : "gratis";

  return {
    plan,
    interval: rawInterval === "annual" ? ("annual" as const) : ("monthly" as const),
  };
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function FieldError({ value }: { value?: string }) {
  return value ? (
    <p role="alert" className="text-sm font-medium text-danger">
      {value}
    </p>
  ) : null;
}

const inputClass =
  "h-14 rounded-2xl border-[#DED7E3] bg-white text-base text-[#17131C] shadow-none placeholder:text-[#9B929F] focus-visible:border-[#55207A]/45 focus-visible:ring-[#55207A]/12";

function CreateStorePage() {
  const navigate = useNavigate();
  const { signInStore, isAuthenticated, isInitializing, authContext } = useAuth();
  const checkSlug = useServerFn(checkStoreSlug);
  const createStore = useServerFn(createStoreAccount);
  const selected = useMemo(intent, []);

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugState, setSlugState] = useState<{ available: boolean } | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    storeName: "",
    slug: "",
    profileCode: "" as StoreProfileCode | "",
    otherBusinessType: "",
    city: "",
    state: "",
    phone: "",
    ownerName: "",
    email: "",
    password: "",
  });

  const effectiveSlug = slugTouched ? form.slug : slugify(form.storeName);
  const paid = selected.plan !== "gratis";
  const selectedProfile = STORE_PROFILES.find((profile) => profile.code === form.profileCode);

  useEffect(() => {
    if (!isInitializing && isAuthenticated && authContext?.store_ids?.length) {
      const target = paid
        ? `/app/loja/plano?purchase=${selected.plan}&interval=${selected.interval}`
        : "/app/loja/plano";
      window.location.replace(target);
    }
  }, [isInitializing, isAuthenticated, authContext, paid, selected.plan, selected.interval]);

  async function verifySlug(value: string) {
    const normalized = slugify(value);
    if (normalized.length < 3) {
      setSlugState({ available: false });
      return;
    }

    try {
      const result = await checkSlug({ data: { slug: normalized } });
      setSlugState({ available: result.available });
    } catch {
      setSlugState(null);
    }
  }

  function validate(target: number) {
    const nextErrors: Record<string, string> = {};

    if (target === 0) {
      if (form.storeName.trim().length < 3) nextErrors.storeName = "Informe o nome da loja.";
      if (effectiveSlug.length < 3) nextErrors.slug = "O endereço precisa ter ao menos 3 caracteres.";
      else if (slugState && !slugState.available) nextErrors.slug = "Esse endereço já está em uso.";
      if (!form.profileCode) nextErrors.profileCode = "Escolha o tipo da sua loja.";
      if (form.profileCode === "outros" && form.otherBusinessType.trim().length < 2) {
        nextErrors.otherBusinessType = "Informe qual é o seu tipo de negócio.";
      }
    }

    if (target === 1) {
      if (form.city.trim().length < 2) nextErrors.city = "Informe a cidade.";
      if (form.state.trim().length !== 2) nextErrors.state = "Use a sigla do estado.";
      if (form.phone.trim().length < 8) nextErrors.phone = "Informe um WhatsApp válido.";
    }

    if (target === 2) {
      if (form.ownerName.trim().length < 3) nextErrors.ownerName = "Informe o seu nome.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = "Informe um e-mail válido.";
      const passwordValidation = validatePassword(form.password);
      if (!passwordValidation.valid) nextErrors.password = passwordValidation.message;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;

    if (!validate(0) || !validate(1) || !validate(2) || !form.profileCode) {
      setError("Revise os campos destacados.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await createStore({
        data: {
          storeName: form.storeName,
          slug: slugify(effectiveSlug),
          profileCode: form.profileCode,
          otherBusinessType: form.profileCode === "outros" ? form.otherBusinessType : undefined,
          city: form.city,
          state: form.state.toUpperCase(),
          phone: form.phone,
          ownerName: form.ownerName,
          email: form.email,
          password: form.password,
          planCode: selected.plan,
        },
      });

      await signInStore(form.email, form.password);
      setForm((value) => ({ ...value, password: "" }));

      if (paid) {
        window.location.assign(
          `/app/loja/plano?purchase=${selected.plan}&interval=${selected.interval}`,
        );
        return;
      }

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

  const set =
    (
      key:
        | "storeName"
        | "city"
        | "state"
        | "phone"
        | "ownerName"
        | "email"
        | "password"
        | "otherBusinessType",
    ) =>
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setForm((value) => ({
        ...value,
        [key]: key === "state" ? event.target.value.toUpperCase() : event.target.value,
      }));

  function advance() {
    if (!validate(step)) return;
    if (step === 0) void verifySlug(effectiveSlug);
    setError(null);
    setStep((value) => Math.min(3, value + 1));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    setError(null);
    setStep((value) => Math.max(0, value - 1));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="min-h-dvh bg-[radial-gradient(circle_at_100%_0%,rgba(255,104,31,.08),transparent_24rem),radial-gradient(circle_at_0%_100%,rgba(85,32,122,.055),transparent_24rem),#FCFAF8] text-[#17131C]">
      <header className="border-b border-[#EAE5ED]/80 bg-[#FCFAF8]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[1040px] items-center justify-between px-4 sm:px-6">
          <Link to="/" aria-label="Comandiva, voltar ao início">
            <BrandLogo lockup="horizontal" className="h-9 w-auto sm:h-10" />
          </Link>
          <Link
            to="/entrar/loja"
            className="hidden text-sm font-bold text-[#55207A] hover:underline sm:inline-flex"
          >
            Já possui conta? Entrar
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1040px] px-4 py-6 sm:px-6 sm:py-10 lg:py-12">
        <Link
          to="/"
          className="mb-5 inline-flex min-h-10 items-center gap-2 text-sm font-bold text-[#55207A] sm:hidden"
        >
          <ArrowLeft className="size-4" /> Voltar ao início
        </Link>

        <section className="rounded-[28px] border border-[#EAE5ED] bg-white/88 shadow-[0_22px_70px_rgba(27,13,44,.08)] backdrop-blur-sm">
          <div className="border-b border-[#EAE5ED] p-5 sm:p-7 lg:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#F2EAF5] text-[#55207A]">
                  <CheckCircle2 className="size-5" />
                </div>
                <div>
                  <p className="text-base font-extrabold text-[#2B183B]">
                    Plano {PLAN_NAMES[selected.plan]}
                  </p>
                  <p className="mt-0.5 text-sm text-[#746B78]">
                    {paid
                      ? `${selected.interval === "annual" ? "Cobrança anual" : "Cobrança mensal"}. Você confirma o pagamento depois do cadastro.`
                      : "Sem cobrança recorrente."}
                  </p>
                </div>
              </div>
              <span className="inline-flex w-fit rounded-full bg-[#FFF0E8] px-3 py-1.5 text-xs font-extrabold text-[#C94A0E]">
                Etapa {step + 1} de 4
              </span>
            </div>

            <div className="mt-6 flex gap-2" aria-label={`Etapa ${step + 1} de 4`}>
              {STEPS.map((item, index) => (
                <span
                  key={item.title}
                  className={cn(
                    "h-1.5 flex-1 rounded-full transition-colors",
                    index <= step ? "bg-[#FF681F]" : "bg-[#E7DDEA]",
                  )}
                />
              ))}
            </div>
          </div>

          <form onSubmit={submit}>
            <div className="p-5 sm:p-7 lg:p-8">
              <div className="max-w-3xl">
                <h1 className="font-display text-3xl font-extrabold tracking-[-.04em] text-[#55207A] sm:text-4xl">
                  {STEPS[step].title}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#69626E] sm:text-base sm:leading-7">
                  {STEPS[step].description}
                </p>
              </div>

              {error ? <div className="mt-6"><AuthAlert message={error} /></div> : null}

              {step === 0 ? (
                <div className="mt-7 space-y-7">
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2.5">
                      <Label htmlFor="storeName" className="font-bold text-[#2B183B]">
                        Nome da loja
                      </Label>
                      <div className="relative">
                        <Store className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#55207A]" />
                        <Input
                          id="storeName"
                          value={form.storeName}
                          onChange={set("storeName")}
                          disabled={busy}
                          placeholder="Ex.: Pizzaria Bella Napoli"
                          className={cn(inputClass, "pl-12")}
                        />
                      </div>
                      <FieldError value={errors.storeName} />
                    </div>

                    <div className="space-y-2.5">
                      <Label htmlFor="slug" className="font-bold text-[#2B183B]">
                        Endereço do cardápio
                      </Label>
                      <div className="flex overflow-hidden rounded-2xl border border-[#DED7E3] bg-white focus-within:border-[#55207A]/45 focus-within:ring-2 focus-within:ring-[#55207A]/12">
                        <span className="flex h-14 items-center border-r border-[#EAE5ED] bg-[#F7F2F8] px-4 text-sm font-extrabold text-[#55207A]">
                          /loja/
                        </span>
                        <Input
                          id="slug"
                          value={effectiveSlug}
                          onChange={(event) => {
                            setSlugTouched(true);
                            setForm((value) => ({ ...value, slug: slugify(event.target.value) }));
                            setSlugState(null);
                          }}
                          onBlur={(event) => void verifySlug(event.target.value)}
                          disabled={busy}
                          placeholder="bella-napoli"
                          className="h-14 rounded-none border-0 bg-white text-base text-[#17131C] shadow-none focus-visible:ring-0"
                        />
                      </div>
                      <p className="text-xs text-[#807684]">
                        Seu link ficará: <strong className="text-[#55207A]">/loja/{effectiveSlug || "sua-loja"}</strong>
                      </p>
                      <FieldError value={errors.slug} />
                      {slugState ? (
                        <p className={cn("text-xs font-semibold", slugState.available ? "text-success" : "text-danger")}>
                          {slugState.available ? "Endereço disponível." : "Endereço indisponível."}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div>
                    <div className="mb-4">
                      <h2 className="text-xl font-extrabold tracking-[-.02em] text-[#2B183B]">
                        Qual é o tipo da sua loja?
                      </h2>
                      <p className="mt-1.5 text-sm leading-6 text-[#69626E]">
                        Isso define o modelo inicial do cardápio. Você pode personalizar tudo depois.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      {STORE_PROFILES.map((profile) => {
                        const Icon = profile.icon;
                        const selectedType = form.profileCode === profile.code;
                        return (
                          <button
                            key={profile.code}
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setForm((value) => ({
                                ...value,
                                profileCode: profile.code,
                                otherBusinessType:
                                  profile.code === "outros" ? value.otherBusinessType : "",
                              }));
                              setErrors((value) => ({
                                ...value,
                                profileCode: "",
                                otherBusinessType: "",
                              }));
                            }}
                            className={cn(
                              "relative min-h-[112px] rounded-[20px] border p-3.5 text-left transition sm:min-h-[126px] sm:p-4",
                              profile.code === "outros" && "col-span-2 min-h-[92px] sm:min-h-[100px]",
                              selectedType
                                ? "border-[#FF681F] bg-[#FFF8F4] shadow-[0_10px_26px_rgba(255,104,31,.09)] ring-1 ring-[#FF681F]/20"
                                : "border-[#EAE5ED] bg-white hover:border-[#55207A]/25 hover:shadow-[0_10px_28px_rgba(27,13,44,.05)]",
                            )}
                          >
                            {selectedType ? (
                              <span className="absolute right-3 top-3 flex size-6 items-center justify-center rounded-full bg-[#55207A] text-white">
                                <Check className="size-3.5" />
                              </span>
                            ) : null}
                            <div
                              className={cn(
                                "mb-3 flex size-10 items-center justify-center rounded-2xl bg-[#F2EAF5] text-[#55207A] sm:size-11",
                                profile.code === "outros" && "mb-0 mr-3 inline-flex align-middle",
                              )}
                            >
                              <Icon className="size-5" />
                            </div>
                            <div className={cn(profile.code === "outros" && "inline-block align-middle") }>
                              <span className="block pr-5 text-sm font-extrabold leading-5 text-[#2B183B] sm:text-base">
                                {profile.name}
                              </span>
                              <span className="mt-1 block text-xs leading-5 text-[#746B78] sm:text-sm">
                                {profile.hint}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-2"><FieldError value={errors.profileCode} /></div>
                  </div>

                  {form.profileCode === "outros" ? (
                    <div className="space-y-2.5 rounded-[20px] border border-dashed border-[#55207A]/25 bg-[#F7F2F8]/70 p-4 sm:p-5">
                      <Label htmlFor="otherBusinessType" className="font-bold text-[#2B183B]">
                        Qual é o seu tipo de negócio?
                      </Label>
                      <Input
                        id="otherBusinessType"
                        value={form.otherBusinessType}
                        onChange={set("otherBusinessType")}
                        maxLength={80}
                        placeholder="Ex.: rotisserie, loja de bolos, empório…"
                        className={inputClass}
                      />
                      <p className="text-xs leading-5 text-[#746B78]">
                        Usaremos essa informação para preparar a configuração inicial da sua loja.
                      </p>
                      <FieldError value={errors.otherBusinessType} />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {step === 1 ? (
                <div className="mt-7 grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2.5 sm:col-span-2">
                    <Label htmlFor="phone" className="font-bold text-[#2B183B]">WhatsApp</Label>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#55207A]" />
                      <Input
                        id="phone"
                        inputMode="tel"
                        value={form.phone}
                        onChange={set("phone")}
                        placeholder="(00) 00000-0000"
                        className={cn(inputClass, "pl-12")}
                      />
                    </div>
                    <FieldError value={errors.phone} />
                  </div>

                  <div className="space-y-2.5">
                    <Label htmlFor="city" className="font-bold text-[#2B183B]">Cidade</Label>
                    <div className="relative">
                      <MapPin className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#55207A]" />
                      <Input
                        id="city"
                        value={form.city}
                        onChange={set("city")}
                        placeholder="Sua cidade"
                        className={cn(inputClass, "pl-12")}
                      />
                    </div>
                    <FieldError value={errors.city} />
                  </div>

                  <div className="space-y-2.5">
                    <Label htmlFor="state" className="font-bold text-[#2B183B]">UF</Label>
                    <Input
                      id="state"
                      maxLength={2}
                      value={form.state}
                      onChange={set("state")}
                      placeholder="MG"
                      className={cn(inputClass, "uppercase")}
                    />
                    <FieldError value={errors.state} />
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="mt-7 space-y-5">
                  <div className="space-y-2.5">
                    <Label htmlFor="ownerName" className="font-bold text-[#2B183B]">Seu nome</Label>
                    <div className="relative">
                      <UserRound className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#55207A]" />
                      <Input
                        id="ownerName"
                        value={form.ownerName}
                        onChange={set("ownerName")}
                        placeholder="Nome do responsável"
                        className={cn(inputClass, "pl-12")}
                      />
                    </div>
                    <FieldError value={errors.ownerName} />
                  </div>

                  <div className="space-y-2.5">
                    <Label htmlFor="email" className="font-bold text-[#2B183B]">E-mail de acesso</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#55207A]" />
                      <Input
                        id="email"
                        type="email"
                        inputMode="email"
                        autoComplete="username"
                        value={form.email}
                        onChange={set("email")}
                        placeholder="seu@email.com"
                        className={cn(inputClass, "pl-12")}
                      />
                    </div>
                    <FieldError value={errors.email} />
                  </div>

                  <div>
                    <PasswordField
                      id="password"
                      label="Senha"
                      autoComplete="new-password"
                      value={form.password}
                      onChange={(value) => setForm((current) => ({ ...current, password: value }))}
                      error={errors.password}
                    />
                  </div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="mt-7 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[20px] border border-[#EAE5ED] bg-[#FCFAF8] p-4 sm:p-5">
                    <p className="text-xs font-extrabold uppercase tracking-[.12em] text-[#8A7F8E]">Sua loja</p>
                    <p className="mt-2 text-lg font-extrabold text-[#2B183B]">{form.storeName}</p>
                    <p className="mt-1 text-sm text-[#69626E]">/loja/{effectiveSlug}</p>
                  </div>
                  <div className="rounded-[20px] border border-[#EAE5ED] bg-[#FCFAF8] p-4 sm:p-5">
                    <p className="text-xs font-extrabold uppercase tracking-[.12em] text-[#8A7F8E]">Tipo</p>
                    <p className="mt-2 text-lg font-extrabold text-[#2B183B]">
                      {selectedProfile?.name}
                    </p>
                    {form.profileCode === "outros" ? (
                      <p className="mt-1 text-sm text-[#69626E]">{form.otherBusinessType.trim()}</p>
                    ) : null}
                  </div>
                  <div className="rounded-[20px] border border-[#EAE5ED] bg-[#FCFAF8] p-4 sm:p-5">
                    <p className="text-xs font-extrabold uppercase tracking-[.12em] text-[#8A7F8E]">Local</p>
                    <p className="mt-2 text-base font-bold text-[#2B183B]">{form.city}/{form.state}</p>
                    <p className="mt-1 text-sm text-[#69626E]">{form.phone}</p>
                  </div>
                  <div className="rounded-[20px] border border-[#EAE5ED] bg-[#FCFAF8] p-4 sm:p-5">
                    <p className="text-xs font-extrabold uppercase tracking-[.12em] text-[#8A7F8E]">Acesso</p>
                    <p className="mt-2 text-base font-bold text-[#2B183B]">{form.ownerName}</p>
                    <p className="mt-1 break-all text-sm text-[#69626E]">{form.email}</p>
                  </div>
                  <div className="sm:col-span-2 rounded-[20px] border border-[#55207A]/12 bg-[#F7F2F8] p-4 sm:p-5">
                    <p className="font-bold text-[#55207A]">
                      {paid
                        ? `Depois de criar a loja, você continuará para o Plano ${PLAN_NAMES[selected.plan]}.`
                        : "Sua loja começará no Plano Gratuito."}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="sticky bottom-0 z-10 border-t border-[#EAE5ED] bg-white/95 p-4 backdrop-blur-xl sm:static sm:px-7 sm:py-5 lg:px-8">
              <div className="flex gap-3">
                {step > 0 ? (
                  <button
                    type="button"
                    onClick={goBack}
                    disabled={busy}
                    className="inline-flex h-14 min-w-[108px] items-center justify-center gap-2 rounded-2xl border border-[#DED7E3] bg-white px-5 text-sm font-extrabold text-[#55207A] transition hover:bg-[#F7F2F8] disabled:opacity-50"
                  >
                    <ArrowLeft className="size-4" /> Voltar
                  </button>
                ) : null}
                <button
                  type={step === 3 ? "submit" : "button"}
                  onClick={step < 3 ? advance : undefined}
                  disabled={busy}
                  className="inline-flex h-14 flex-1 items-center justify-center rounded-2xl bg-[#FF681F] px-5 text-center text-base font-extrabold text-white shadow-[0_10px_24px_rgba(255,104,31,.20)] transition hover:bg-[#E95612] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy
                    ? "Criando loja…"
                    : step === 3
                      ? paid
                        ? "Criar loja e continuar"
                        : "Criar loja grátis"
                      : "Continuar"}
                </button>
              </div>
              <p className="mt-3 text-center text-xs text-[#807684] sm:hidden">
                Já possui conta?{" "}
                <Link to="/entrar/loja" className="font-bold text-[#55207A]">
                  Entrar
                </Link>
              </p>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
