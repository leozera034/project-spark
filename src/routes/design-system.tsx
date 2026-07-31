import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { BrandLogo, BrandSymbol } from "@/components/brand/BrandLogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/design-system")({
  component: DesignSystemPage,
  head: () => ({
    meta: [
      { title: "Design System | Pediu Aqui" },
      {
        name: "description",
        content:
          "Galeria oficial da identidade Pediu Aqui: marca, paleta carbono e teal, tipografia, espacamento, elevacao e componentes de interface.",
      },
      { property: "og:title", content: "Design System | Pediu Aqui" },
      {
        property: "og:description",
        content:
          "Galeria oficial da identidade Pediu Aqui: marca, paleta, tipografia e componentes de interface.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-border py-12 first:border-t-0">
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
      <div className="mt-8">{children}</div>
    </section>
  );
}

function Swatch({ name, token, className }: { name: string; token: string; className: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-e1">
      <div className={`h-16 w-full ${className}`} />
      <div className="p-3">
        <p className="text-sm font-medium">{name}</p>
        <code className="mt-1 block font-mono text-xs text-muted-foreground">{token}</code>
      </div>
    </div>
  );
}

const brandScale = [
  { name: "Brand", token: "bg-brand", className: "bg-brand" },
  { name: "Brand strong", token: "bg-brand-strong", className: "bg-brand-strong" },
  { name: "Brand soft", token: "bg-brand-soft", className: "bg-brand-soft" },
  { name: "Carbono", token: "bg-carbon", className: "bg-carbon" },
];

const surfaceScale = [
  { name: "Background", token: "bg-background", className: "bg-background" },
  { name: "Surface", token: "bg-surface", className: "bg-surface" },
  { name: "Surface muted", token: "bg-surface-muted", className: "bg-surface-muted" },
  { name: "Border", token: "bg-border", className: "bg-border" },
];

const feedbackScale = [
  { name: "Sucesso", token: "bg-success", className: "bg-success" },
  { name: "Atencao", token: "bg-warning", className: "bg-warning" },
  { name: "Erro", token: "bg-danger", className: "bg-danger" },
  { name: "Informacao", token: "bg-info", className: "bg-info" },
];

const typeScale = [
  { label: "Display", className: "text-4xl font-extrabold tracking-tight sm:text-5xl" },
  { label: "Titulo 1", className: "text-3xl font-bold tracking-tight" },
  { label: "Titulo 2", className: "text-2xl font-semibold tracking-tight" },
  { label: "Titulo 3", className: "text-xl font-semibold" },
  { label: "Corpo", className: "text-base" },
  { label: "Apoio", className: "text-sm text-muted-foreground" },
  { label: "Legenda", className: "text-xs uppercase tracking-widest text-muted-foreground" },
];

const spacing = [1, 2, 3, 4, 6, 8, 12, 16];
const radii = [
  { name: "sm", className: "rounded-sm" },
  { name: "md", className: "rounded-md" },
  { name: "lg", className: "rounded-lg" },
  { name: "xl", className: "rounded-xl" },
  { name: "2xl", className: "rounded-2xl" },
  { name: "full", className: "rounded-full" },
];

const orderStates: Array<{ label: string; variant: "info" | "warning" | "brandSoft" | "success" | "danger" }> = [
  { label: "Recebido", variant: "info" },
  { label: "Em preparo", variant: "warning" },
  { label: "Saiu para entrega", variant: "brandSoft" },
  { label: "Entregue", variant: "success" },
  { label: "Cancelado", variant: "danger" },
];

const assets = [
  { label: "Master", src: "/brand/pediu-aqui-master.svg", dark: false },
  { label: "Horizontal carbono", src: "/brand/logo-horizontal-carbon.svg", dark: false },
  { label: "Horizontal branco", src: "/brand/logo-horizontal-white.svg", dark: true },
  { label: "Horizontal monocromatico", src: "/brand/logo-horizontal-monochrome.svg", dark: false },
  { label: "Vertical carbono", src: "/brand/logo-stacked-carbon.svg", dark: false },
  { label: "Vertical branco", src: "/brand/logo-stacked-white.svg", dark: true },
];

function DesignSystemPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <BrandLogo className="h-7 sm:h-8" />
          <Badge variant="brandSoft">Fase 02</Badge>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="py-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-soft-foreground">
            Pediu Aqui
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-5xl">
            Design System e Kit de Marca
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground">
            Referencia unica de identidade visual do Pediu Aqui. Todo componente da plataforma usa
            estes tokens. Nenhuma cor crua e permitida no codigo de interface.
          </p>
        </div>

        <Section
          id="marca"
          title="Marca"
          description="O simbolo e a letra P construida em geometria constante, com uma faixa horizontal que representa o pedido em movimento. Todos os arquivos derivam de um unico SVG master."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {assets.map((asset) => (
              <div
                key={asset.label}
                className="overflow-hidden rounded-xl border border-border bg-surface shadow-e1"
              >
                <div
                  className={`flex h-32 items-center justify-center px-6 ${
                    asset.dark ? "bg-carbon" : "bg-surface-muted"
                  }`}
                >
                  <img src={asset.src} alt={asset.label} className="max-h-16 w-auto max-w-full" />
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium">{asset.label}</p>
                  <code className="mt-1 block truncate font-mono text-xs text-muted-foreground">
                    {asset.src}
                  </code>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(["carbon-teal", "carbon", "teal", "white"] as const).map((tone) => (
              <div
                key={tone}
                className={`flex h-28 items-center justify-center rounded-xl border border-border ${
                  tone === "white" ? "bg-carbon" : "bg-surface-muted"
                }`}
              >
                <BrandSymbol tone={tone} className="size-16" />
              </div>
            ))}
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">Uso correto</CardTitle>
              <CardDescription>Regras obrigatorias para qualquer aplicacao.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
              <ul className="space-y-2 text-muted-foreground">
                <li>Area de respiro minima igual a largura da haste do simbolo.</li>
                <li>Tamanho minimo: 24px de altura para o simbolo, 20px para o bloco horizontal.</li>
                <li>Em fundo escuro, usar a versao branca; em impressao de uma cor, a monocromatica.</li>
              </ul>
              <ul className="space-y-2 text-muted-foreground">
                <li>Nao aplicar sombra, contorno, gradiente, 3D ou brilho.</li>
                <li>Nao distorcer, rotacionar, recolorir nem recompor o bloco.</li>
                <li>Nao usar o wordmark sozinho quando o simbolo ainda nao apareceu na tela.</li>
              </ul>
            </CardContent>
          </Card>
        </Section>

        <Section
          id="cores"
          title="Cores"
          description="Carbono profundo como base institucional e teal como unica cor de acao. Roxo, laranja, vermelho decorativo, neon e gradientes chamativos sao proibidos."
        >
          <div className="space-y-8">
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                Marca
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {brandScale.map((c) => (
                  <Swatch key={c.token} {...c} />
                ))}
              </div>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                Superficies
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {surfaceScale.map((c) => (
                  <Swatch key={c.token} {...c} />
                ))}
              </div>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                Feedback
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {feedbackScale.map((c) => (
                  <Swatch key={c.token} {...c} />
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Section
          id="tipografia"
          title="Tipografia"
          description="Inter em toda a plataforma. Hierarquia curta e alto contraste, pensada para leitura rapida em celular e para publico idoso."
        >
          <div className="space-y-5">
            {typeScale.map((t) => (
              <div key={t.label} className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-6">
                <code className="w-28 shrink-0 font-mono text-xs text-muted-foreground">
                  {t.label}
                </code>
                <p className={t.className}>Pediu Aqui, seu pedido em poucos toques</p>
              </div>
            ))}
          </div>
        </Section>

        <Section
          id="espacamento"
          title="Espacamento, raios e elevacao"
          description="Escala de 4px, raio base de 12px e tres niveis de elevacao. Sombras sao discretas e nunca coloridas."
        >
          <div className="grid gap-8 lg:grid-cols-3">
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                Espacamento
              </h3>
              <div className="space-y-2">
                {spacing.map((s) => (
                  <div key={s} className="flex items-center gap-3">
                    <code className="w-12 font-mono text-xs text-muted-foreground">{s * 4}px</code>
                    <div className="h-3 rounded-sm bg-brand" style={{ width: s * 4 }} />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                Raios
              </h3>
              <div className="flex flex-wrap gap-3">
                {radii.map((r) => (
                  <div key={r.name} className="text-center">
                    <div className={`size-16 border border-border bg-surface-muted ${r.className}`} />
                    <code className="mt-1 block font-mono text-xs text-muted-foreground">
                      {r.name}
                    </code>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                Elevacao
              </h3>
              <div className="space-y-4">
                {["shadow-e1", "shadow-e2", "shadow-e3"].map((s) => (
                  <div
                    key={s}
                    className={`rounded-xl border border-border bg-surface p-4 text-sm ${s}`}
                  >
                    <code className="font-mono text-xs text-muted-foreground">{s}</code>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Section
          id="componentes"
          title="Componentes"
          description="Estados visuais base da interface. Alvos de toque de 48px sao usados em fluxos de cliente e de entregador."
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Botoes</CardTitle>
                <CardDescription>Acao principal sempre em teal.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button variant="brand">Fazer pedido</Button>
                <Button variant="brand" size="touch">
                  Alvo de toque
                </Button>
                <Button variant="brandSoft">Secundaria</Button>
                <Button variant="outline">Contorno</Button>
                <Button variant="ghost">Discreta</Button>
                <Button variant="destructive">Cancelar</Button>
                <Button variant="brand" disabled>
                  Desabilitada
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Estados do pedido</CardTitle>
                <CardDescription>Vocabulario visual da maquina de estados.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {orderStates.map((s) => (
                  <Badge key={s.label} variant={s.variant}>
                    {s.label}
                  </Badge>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Campos</CardTitle>
                <CardDescription>Rotulos sempre visiveis, nunca apenas placeholder.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ds-nome">Primeiro nome</Label>
                  <Input id="ds-nome" placeholder="Maria" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ds-tel">Telefone</Label>
                  <Input id="ds-tel" inputMode="tel" placeholder="(00) 00000-0000" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ds-obs">Observacao</Label>
                  <Textarea id="ds-obs" placeholder="Sem cebola, por favor" />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label htmlFor="ds-switch">Receber neste endereco</Label>
                  <Switch id="ds-switch" defaultChecked />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cartao de conteudo</CardTitle>
                <CardDescription>Padrao usado em produtos e pedidos.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-surface-muted p-4">
                  <div>
                    <p className="font-medium">Pedido #1042</p>
                    <p className="text-sm text-muted-foreground">3 itens · entrega</p>
                  </div>
                  <Badge variant="warning">Em preparo</Badge>
                </div>
                <div className="rounded-lg bg-carbon p-4 text-carbon-foreground">
                  <p className="text-sm font-medium">Superficie carbono</p>
                  <p className="text-sm opacity-80">Usada em cabecalhos e no app do entregador.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </Section>

        <Section
          id="tema-escuro"
          title="Tema escuro"
          description="Todos os tokens tem par no tema escuro. O bloco abaixo aplica a classe dark isoladamente."
        >
          <div className="dark rounded-xl border border-border bg-background p-6 text-foreground">
            <div className="flex flex-wrap items-center gap-4">
              <BrandLogo tone="white" className="h-8" />
              <Badge variant="brand">Teal</Badge>
              <Badge variant="success">Entregue</Badge>
              <Button variant="brand">Fazer pedido</Button>
              <Button variant="outline">Contorno</Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Contraste verificado para texto principal e secundario.
            </p>
          </div>
        </Section>
      </main>
    </div>
  );
}
