import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, CircleDollarSign, Loader2, Pause, Play, Plus, Search, Tag, Trash2 } from "lucide-react";

import { listProducts } from "@/catalog/api";
import { useCatalog } from "@/catalog/CatalogProvider";
import {
  archiveCatalogPromotion,
  createCatalogPromotion,
  listCatalogPromotions,
  setCatalogPromotionActive,
  simulateCatalogPromotion,
  type CatalogPromotionKind,
  type CatalogPromotionSimulation,
} from "@/catalog/promotions";
import { formatPriceBRL } from "@/catalog/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/catalog/PageHeader";

export const Route = createFileRoute("/app/loja/cardapio/promocoes")({ component: PromotionsPage });

type Scope = "store" | "category" | "product";

const numberOrNull = (value: string) => {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
};

const dateOrNull = (value: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

function PromotionsPage() {
  const { storeId, categories, overview, run, isBusy } = useCatalog();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<CatalogPromotionKind>("percentual");
  const [value, setValue] = useState("10");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [scope, setScope] = useState<Scope>("store");
  const [categoryId, setCategoryId] = useState("");
  const [productId, setProductId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [createActive, setCreateActive] = useState(true);
  const [simulation, setSimulation] = useState<CatalogPromotionSimulation | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);

  const canUpdate = Boolean(overview?.can.update && storeId);
  const promotionsQuery = useQuery({
    queryKey: ["catalog", "promotions", storeId],
    queryFn: () => listCatalogPromotions(storeId!),
    enabled: canUpdate,
    retry: false,
  });
  const productsQuery = useQuery({
    queryKey: ["catalog", "promotion-products", storeId, productSearch],
    queryFn: () => listProducts({
      storeId,
      search: productSearch.trim(),
      categoryId: null,
      status: "todos",
      limit: 50,
      offset: 0,
    }),
    enabled: canUpdate && scope === "product",
    retry: false,
  });

  const promotions = promotionsQuery.data ?? [];
  const activeCount = promotions.filter((promotion) => promotion.runtime_active).length;
  const scheduledCount = promotions.filter(
    (promotion) => promotion.is_active && !promotion.runtime_active && promotion.starts_at && new Date(promotion.starts_at).getTime() > Date.now(),
  ).length;
  const products = productsQuery.data?.items ?? [];
  const cleanCategories = useMemo(() => categories.filter((category) => !category.is_archived), [categories]);

  const parsedValue = numberOrNull(value);
  const parsedCap = numberOrNull(maxDiscount);
  const targetProductId = scope === "product" ? productId || null : null;
  const targetCategoryId = scope === "category" ? categoryId || null : null;
  const formValid = Boolean(
    storeId &&
      name.trim().length >= 2 &&
      parsedValue !== null &&
      parsedValue > 0 &&
      (kind !== "percentual" || parsedValue <= 100) &&
      (maxDiscount.trim() === "" || (parsedCap !== null && parsedCap > 0)) &&
      (scope !== "product" || targetProductId) &&
      (scope !== "category" || targetCategoryId) &&
      (!startsAt || !endsAt || new Date(endsAt).getTime() > new Date(startsAt).getTime()),
  );
  const simulationHasKnownLoss = Boolean(simulation && simulation.negative_margin_products > 0);
  const canCreateActive = !createActive || !simulationHasKnownLoss;

  const resetSimulation = () => {
    setSimulation(null);
    setSimulationError(null);
  };

  async function simulate() {
    if (!storeId || !formValid || parsedValue === null) return;
    setSimulating(true);
    setSimulationError(null);
    try {
      const result = await simulateCatalogPromotion({
        storeId,
        kind,
        value: parsedValue,
        maxDiscountAmount: parsedCap,
        productId: targetProductId,
        categoryId: targetCategoryId,
      });
      setSimulation(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível simular.";
      setSimulation(null);
      setSimulationError(
        message.includes("FORBIDDEN") || message.includes("reports.view_operational")
          ? "Seu perfil pode gerenciar o catálogo, mas não tem acesso ao relatório financeiro necessário para simular margem."
          : "Não foi possível simular o impacto agora. Revise os dados e tente novamente.",
      );
    } finally {
      setSimulating(false);
    }
  }

  async function createPromotion() {
    if (!storeId || !formValid || parsedValue === null || !canCreateActive) return;
    const result = await run(
      () =>
        createCatalogPromotion({
          storeId,
          name: name.trim(),
          description: description.trim(),
          kind,
          value: parsedValue,
          maxDiscountAmount: parsedCap,
          productId: targetProductId,
          categoryId: targetCategoryId,
          startsAt: dateOrNull(startsAt),
          endsAt: dateOrNull(endsAt),
          isActive: createActive,
        }),
      createActive ? "Promoção criada e habilitada." : "Promoção criada pausada.",
    );
    if (!result) return;
    setName("");
    setDescription("");
    setValue("10");
    setMaxDiscount("");
    setScope("store");
    setCategoryId("");
    setProductId("");
    setStartsAt("");
    setEndsAt("");
    setCreateActive(true);
    resetSimulation();
    await promotionsQuery.refetch();
  }

  if (!canUpdate) {
    return (
      <Alert>
        <AlertTriangle className="size-4" />
        <AlertTitle>Promoções restritas</AlertTitle>
        <AlertDescription>Seu perfil não possui permissão para alterar o catálogo desta loja.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Promoções"
        description="Crie descontos programados sem aceitar preço do navegador. O valor final é recalculado e congelado no pedido pelo servidor."
      />

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumo das promoções">
        <Card><CardHeader className="pb-2"><CardDescription>Ativas agora</CardDescription><CardTitle className="text-3xl tabular-nums">{activeCount}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Programadas</CardDescription><CardTitle className="text-3xl tabular-nums">{scheduledCount}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Total configurado</CardDescription><CardTitle className="text-3xl tabular-nums">{promotions.length}</CardTitle></CardHeader></Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plus className="size-5 text-brand" /> Nova promoção</CardTitle>
          <CardDescription>O melhor desconto aplicável vence; promoções não são acumuladas automaticamente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="promotion-name">Nome interno</Label>
              <Input id="promotion-name" value={name} maxLength={100} placeholder="Ex.: Semana do hambúrguer" onChange={(event) => { setName(event.target.value); resetSimulation(); }} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="promotion-scope">Onde aplicar</Label>
              <Select value={scope} onValueChange={(next) => { setScope(next as Scope); setCategoryId(""); setProductId(""); resetSimulation(); }}>
                <SelectTrigger id="promotion-scope"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="store">Loja inteira</SelectItem>
                  <SelectItem value="category">Uma categoria</SelectItem>
                  <SelectItem value="product">Um produto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {scope === "category" ? (
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={categoryId} onValueChange={(next) => { setCategoryId(next); resetSimulation(); }}>
                <SelectTrigger><SelectValue placeholder="Escolha a categoria" /></SelectTrigger>
                <SelectContent>{cleanCategories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          ) : null}

          {scope === "product" ? (
            <div className="space-y-3 rounded-xl border border-border p-3">
              <Label htmlFor="promotion-product-search">Produto</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="promotion-product-search" className="pl-9" value={productSearch} placeholder="Buscar produto" onChange={(event) => setProductSearch(event.target.value)} />
              </div>
              <Select value={productId} onValueChange={(next) => { setProductId(next); resetSimulation(); }}>
                <SelectTrigger><SelectValue placeholder={productsQuery.isLoading ? "Carregando…" : "Escolha o produto"} /></SelectTrigger>
                <SelectContent>{products.map((product) => <SelectItem key={product.id} value={product.id}>{product.name} · {formatPriceBRL(product.base_price)}</SelectItem>)}</SelectContent>
              </Select>
              {productsQuery.data?.has_more ? <p className="text-xs text-muted-foreground">Há mais produtos. Use a busca para localizar o item desejado.</p> : null}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={kind} onValueChange={(next) => { setKind(next as CatalogPromotionKind); resetSimulation(); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="percentual">Percentual (%)</SelectItem><SelectItem value="valor_fixo">Valor fixo (R$)</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="promotion-value">{kind === "percentual" ? "Desconto (%)" : "Desconto (R$)"}</Label>
              <Input id="promotion-value" inputMode="decimal" value={value} onChange={(event) => { setValue(event.target.value); resetSimulation(); }} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="promotion-cap">Teto por item (R$)</Label>
              <Input id="promotion-cap" inputMode="decimal" value={maxDiscount} placeholder="Opcional" onChange={(event) => { setMaxDiscount(event.target.value); resetSimulation(); }} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="promotion-start">Início</Label><Input id="promotion-start" type="datetime-local" value={startsAt} onChange={(event) => { setStartsAt(event.target.value); resetSimulation(); }} /><p className="text-xs text-muted-foreground">O horário é interpretado pelo fuso do dispositivo e convertido para o servidor.</p></div>
            <div className="space-y-2"><Label htmlFor="promotion-end">Fim</Label><Input id="promotion-end" type="datetime-local" value={endsAt} onChange={(event) => { setEndsAt(event.target.value); resetSimulation(); }} /><p className="text-xs text-muted-foreground">Deixe vazio para não definir limite.</p></div>
          </div>

          <div className="space-y-2"><Label htmlFor="promotion-description">Descrição interna</Label><Textarea id="promotion-description" value={description} maxLength={500} placeholder="Objetivo ou observação da campanha" onChange={(event) => setDescription(event.target.value)} /></div>

          <div className="flex min-h-12 items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
            <div><p className="text-sm font-bold">Criar habilitada</p><p className="text-xs text-muted-foreground">Se houver perda conhecida na simulação, a ativação fica bloqueada até criar a promoção pausada.</p></div>
            <Switch checked={createActive} onCheckedChange={setCreateActive} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={!formValid || simulating || isBusy} onClick={() => void simulate()}>
              {simulating ? <Loader2 className="size-4 animate-spin" /> : <CircleDollarSign className="size-4" />} Simular margem
            </Button>
            <Button type="button" disabled={!formValid || isBusy || !canCreateActive} onClick={() => void createPromotion()}>
              <Tag className="size-4" /> Criar promoção
            </Button>
          </div>

          {simulationError ? <Alert><AlertTriangle className="size-4" /><AlertTitle>Simulação indisponível</AlertTitle><AlertDescription>{simulationError}</AlertDescription></Alert> : null}

          {simulation ? (
            <div className="space-y-3 rounded-2xl border border-border bg-muted/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><p className="font-black">Impacto estimado</p><p className="text-xs text-muted-foreground">Baseado apenas no custo base já cadastrado. Variações e adicionais podem ter custo diferente.</p></div>
                <Badge variant={simulation.negative_margin_products > 0 ? "destructive" : "outline"}>{simulation.products} produto(s)</Badge>
              </div>
              <div className="grid gap-2 sm:grid-cols-4">
                <div className="rounded-xl bg-background p-3"><p className="text-xs text-muted-foreground">Com custo</p><p className="text-lg font-black">{simulation.products_with_cost}</p></div>
                <div className="rounded-xl bg-background p-3"><p className="text-xs text-muted-foreground">Margem média</p><p className="text-lg font-black">{simulation.average_margin_percent === null ? "—" : `${simulation.average_margin_percent.toFixed(1).replace(".", ",")}%`}</p></div>
                <div className="rounded-xl bg-background p-3"><p className="text-xs text-muted-foreground">Margem &lt; 20%</p><p className="text-lg font-black">{simulation.low_margin_products}</p></div>
                <div className="rounded-xl bg-background p-3"><p className="text-xs text-muted-foreground">Margem negativa</p><p className={`text-lg font-black ${simulation.negative_margin_products > 0 ? "text-destructive" : ""}`}>{simulation.negative_margin_products}</p></div>
              </div>
              {simulationHasKnownLoss ? <Alert variant="destructive"><AlertTriangle className="size-4" /><AlertTitle>Promoção gera perda conhecida</AlertTitle><AlertDescription>Há {simulation.negative_margin_products} produto(s) com preço promocional abaixo do custo cadastrado. Para evitar ativação acidental, crie a promoção pausada e revise esses itens.</AlertDescription></Alert> : null}
              {simulation.items.length > 0 ? (
                <div className="max-h-64 overflow-auto rounded-xl border border-border bg-background">
                  {simulation.items.slice(0, 30).map((item) => <div key={item.id} className="grid gap-1 border-b border-border p-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto_auto]"><div><p className="truncate text-sm font-bold">{item.name}</p><p className="text-xs text-muted-foreground">{item.has_variants ? "Possui variações; simulação usa preço base." : "Produto simples"}</p></div><div className="text-sm sm:text-right"><span className="text-muted-foreground line-through">{formatPriceBRL(item.base_price)}</span><span className="ml-2 font-bold text-brand">{formatPriceBRL(item.promotional_price)}</span></div><div className={`text-sm font-bold sm:min-w-20 sm:text-right ${item.margin_percent !== null && item.margin_percent < 0 ? "text-destructive" : ""}`}>{item.margin_percent === null ? "sem custo" : `${item.margin_percent.toFixed(1).replace(".", ",")}%`}</div></div>)}
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <section className="space-y-3" aria-label="Promoções configuradas">
        <div><h2 className="text-lg font-black">Promoções configuradas</h2><p className="text-sm text-muted-foreground">Pausar é reversível. Arquivar remove a promoção das operações futuras, mas preserva referências históricas dos pedidos.</p></div>
        {promotionsQuery.isLoading ? <Card><CardContent className="flex items-center gap-2 p-5 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando promoções…</CardContent></Card> : promotions.length === 0 ? <Card><CardContent className="p-6 text-center"><Tag className="mx-auto size-7 text-muted-foreground" /><p className="mt-2 font-bold">Nenhuma promoção criada</p><p className="mt-1 text-sm text-muted-foreground">Use o formulário acima para planejar a primeira campanha.</p></CardContent></Card> : promotions.map((promotion) => {
          const scopeLabel = promotion.product_name ? `Produto: ${promotion.product_name}` : promotion.category_name ? `Categoria: ${promotion.category_name}` : "Loja inteira";
          const discountLabel = promotion.kind === "percentual" ? `${Number(promotion.value)}%` : formatPriceBRL(Number(promotion.value));
          const scheduled = promotion.is_active && !promotion.runtime_active && promotion.starts_at && new Date(promotion.starts_at).getTime() > Date.now();
          return <Card key={promotion.id}><CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-black">{promotion.name}</p><Badge variant={promotion.runtime_active ? "success" : scheduled ? "outline" : "secondary"}>{promotion.runtime_active ? "Ativa" : scheduled ? "Programada" : promotion.is_active ? "Fora da janela" : "Pausada"}</Badge><Badge variant="outline">-{discountLabel}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{scopeLabel}{promotion.max_discount_amount ? ` · teto ${formatPriceBRL(Number(promotion.max_discount_amount))}` : ""}</p>{promotion.starts_at || promotion.ends_at ? <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><CalendarClock className="size-3.5" /> {promotion.starts_at ? new Date(promotion.starts_at).toLocaleString("pt-BR") : "agora"} → {promotion.ends_at ? new Date(promotion.ends_at).toLocaleString("pt-BR") : "sem fim"}</p> : null}</div><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" disabled={isBusy} onClick={() => storeId && void run(() => setCatalogPromotionActive(storeId, promotion.id, !promotion.is_active, promotion.updated_at), promotion.is_active ? "Promoção pausada." : "Promoção habilitada.").then(() => promotionsQuery.refetch())}>{promotion.is_active ? <Pause className="size-4" /> : <Play className="size-4" />}{promotion.is_active ? "Pausar" : "Habilitar"}</Button><Button type="button" variant="ghost" size="sm" disabled={isBusy} onClick={() => { if (!storeId) return; if (!window.confirm(`Arquivar a promoção “${promotion.name}”? Ela deixará de poder ser ativada novamente.`)) return; void run(() => archiveCatalogPromotion(storeId, promotion.id, promotion.updated_at), "Promoção arquivada.").then(() => promotionsQuery.refetch()); }}><Trash2 className="size-4" /> Arquivar</Button></div></CardContent></Card>;
        })}
      </section>
    </div>
  );
}
