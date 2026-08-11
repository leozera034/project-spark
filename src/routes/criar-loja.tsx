import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, Check, CheckCircle2, Globe2, ShieldCheck, Sparkles, Store, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "@/components/auth/PasswordField";
import { BrandLogo } from "@/components/brand/BrandLogo";
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
      { property: "og:description", content: "Cardápio digital, pedidos, cozinha e entregas em uma única plataforma." },
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
  { code: "essencial", label: "Essencial", price: "R$ 99/mês", note: "Para começar organizado" },
  { code: "profissional", label: "Profissional", price: "R$ 189/mês", note: "Para operação em crescimento" },
  { code: "avancado", label: "Avançado", price: "R$ 299/mês", note: "Para maior volume e gestão" },
] as const;

function CreateStorePage() {
  const navigate = useNavigate();
  const { signInStore } = useAuth();
  const checkSlug = useServerFn(checkStoreSlug);
  const createStore = useServerFn(createStoreAccount);

  const [storeName, setStoreName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugState, setSlugState] = useState<{ available: boolean; reason: string | null } | null>(null);
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
      setError(cause instanceof Error && cause.message ? cause.message : "Não foi possível criar a loja agora.");
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f5f0] text-[#071318]">
      <header className="border-b border-[#071318]/8 bg-[#f7f5f0]/88 backdrop-blur-xl">
        <div className="pa-shell flex h-18 items-center justify-between">
          <Link to="/" aria-label="Pediu Aqui"><BrandLogo lockup="horizontal" className="h-7 w-auto" /></Link>
          <Link to="/entrar/loja" search={{ retorno: undefined }} className="inline-flex items-center gap-2 rounded-xl border border-[#071318]/10 bg-white px-4 py-2.5 text-sm font-bold transition hover:border-[#071318]/20">
            Já tenho acesso
          </Link>
        </div>
      </header>

      <div className="pa-shell grid gap-10 py-10 lg:grid-cols-[.82fr_1.18fr] lg:gap-16 lg:py-16">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Link to="/" className="inline-flex items-center gap-2 text-xs font-bold text-[#667278] transition hover:text-[#071318]"><ArrowLeft className="size-4" /> Voltar ao início</Link>
          <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#12d8c1]/10 px-3 py-1.5 text-xs font-black text-[#0d9f91]"><Sparkles className="size-3.5" /> 14 dias de cortesia</div>
          <h1 className="pa-display mt-5 text-4xl font-bold leading-[1.02] sm:text-5xl lg:text-6xl">Sua loja online começa por uma base bem organizada.</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-[#667278]">Crie a estrutura principal agora. Depois você monta o cardápio, ajusta a operação e libera o link para seus clientes.</p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {[
              [Globe2, "Seu próprio link", "Cardápio acessível direto pelo celular."],
              [Store, "Painel completo", "Pedidos, cozinha, equipe e entrega."],
              [ShieldCheck, "Fluxo protegido", "Permissões e cálculos no servidor."],
              [Zap, "Configuração rápida", "Comece simples e refine depois."],
            ].map(([Icon, title, copy]) => (
              <div key={String(title)} className="rounded-2xl border border-[#071318]/8 bg-white/72 p-4">
                <Icon className="size-4 text-[#0d9f91]" />
                <p className="mt-3 text-sm font-extrabold">{title}</p>
                <p className="mt-1 text-xs leading-5 text-[#778186]">{copy}</p>
              </div>
            ))}
          </div>
        </aside>

        <section className="rounded-[30px] border border-[#071318]/9 bg-white p-5 shadow-[0_30px_80px_rgba(7,19,24,.09)] sm:p-8 lg:p-10">
          <div className="mb-8 flex items-start justify-between gap-4 border-b border-[#071318]/8 pb-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[.14em] text-[#0d9f91]">Configuração inicial</p>
              <h2 className="pa-display mt-2 text-2xl font-bold sm:text-3xl">Dados da sua operação</h2>
              <p className="mt-2 text-sm text-[#778186]">Você poderá alterar praticamente tudo depois.</p>
            </div>
            <div className="hidden size-11 place-items-center rounded-2xl bg-[#12d8c1]/10 text-[#0d9f91] sm:grid"><Store className="size-5" /></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-7" noValidate>
            {error ? <p role="alert" className="rounded-2xl border border-red-500/16 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</p> : null}

            <div>
              <SectionLabel number="01" title="Identidade da loja" />
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field className="sm:col-span-2" label="Nome da loja" htmlFor="storeName">
                  <Input id="storeName" value={storeName} onChange={(event) => setStoreName(event.target.value)} onBlur={() => verifySlug(effectiveSlug)} disabled={busy} required className="h-12 rounded-xl" placeholder="Ex.: Sabor da Praça" />
                </Field>
                <Field className="sm:col-span-2" label="Endereço do cardápio" htmlFor="slug">
                  <div className="flex items-center overflow-hidden rounded-xl border border-input bg-[#fbfbfa] focus-within:ring-4 focus-within:ring-[#12d8c1]/12">
                    <span className="shrink-0 border-r border-[#071318]/8 px-3 text-xs font-bold text-[#778186]">/loja/</span>
                    <Input id="slug" value={effectiveSlug} onChange={(event) => { setSlugTouched(true); setSlug(slugify(event.target.value)); setSlugState(null); }} onBlur={(event) => verifySlug(event.target.value)} disabled={busy} className="h-12 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0" placeholder="nome-da-loja" />
                  </div>
                  {slugState ? <p className={`mt-2 flex items-center gap-1.5 text-xs font-bold ${slugState.available ? "text-[#0d9f91]" : "text-red-600"}`}>{slugState.available ? <CheckCircle2 className="size-3.5" /> : null}{slugState.available ? "Endereço disponível." : slugState.reason === "em_uso" ? "Esse endereço já está em uso." : "Escolha um endereço com 3 a 60 caracteres."}</p> : null}
                </Field>
                <Field label="Segmento" htmlFor="segment"><Input id="segment" placeholder="Mercado, pizzaria, farmácia…" value={segment} onChange={(event) => setSegment(event.target.value)} disabled={busy} className="h-12 rounded-xl" /></Field>
                <Field label="WhatsApp da loja" htmlFor="phone"><Input id="phone" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} disabled={busy} required className="h-12 rounded-xl" placeholder="(00) 00000-0000" /></Field>
                <Field label="Cidade" htmlFor="city"><Input id="city" value={city} onChange={(event) => setCity(event.target.value)} disabled={busy} required className="h-12 rounded-xl" /></Field>
                <Field label="UF" htmlFor="state"><Input id="state" maxLength={2} value={state} onChange={(event) => setState(event.target.value.toUpperCase())} disabled={busy} required className="h-12 rounded-xl uppercase" placeholder="MG" /></Field>
              </div>
            </div>

            <div className="border-t border-[#071318]/8 pt-7">
              <SectionLabel number="02" title="Seu acesso" />
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field className="sm:col-span-2" label="Seu nome" htmlFor="ownerName"><Input id="ownerName" value={ownerName} onChange={(event) => setOwnerName(event.target.value)} disabled={busy} required className="h-12 rounded-xl" /></Field>
                <Field className="sm:col-span-2" label="E-mail de acesso" htmlFor="email"><Input id="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} required className="h-12 rounded-xl" /></Field>
                <div className="sm:col-span-2"><PasswordField label="Senha" value={password} onChange={setPassword} autoComplete="new-password" disabled={busy} /></div>
              </div>
            </div>

            <fieldset className="border-t border-[#071318]/8 pt-7">
              <legend className="sr-only">Plano após o período de cortesia</legend>
              <SectionLabel number="03" title="Plano após a cortesia" />
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {PLANS.map((plan) => (
                  <label key={plan.code} className={`relative cursor-pointer rounded-2xl border p-4 transition ${planCode === plan.code ? "border-[#0d9f91] bg-[#12d8c1]/7 shadow-[0_0_0_3px_rgba(18,216,193,.08)]" : "border-[#071318]/9 bg-[#fbfbfa] hover:border-[#0d9f91]/35"}`}>
                    <input type="radio" name="plan" className="sr-only" value={plan.code} checked={planCode === plan.code} onChange={() => setPlanCode(plan.code)} disabled={busy} />
                    <div className="flex items-start justify-between gap-3"><div><span className="block text-sm font-extrabold">{plan.label}</span><span className="mt-1 block text-xs text-[#778186]">{plan.note}</span></div>{planCode === plan.code ? <span className="grid size-5 place-items-center rounded-full bg-[#12d8c1] text-[#071318]"><Check className="size-3" /></span> : null}</div>
                    <span className="mt-4 block text-base font-black">{plan.price}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <Button type="submit" size="lg" loading={busy} loadingLabel="Criando loja" className="h-14 w-full rounded-2xl text-base font-extrabold">
              {busy ? "Criando sua loja…" : "Criar minha loja"}
            </Button>

            <p className="text-center text-xs leading-5 text-[#778186]">Ao criar a loja, você entra diretamente no painel para terminar a configuração. Já tem conta? <Link to="/entrar/loja" search={{ retorno: undefined }} className="font-bold text-[#0d9f91] underline underline-offset-4">Entrar</Link></p>
          </form>
        </section>
      </div>
    </main>
  );
}

function SectionLabel({ number, title }: { number: string; title: string }) {
  return <div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-xl bg-[#071318] text-xs font-black text-white">{number}</span><h3 className="text-sm font-extrabold">{title}</h3></div>;
}

function Field({ label, htmlFor, children, className = "" }: { label: string; htmlFor: string; children: React.ReactNode; className?: string }) {
  return <div className={`space-y-2 ${className}`}><Label htmlFor={htmlFor} className="text-xs font-extrabold text-[#334248]">{label}</Label>{children}</div>;
}
