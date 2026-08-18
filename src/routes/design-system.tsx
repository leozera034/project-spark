import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { BrandLogo, BrandSymbol, BrandWordmark } from "@/components/brand/BrandLogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/design-system")({
  component: DesignSystemPage,
  head: () => ({
    meta: [
      { title: "Design System | Comandiva" },
      {
        name: "description",
        content:
          "Referência visual da Comandiva: marca, paleta plum e coral, tipografia, componentes e aplicações da interface.",
      },
      { property: "og:title", content: "Design System | Comandiva" },
      {
        property: "og:description",
        content: "Referência oficial da identidade visual e dos componentes da Comandiva.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-[#4B1D6D]/10 py-12 first:border-t-0">
      <h2 className="font-display text-2xl font-extrabold tracking-[-.03em] text-[#291F2E] sm:text-3xl">
        {title}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#746A78]">{description}</p>
      <div className="mt-8">{children}</div>
    </section>
  );
}

const colors = [
  { name: "Plum", hex: "#4B1D6D", className: "bg-[#4B1D6D]", usage: "Marca, navegação e estrutura" },
  { name: "Coral", hex: "#FF6A4D", className: "bg-[#FF6A4D]", usage: "CTA e destaques" },
  { name: "Cream", hex: "#FFF6F1", className: "bg-[#FFF6F1]", usage: "Fundos principais" },
  { name: "Charcoal", hex: "#1C1C1E", className: "bg-[#1C1C1E]", usage: "Texto e contraste" },
  { name: "Lavender", hex: "#8A7CA8", className: "bg-[#8A7CA8]", usage: "Apoio e estados suaves" },
] as const;

const assets = [
  { label: "Logo horizontal", src: "/brand/comandiva-logo-horizontal.png", dark: false },
  { label: "Logo empilhada", src: "/brand/comandiva-logo-stacked.png", dark: false },
  { label: "Símbolo", src: "/brand/comandiva-symbol.png", dark: false },
  { label: "Wordmark", src: "/brand/comandiva-wordmark.png", dark: false },
  { label: "Logo em fundo plum", src: "/brand/comandiva-logo-horizontal.png", dark: true },
  { label: "Ícone do app", src: "/brand/comandiva-app-icon.png", dark: false },
] as const;

function DesignSystemPage() {
  return (
    <div className="min-h-dvh bg-[#FFF6F1] text-[#1C1C1E]">
      <header className="sticky top-0 z-20 border-b border-[#4B1D6D]/10 bg-[#FFF6F1]/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[78px] max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <BrandLogo className="h-11 w-auto" />
          <div className="flex items-center gap-2">
            <Badge variant="brandSoft">Comandiva UI</Badge>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="py-14 sm:py-20">
          <p className="text-xs font-black uppercase tracking-[.22em] text-[#FF6A4D]">Comandiva</p>
          <h1 className="mt-4 max-w-4xl font-display text-4xl font-extrabold tracking-[-.05em] text-[#291F2E] sm:text-6xl">
            Design System e Kit de Marca
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#746A78]">
            Fonte visual de verdade da plataforma. Plum cria reconhecimento, coral orienta a ação, cream mantém leveza e charcoal garante leitura.
          </p>
        </div>

        <Section
          title="Marca"
          description="O símbolo une movimento, localização/comando e afeto. O logo deve manter proporção, transparência e área de respiro; não redesenhar nem aplicar efeitos decorativos."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {assets.map((asset) => (
              <div
                key={asset.label}
                className={
                  asset.dark
                    ? "overflow-hidden rounded-[24px] border border-[#4B1D6D]/10 bg-[#4B1D6D] shadow-sm"
                    : "overflow-hidden rounded-[24px] border border-[#4B1D6D]/10 bg-white shadow-sm"
                }
              >
                <div className="flex h-40 items-center justify-center p-7">
                  {asset.dark ? (
                    <BrandLogo tone="white" className="h-12 w-auto max-w-full" />
                  ) : (
                    <img src={asset.src} alt={asset.label} data-no-dim className="max-h-24 max-w-full object-contain" />
                  )}
                </div>
                <div className={asset.dark ? "border-t border-white/10 px-4 py-3 text-white" : "border-t border-[#4B1D6D]/10 px-4 py-3"}>
                  <p className="text-sm font-bold">{asset.label}</p>
                  <code className={asset.dark ? "mt-1 block truncate text-xs text-white/55" : "mt-1 block truncate text-xs text-[#7B707F]"}>
                    {asset.src}
                  </code>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="flex min-h-32 items-center justify-center rounded-[24px] border border-[#4B1D6D]/10 bg-white">
              <BrandSymbol className="size-20" />
            </div>
            <div className="flex min-h-32 items-center justify-center rounded-[24px] bg-[#4B1D6D]">
              <BrandSymbol tone="white" className="size-20" />
            </div>
            <div className="flex min-h-32 items-center justify-center rounded-[24px] border border-[#4B1D6D]/10 bg-white px-6">
              <BrandWordmark className="h-10 max-w-full" />
            </div>
          </div>
        </Section>

        <Section
          title="Paleta"
          description="A cor da marca não substitui estados semânticos. Verde continua significando sucesso; vermelho continua reservado a erro ou ação destrutiva."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {colors.map((color) => (
              <div key={color.name} className="overflow-hidden rounded-[22px] border border-[#4B1D6D]/10 bg-white shadow-sm">
                <div className={`h-24 ${color.className}`} />
                <div className="p-4">
                  <p className="font-extrabold text-[#2B2130]">{color.name}</p>
                  <code className="mt-1 block text-xs font-bold text-[#4B1D6D]">{color.hex}</code>
                  <p className="mt-2 text-xs leading-5 text-[#7A707E]">{color.usage}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Tipografia"
          description="Poppins concentra personalidade em títulos e marketing. Inter prioriza legibilidade em operação, formulários, tabelas e textos longos."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[26px] border border-[#4B1D6D]/10 bg-white p-7 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[.18em] text-[#FF6A4D]">Poppins</p>
              <p className="mt-4 font-display text-5xl font-extrabold tracking-[-.05em] text-[#4B1D6D]">Aa</p>
              <p className="mt-4 font-display text-2xl font-bold text-[#291F2E]">Operação que flui melhor.</p>
              <p className="mt-2 text-sm text-[#7A707E]">Headings, hero, campanhas e chamadas institucionais.</p>
            </div>
            <div className="rounded-[26px] border border-[#4B1D6D]/10 bg-white p-7 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[.18em] text-[#FF6A4D]">Inter</p>
              <p className="mt-4 text-5xl font-bold tracking-tight text-[#4B1D6D]">Aa</p>
              <p className="mt-4 text-2xl font-semibold text-[#291F2E]">Pedidos, cozinha e entregas.</p>
              <p className="mt-2 text-sm text-[#7A707E]">Interface, labels, formulários, dados e conteúdo operacional.</p>
            </div>
          </div>
        </Section>

        <Section
          title="Componentes"
          description="Componentes compartilhados seguem superfícies claras, bordas plum discretas, cantos amplos e coral para a ação primária."
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Ações</CardTitle>
                <CardDescription>Hierarquia recomendada de botões.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button>Continuar</Button>
                <Button variant="brand">Abrir painel</Button>
                <Button variant="outline">Cancelar</Button>
                <Button variant="ghost">Ver detalhes</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Estados</CardTitle>
                <CardDescription>Marca e feedback não devem disputar significado.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Badge variant="brandSoft">Novo</Badge>
                <Badge variant="success">Entregue</Badge>
                <Badge variant="warning">Em preparo</Badge>
                <Badge variant="danger">Cancelado</Badge>
                <Badge variant="info">Informação</Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Formulário</CardTitle>
                <CardDescription>Campos claros e foco visível.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ds-name">Nome da loja</Label>
                  <Input id="ds-name" placeholder="Cantina do Cheff" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ds-notes">Observações</Label>
                  <Textarea id="ds-notes" placeholder="Informações importantes para a operação" />
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                  <div>
                    <p className="text-sm font-semibold">Loja aberta</p>
                    <p className="text-xs text-muted-foreground">Permitir novos pedidos.</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>

            <div className="overflow-hidden rounded-[28px] border border-[#4B1D6D]/10 bg-white shadow-sm">
              <img
                src="/brand/comandiva-dashboard-preview.webp"
                alt="Referência visual do dashboard Comandiva"
                className="aspect-[16/10] w-full object-cover object-top"
              />
              <div className="p-5">
                <p className="font-extrabold text-[#2B2130]">Aplicação</p>
                <p className="mt-1 text-sm leading-6 text-[#786E7C]">
                  Cards brancos, navegação plum, conteúdo respirado e CTA coral compõem o padrão operacional.
                </p>
              </div>
            </div>
          </div>
        </Section>
      </main>
    </div>
  );
}
