import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CheckCircle2, CircleDollarSign, ExternalLink, LayoutTemplate, Loader2, PencilLine, Plus, Sparkles, TrendingUp } from "lucide-react";
import { useState } from "react";

import { fetchCatalogMenuIntelligence } from "@/catalog/api";
import { useCatalog } from "@/catalog/CatalogProvider";
import { applyCatalogStarterTemplate, type StarterTemplateCode } from "@/catalog/starter-templates";
import { formatPriceBRL } from "@/catalog/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/catalog/PageHeader";
import { useStoreScope } from "@/store-scope/StoreScopeProvider";

export const Route = createFileRoute("/app/loja/cardapio/")({ component: CardapioOverview });

type MenuModel = { code: StarterTemplateCode; name: string; description: string; creates: string };
const MENU_MODELS: MenuModel[] = [
  { code: "pizzaria", name: "Pizzaria", description: "Pizzas, tamanhos, sabores, bordas e adicionais.", creates: "Pizzas, combos, bebidas, sobremesas e grupos de escolhas." },
  { code: "hamburgueria", name: "Hamburgueria", description: "Lanches, adicionais, molhos e combos.", creates: "Hambúrgueres, combos, porções, bebidas e adicionais." },
  { code: "acai", name: "Açaí", description: "Tamanhos, frutas, cremes e coberturas.", creates: "Açaí, bebidas, tamanhos e complementos." },
  { code: "sorveteria", name: "Sorveteria", description: "Sabores, bolas, coberturas e recipientes.", creates: "Sorvetes, picolés, bebidas e complementos." },
  { code: "restaurante", name: "Marmitaria / Restaurante", description: "Pratos, marmitas, proteínas e acompanhamentos.", creates: "Pratos, marmitas, bebidas, sobremesas e acompanhamentos." },
  { code: "lanchonete", name: "Lanchonete", description: "Lanches, porções, bebidas e combos.", creates: "Lanches, combos, porções, bebidas e adicionais." },
  { code: "pastelaria", name: "Pastelaria", description: "Sabores, tamanhos, adicionais e combos.", creates: "Pastéis, combos, bebidas, tamanhos e adicionais." },
  { code: "adega", name: "Bebidas / Adega", description: "Volumes, embalagens, kits e gelo.", creates: "Bebidas, gelo, kits e variações de volume." },
  { code: "mercado", name: "Padaria / Mercado", description: "Produtos simples, peso, variações e estoque.", creates: "Padaria, mercearia, bebidas, frios e estrutura de variações." },
  { code: "outros", name: "Outro tipo de negócio", description: "Comece com uma estrutura genérica e adapte depois.", creates: "Produtos e bebidas para você personalizar." },
];

function Metric({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return <Card><CardHeader className="pb-2"><CardDescription>{label}</CardDescription><CardTitle className="text-3xl tabular-nums">{value}</CardTitle></CardHeader>{hint ? <CardContent className="pt-0 text-xs text-muted-foreground">{hint}</CardContent> : null}</Card>;
}

function FinanceMetric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <Card><CardHeader className="pb-2"><CardDescription>{label}</CardDescription><CardTitle className="text-2xl tabular-nums">{value}</CardTitle></CardHeader>{hint ? <CardContent className="pt-0 text-xs text-muted-foreground">{hint}</CardContent> : null}</Card>;
}

function CardapioOverview() {
  const navigate = useNavigate();
  const scope = useStoreScope();
  const { overview, categories, storeId, run, pendingKey, setPendingKey, isBusy } = useCatalog();
  const [otherBusinessType, setOtherBusinessType] = useState("");
  const [intelligencePeriod, setIntelligencePeriod] = useState<30 | 90>(30);

  const intelligenceQuery = useQuery({
    queryKey: ["catalog", "menu-intelligence", storeId, intelligencePeriod],
    queryFn: () => fetchCatalogMenuIntelligence(storeId, intelligencePeriod),
    enabled: Boolean(storeId && overview && overview.counts.products_total > 0),
    retry: false,
    staleTime: 60_000,
  });

  if (!overview) return null;

  const { counts, can } = overview;
  const emptyCatalog = counts.categories_total === 0 && counts.products_total === 0;
  const publicMenuHref = scope.selectedStore?.slug ? `/loja/${scope.selectedStore.slug}` : null;
  const actionItems = [
    counts.categories_active === 0 ? { label: "Ative pelo menos uma categoria", to: "/app/loja/cardapio/categorias" as const } : null,
    counts.products_active === 0 ? { label: "Publique pelo menos um produto", to: "/app/loja/cardapio/produtos" as const } : null,
    counts.products_sold_out > 0 ? { label: `Revise ${counts.products_sold_out} produto${counts.products_sold_out === 1 ? "" : "s"} esgotado${counts.products_sold_out === 1 ? "" : "s"}`, to: "/app/loja/cardapio/produtos" as const } : null,
    counts.products_active > 0 && counts.products_featured === 0 ? { label: "Escolha produtos para destacar", to: "/app/loja/cardapio/produtos" as const } : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  const intelligence = intelligenceQuery.data ?? null;
  const topProducts = intelligence?.items.filter((item) => item.revenue > 0).slice(0, 5) ?? [];

  async function applyModel(model: MenuModel) {
    if (!storeId || !can.create || isBusy) return;
    if (model.code === "outros" && otherBusinessType.trim().length < 2) return;
    const key = `starter:${model.code}`;
    setPendingKey(key);
    const result = await run(
      () => applyCatalogStarterTemplate(storeId, model.code, model.code === "outros" ? otherBusinessType : undefined),
      model.code === "outros" ? "Estrutura inicial criada." : `Modelo ${model.name} aplicado.`,
    );
    if (result) void navigate({ to: "/app/loja/cardapio/categorias" });
  }

  if (!emptyCatalog) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Cardápio"
          description="Gerencie o que o cliente vê e use dados reais de venda para melhorar preço, margem e disponibilidade."
          action={
            <>
              {publicMenuHref ? <Button asChild variant="outline"><a href={publicMenuHref} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /> Ver como cliente</a></Button> : null}
              {can.create && categories.some((category) => !category.is_archived) ? <Button asChild><Link to="/app/loja/cardapio/produtos/novo"><Plus className="size-4" /> Novo produto</Link></Button> : null}
            </>
          }
        />

        <section className={`rounded-2xl border p-4 sm:p-5 ${actionItems.length > 0 ? "border-warning/30 bg-warning-soft/35" : "border-success/25 bg-success-soft/35"}`} aria-label="Saúde do cardápio">
          <div className="flex items-start gap-3">
            <span className={`grid size-10 shrink-0 place-items-center rounded-xl bg-background ${actionItems.length > 0 ? "text-warning" : "text-success"}`}>
              {actionItems.length > 0 ? <AlertTriangle className="size-5" /> : <CheckCircle2 className="size-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-base font-black">{actionItems.length > 0 ? "Ajustes que podem melhorar o cardápio" : "Estrutura do cardápio em dia"}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {actionItems.length > 0 ? "Priorize os pontos abaixo para deixar a experiência do cliente mais clara e completa." : "Há categorias e produtos ativos, sem pendências básicas de estrutura."}
              </p>
              {actionItems.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {actionItems.map((item) => <Button key={item.label} asChild variant="outline" size="sm" className="bg-background"><Link to={item.to}>{item.label}<ArrowRight className="size-3.5" /></Link></Button>)}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Categorias ativas" value={counts.categories_active} hint={`${counts.categories_total} no total`} />
          <Metric label="Produtos ativos" value={counts.products_active} hint={`${counts.products_total} no total`} />
          <Metric label="Esgotados" value={counts.products_sold_out} hint="Não disponíveis para compra" />
          <Metric label="Destaques" value={counts.products_featured} hint="Chamam atenção no cardápio" />
        </div>

        {intelligence ? (
          <section className="space-y-4 rounded-2xl border border-brand/15 bg-brand-soft/15 p-4 sm:p-5" aria-label="Inteligência do cardápio">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-brand"><TrendingUp className="size-4" /><span className="text-xs font-extrabold uppercase tracking-[.14em]">Inteligência do cardápio</span></div>
                <h2 className="mt-1 text-xl font-black">Venda real + custo informado</h2>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">A margem é uma estimativa operacional. Nesta versão, considera o custo base cadastrado e não inclui custo separado de adicionais, embalagem, taxas ou impostos.</p>
              </div>
              <div className="flex rounded-xl border border-border bg-background p-1">
                <Button type="button" size="sm" variant={intelligencePeriod === 30 ? "default" : "ghost"} onClick={() => setIntelligencePeriod(30)}>30 dias</Button>
                <Button type="button" size="sm" variant={intelligencePeriod === 90 ? "default" : "ghost"} onClick={() => setIntelligencePeriod(90)}>90 dias</Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <FinanceMetric label="Receita dos produtos" value={formatPriceBRL(intelligence.summary.revenue)} hint={`${intelligence.summary.orders} pedido(s) válido(s) no período`} />
              <FinanceMetric label="Margem estimada" value={formatPriceBRL(intelligence.summary.estimated_margin)} hint={intelligence.summary.estimated_margin_percent === null ? "Cadastre custos para calcular" : `${intelligence.summary.estimated_margin_percent.toFixed(1).replace(".", ",")}% sobre a receita com custo`} />
              <FinanceMetric label="Cobertura de custos" value={`${intelligence.summary.cost_coverage_percent.toFixed(0)}%`} hint={`${intelligence.summary.configured_cost_products}/${intelligence.summary.products} produto(s) com custo`} />
              <FinanceMetric label="Sem custo" value={String(intelligence.summary.products_without_cost)} hint={`${intelligence.summary.sold_products_without_cost} deles tiveram venda no período`} />
            </div>

            {intelligence.summary.sold_products_without_cost > 0 ? (
              <div className="flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning-soft/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <CircleDollarSign className="mt-0.5 size-5 shrink-0 text-warning" />
                  <div><p className="text-sm font-bold">A margem ainda está incompleta</p><p className="mt-0.5 text-xs text-muted-foreground">{intelligence.summary.sold_products_without_cost} produto(s) vendido(s) no período ainda não têm custo informado.</p></div>
                </div>
                <Button asChild variant="outline" size="sm" className="bg-background"><Link to="/app/loja/cardapio/produtos">Cadastrar custos <ArrowRight className="ml-1 size-3.5" /></Link></Button>
              </div>
            ) : null}

            {topProducts.length > 0 ? (
              <div>
                <div className="mb-2 flex items-center justify-between gap-3"><h3 className="text-sm font-black">Produtos por receita</h3><span className="text-xs text-muted-foreground">Top {topProducts.length}</span></div>
                <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
                  {topProducts.map((item) => (
                    <Link key={item.id} to="/app/loja/cardapio/produtos/$id" params={{ id: item.id }} className="grid gap-2 p-3 transition hover:bg-muted/30 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                      <div className="min-w-0"><p className="truncate text-sm font-bold">{item.name}</p><p className="truncate text-xs text-muted-foreground">{item.category_name ?? "Sem categoria"} · {item.orders} pedido(s)</p></div>
                      <div className="text-left sm:text-right"><p className="text-xs text-muted-foreground">Receita</p><p className="text-sm font-bold tabular-nums">{formatPriceBRL(item.revenue)}</p></div>
                      <div className="text-left sm:min-w-28 sm:text-right"><p className="text-xs text-muted-foreground">Margem est.</p><p className={`text-sm font-bold tabular-nums ${item.estimated_margin !== null && item.estimated_margin < 0 ? "text-destructive" : ""}`}>{item.estimated_margin === null ? "Sem custo" : formatPriceBRL(item.estimated_margin)}</p></div>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-3">
          <Card><CardHeader><CardTitle>Produtos</CardTitle><CardDescription>Preço, custo, imagem, disponibilidade, variações e adicionais.</CardDescription></CardHeader><CardContent><Button asChild><Link to="/app/loja/cardapio/produtos">Gerenciar produtos <ArrowRight className="ml-1 size-4" /></Link></Button></CardContent></Card>
          <Card><CardHeader><CardTitle>Categorias</CardTitle><CardDescription>Organize a ordem e as seções que o cliente encontra.</CardDescription></CardHeader><CardContent><Button asChild variant="outline"><Link to="/app/loja/cardapio/categorias">Gerenciar categorias <ArrowRight className="ml-1 size-4" /></Link></Button></CardContent></Card>
          <Card><CardHeader><CardTitle>Opções e adicionais</CardTitle><CardDescription>Sabores, tamanhos, molhos, complementos e escolhas obrigatórias.</CardDescription></CardHeader><CardContent><Button asChild variant="outline"><Link to="/app/loja/cardapio/opcoes">Abrir opções</Link></Button></CardContent></Card>
        </section>

        {counts.products_archived > 0 ? <p className="text-xs text-muted-foreground">{counts.products_archived} produto(s) arquivado(s). Eles ficam fora do cardápio e podem ser restaurados na lista.</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Monte seu primeiro cardápio" description="Escolha um modelo pronto ou comece manualmente. Você poderá editar tudo depois." />

      <section className="grid gap-3 lg:grid-cols-2">
        <Card className="border-brand/25 bg-brand-soft/35"><CardHeader><div className="mb-1 grid size-10 place-items-center rounded-xl bg-brand text-brand-foreground"><LayoutTemplate className="size-5" /></div><CardTitle className="text-lg">Começar com um modelo</CardTitle><CardDescription>Crie uma estrutura inicial adequada ao seu tipo de negócio.</CardDescription></CardHeader><CardContent><Button asChild className="w-full"><a href="#modelos">Ver modelos</a></Button></CardContent></Card>
        <Card><CardHeader><div className="mb-1 grid size-10 place-items-center rounded-xl bg-muted text-foreground"><PencilLine className="size-5" /></div><CardTitle className="text-lg">Montar manualmente</CardTitle><CardDescription>Crie a primeira categoria e vá adicionando seus produtos.</CardDescription></CardHeader><CardContent><Button asChild variant="outline" className="w-full"><Link to="/app/loja/cardapio/categorias">Criar primeira categoria</Link></Button></CardContent></Card>
      </section>

      <section id="modelos" className="space-y-3 scroll-mt-24">
        <div><div className="flex items-center gap-2 text-brand"><Sparkles className="size-4" /><span className="text-xs font-extrabold uppercase tracking-[.14em]">Modelos prontos</span></div><h2 className="mt-1 text-xl font-bold">Escolha o mais parecido com sua operação</h2></div>
        {!can.create ? <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">Seu perfil pode visualizar o cardápio, mas não pode aplicar modelos.</div> : null}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {MENU_MODELS.map((model) => {
            const loading = pendingKey === `starter:${model.code}` && isBusy;
            const otherInvalid = model.code === "outros" && otherBusinessType.trim().length < 2;
            return (
              <Card key={model.code} className={model.code === "outros" ? "border-dashed border-brand/30" : undefined}>
                <CardHeader className="pb-3"><CardTitle className="text-base">{model.name}</CardTitle><CardDescription>{model.description}</CardDescription></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2 rounded-lg bg-muted/50 p-3 text-xs leading-5 text-muted-foreground"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand" /><span>{model.creates}</span></div>
                  {model.code === "outros" ? <div className="space-y-1.5"><Label htmlFor="other-business-type">Qual é o seu tipo de negócio?</Label><Input id="other-business-type" value={otherBusinessType} onChange={(event) => setOtherBusinessType(event.target.value)} maxLength={80} placeholder="Ex.: loja de bolos, empório, rotisserie…" /></div> : null}
                  <Button type="button" variant="ghost" className="h-auto px-0 text-brand hover:bg-transparent hover:text-brand" disabled={!can.create || isBusy || !storeId || otherInvalid} onClick={() => void applyModel(model)}>
                    {loading ? <><Loader2 className="mr-1 size-4 animate-spin" /> Criando…</> : <>Usar como base <ArrowRight className="ml-1 size-4" /></>}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
