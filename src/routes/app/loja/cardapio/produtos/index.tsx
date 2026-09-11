import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, ExternalLink, ListChecks, MoreHorizontal, PackageSearch, Plus, Search, X } from "lucide-react";

import {
  archiveProduct,
  bulkUpdateProducts,
  listProducts,
  setProductActive,
  setProductFeatured,
  setProductSoldOut,
} from "@/catalog/api";
import { CatalogImage } from "@/catalog/CatalogImage";
import { useCatalog } from "@/catalog/CatalogProvider";
import {
  CATALOG_PAGE_SIZE,
  PRODUCT_STATUS_FILTERS,
  formatPriceBRL,
  type CatalogBulkAction,
  type ProductStatusFilter,
} from "@/catalog/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/catalog/PageHeader";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { ListSkeleton } from "@/components/feedback/Skeletons";
import { useStoreScope } from "@/store-scope/StoreScopeProvider";

export const Route = createFileRoute("/app/loja/cardapio/produtos/")({ component: ProdutosPage });

const BULK_LABELS: Record<CatalogBulkAction, string> = {
  set_sold_out: "disponibilidade",
  set_active: "visibilidade",
  set_featured: "destaque",
  move_category: "categoria",
};

function ProdutosPage() {
  const { storeId, categories, activeCategories, overview, run, isBusy } = useCatalog();
  const scope = useStoreScope();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [categoryId, setCategoryId] = useState<string>("todas");
  const [status, setStatus] = useState<ProductStatusFilter>("todos");
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkCategoryId, setBulkCategoryId] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => queueMicrotask(() => setPage(0)), [debounced, categoryId, status]);
  useEffect(() => {
    queueMicrotask(() => {
      setSelectedIds([]);
      setBulkCategoryId("");
    });
  }, [debounced, categoryId, status, page, storeId]);

  const can = overview?.can ?? { view: true, create: false, update: false, archive: false };
  const query = useQuery({
    queryKey: ["catalog", "products", storeId, debounced, categoryId, status, page],
    queryFn: () => listProducts({
      storeId,
      search: debounced,
      categoryId: categoryId === "todas" ? null : categoryId,
      status,
      limit: CATALOG_PAGE_SIZE,
      offset: page * CATALOG_PAGE_SIZE,
    }),
    enabled: Boolean(storeId),
    retry: false,
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const canCreate = can.create && activeCategories.some((c) => c.is_active);
  const categoryOptions = useMemo(() => categories.filter((c) => !c.is_archived), [categories]);
  const moveCategoryOptions = useMemo(() => categories.filter((c) => !c.is_archived && c.is_active), [categories]);
  const selectableItems = useMemo(() => items.filter((product) => !product.is_archived), [items]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allPageSelected = selectableItems.length > 0 && selectableItems.every((product) => selectedSet.has(product.id));
  const hasFilters = Boolean(search.trim()) || categoryId !== "todas" || status !== "todos";
  const counts = overview?.counts;
  const publicMenuHref = scope.selectedStore?.slug ? `/loja/${scope.selectedStore.slug}` : null;

  const refreshAfter = async (promise: Promise<unknown>) => {
    await promise;
    await query.refetch();
  };

  const clearFilters = () => {
    setSearch("");
    setDebounced("");
    setCategoryId("todas");
    setStatus("todos");
    setPage(0);
  };

  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds((current) => checked ? Array.from(new Set([...current, id])) : current.filter((item) => item !== id));
  };

  const togglePage = (checked: boolean) => {
    setSelectedIds(checked ? selectableItems.map((product) => product.id) : []);
  };

  async function applyBulk(action: CatalogBulkAction, value?: boolean | null, targetCategoryId?: string | null) {
    if (!storeId || selectedIds.length === 0 || isBusy) return;
    const result = await run(
      () => bulkUpdateProducts({ storeId, productIds: selectedIds, action, value, categoryId: targetCategoryId }),
      `${selectedIds.length} produto(s) atualizado(s): ${BULK_LABELS[action]}.`,
    );
    if (result) {
      setSelectedIds([]);
      setBulkCategoryId("");
      await query.refetch();
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Produtos"
        description="Preço, disponibilidade, estoque e destaque em um só lugar. Selecione vários itens para operações repetitivas."
        action={
          <>
            {publicMenuHref ? (
              <Button asChild variant="outline">
                <a href={publicMenuHref} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /> Ver cardápio</a>
              </Button>
            ) : null}
            {canCreate ? (
              <Button asChild><Link to="/app/loja/cardapio/produtos/novo"><Plus className="size-4" /> Novo produto</Link></Button>
            ) : can.create ? (
              <span className="self-center text-xs text-muted-foreground">Crie uma categoria ativa para cadastrar produtos.</span>
            ) : null}
          </>
        }
      />

      {counts ? (
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Resumo dos produtos">
          <CatalogMetric label="Ativos" value={counts.products_active} tone="success" onClick={() => setStatus("ativos")} active={status === "ativos"} />
          <CatalogMetric label="Esgotados" value={counts.products_sold_out} tone="danger" onClick={() => setStatus("esgotados")} active={status === "esgotados"} />
          <CatalogMetric label="Destaques" value={counts.products_featured} tone="brand" onClick={() => setStatus("destaques")} active={status === "destaques"} />
          <CatalogMetric label="Arquivados" value={counts.products_archived} tone="muted" onClick={() => setStatus("arquivados")} active={status === "arquivados"} />
        </section>
      ) : null}

      <section className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4" aria-label="Filtros de produtos">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="busca">Buscar</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input id="busca" value={search} placeholder="Nome do produto ou categoria" className="pl-10 pr-10" onChange={(e) => setSearch(e.target.value)} />
              {search ? <button type="button" aria-label="Limpar busca" onClick={() => setSearch("")} className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"><X className="size-4" /></button> : null}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filtro-categoria">Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="filtro-categoria"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="todas">Todas</SelectItem>{categoryOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filtro-status">Situação</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ProductStatusFilter)}>
              <SelectTrigger id="filtro-status"><SelectValue /></SelectTrigger>
              <SelectContent>{PRODUCT_STATUS_FILTERS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-3 flex min-h-8 flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">{query.isLoading ? "Carregando produtos…" : `${total} ${total === 1 ? "produto encontrado" : "produtos encontrados"}`}</p>
          {hasFilters ? <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>Limpar filtros</Button> : null}
        </div>
      </section>

      {can.update && selectableItems.length > 0 ? (
        <section className={`rounded-2xl border p-3 transition ${selectedIds.length > 0 ? "border-brand/30 bg-brand-soft/25" : "border-border bg-card"}`} aria-label="Ações em lote">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-2 text-sm font-semibold">
              <Checkbox
                checked={allPageSelected ? true : selectedIds.length > 0 ? "indeterminate" : false}
                onCheckedChange={(checked) => togglePage(Boolean(checked))}
                aria-label="Selecionar produtos desta página"
              />
              {allPageSelected ? "Página selecionada" : "Selecionar página"}
            </label>

            {selectedIds.length > 0 ? (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-background px-3 py-1.5 text-xs font-bold shadow-sm"><ListChecks className="size-3.5 text-brand" /> {selectedIds.length} selecionado(s)</span>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="outline" disabled={isBusy}>Alterar selecionados</Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => void applyBulk("set_sold_out", false)}>Marcar como disponíveis</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void applyBulk("set_sold_out", true)}>Marcar como esgotados</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => void applyBulk("set_active", true)}>Exibir no cardápio</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void applyBulk("set_active", false)}>Ocultar do cardápio</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => void applyBulk("set_featured", true)}>Adicionar aos destaques</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void applyBulk("set_featured", false)}>Remover dos destaques</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {moveCategoryOptions.length > 0 ? (
                  <div className="flex min-w-[260px] flex-1 flex-wrap items-center gap-2 sm:flex-none">
                    <Select value={bulkCategoryId} onValueChange={setBulkCategoryId}>
                      <SelectTrigger className="min-w-[190px] flex-1 sm:w-[220px]"><SelectValue placeholder="Mover para categoria…" /></SelectTrigger>
                      <SelectContent>{moveCategoryOptions.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button variant="outline" disabled={!bulkCategoryId || isBusy} onClick={() => void applyBulk("move_category", null, bulkCategoryId)}>Mover</Button>
                  </div>
                ) : null}

                <Button variant="ghost" disabled={isBusy} onClick={() => { setSelectedIds([]); setBulkCategoryId(""); }}>Limpar seleção</Button>
              </>
            ) : <p className="text-xs text-muted-foreground">A seleção vale apenas para a página atual e é limpa ao trocar filtros ou página.</p>}
          </div>
        </section>
      ) : null}

      {query.isLoading ? <ListSkeleton rows={4} /> : query.isError ? (
        <ErrorState title="Não foi possível carregar os produtos" description="A conexão com o servidor falhou. Tente novamente." onRetry={() => void query.refetch()} retrying={query.isFetching} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title={hasFilters ? "Nenhum produto com esses filtros" : "Seu cardápio ainda não tem produtos"}
          description={hasFilters ? "Tente limpar os filtros ou buscar por outro nome." : "Cadastre o primeiro produto para começar a vender."}
          action={hasFilters ? <Button variant="outline" onClick={clearFilters}>Limpar filtros</Button> : canCreate ? <Button asChild><Link to="/app/loja/cardapio/produtos/novo">Criar primeiro produto</Link></Button> : null}
        />
      ) : (
        <ul className="space-y-3">
          {items.map((product) => {
            const available = product.is_active && !product.is_sold_out && !product.is_archived;
            const scheduleConfigured = Boolean(product.available_weekdays || product.available_from || product.available_to);
            const stockControlled = product.stock_quantity !== null && product.stock_quantity !== undefined;
            const lowStock = stockControlled && Number(product.stock_quantity) > 0 && Number(product.stock_quantity) <= Number(product.low_stock_threshold ?? 5);
            const outOfStock = stockControlled && Number(product.stock_quantity) <= 0;
            const selected = selectedSet.has(product.id);
            return (
              <li key={product.id}>
                <Card className={`overflow-hidden transition-shadow hover:shadow-md ${selected ? "border-brand/35 ring-2 ring-brand/10" : ""}`}>
                  <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                    {can.update && !product.is_archived ? (
                      <div className="flex min-h-11 min-w-11 items-center justify-center self-start sm:self-center">
                        <Checkbox checked={selected} onCheckedChange={(checked) => toggleSelected(product.id, Boolean(checked))} aria-label={`Selecionar ${product.name}`} />
                      </div>
                    ) : null}
                    <CatalogImage path={product.image_path} alt={product.name} className="h-24 w-full shrink-0 rounded-xl object-cover sm:h-16 sm:w-16" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="min-w-0 truncate font-bold text-foreground">{product.name}</span>
                        {product.is_archived ? <Badge variant="outline">Arquivado</Badge> : !product.is_active ? <Badge variant="secondary">Oculto</Badge> : product.is_sold_out ? <Badge variant="destructive">Esgotado</Badge> : outOfStock ? <Badge variant="destructive">Sem estoque</Badge> : product.runtime_available === false ? <Badge variant="secondary"><CalendarClock className="mr-1 size-3" />Fora do horário</Badge> : <Badge variant="success">Disponível</Badge>}
                        {product.is_featured ? <Badge variant="brand">Destaque</Badge> : null}
                        {scheduleConfigured ? <Badge variant="outline"><CalendarClock className="mr-1 size-3" />Programado</Badge> : null}
                        {lowStock ? <Badge variant="secondary">Estoque baixo: {product.stock_quantity}</Badge> : null}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{product.category_name ?? "Sem categoria"} · <span className="font-bold text-foreground">{formatPriceBRL(product.base_price)}</span>{product.max_quantity ? ` · máx. ${product.max_quantity} por pedido` : ""}</p>
                      {product.description ? <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{product.description}</p> : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      {can.update && !product.is_archived ? (
                        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold">
                          <Switch checked={available} disabled={isBusy || !product.is_active} aria-label={`${product.name} disponível para venda`} onCheckedChange={(checked) => {
                            if (!storeId) return;
                            void refreshAfter(run(() => setProductSoldOut(storeId, product.id, !checked, product.updated_at), checked ? "Produto disponível novamente." : "Produto marcado como esgotado."));
                          }} />
                          Disponível
                        </label>
                      ) : null}

                      {can.update && !product.is_archived ? <Button asChild variant="outline" size="sm" className="min-h-11"><Link to="/app/loja/cardapio/produtos/$id" params={{ id: product.id }}>Editar</Link></Button> : null}

                      {(can.update || can.archive) ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label={`Mais ações para ${product.name}`}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {can.update && !product.is_archived ? (
                              <>
                                <DropdownMenuItem onClick={() => storeId && void refreshAfter(run(() => setProductActive(storeId, product.id, !product.is_active, product.updated_at), product.is_active ? "Produto ocultado do cardápio." : "Produto exibido no cardápio."))}>{product.is_active ? "Ocultar do cardápio" : "Exibir no cardápio"}</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => storeId && void refreshAfter(run(() => setProductFeatured(storeId, product.id, !product.is_featured, product.updated_at), product.is_featured ? "Destaque removido." : "Produto em destaque."))}>{product.is_featured ? "Remover destaque" : "Destacar produto"}</DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            ) : null}
                            {can.archive ? <DropdownMenuItem onClick={() => storeId && void refreshAfter(run(() => archiveProduct(storeId, product.id, !product.is_archived, product.updated_at), product.is_archived ? "Produto restaurado." : "Produto arquivado."))}>{product.is_archived ? "Restaurar" : "Arquivar"}</DropdownMenuItem> : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {total > CATALOG_PAGE_SIZE ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-2">
          <Button variant="outline" size="sm" disabled={page === 0 || query.isFetching} onClick={() => setPage((p) => Math.max(0, p - 1))}>Anterior</Button>
          <span className="text-xs text-muted-foreground">Página {page + 1} de {Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE))}</span>
          <Button variant="outline" size="sm" disabled={!query.data?.has_more || query.isFetching} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
        </div>
      ) : null}
    </div>
  );
}

function CatalogMetric({ label, value, tone, active, onClick }: { label: string; value: number; tone: "success" | "danger" | "brand" | "muted"; active: boolean; onClick: () => void }) {
  const toneClass = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : tone === "brand" ? "text-brand" : "text-muted-foreground";
  return <button type="button" onClick={onClick} aria-pressed={active} className={`rounded-2xl border bg-card p-3 text-left shadow-sm transition hover:border-brand/25 hover:shadow-md ${active ? "border-brand/35 ring-2 ring-brand/10" : "border-border"}`}><p className="text-[11px] font-black uppercase tracking-[.1em] text-muted-foreground">{label}</p><p className={`mt-1 font-display text-2xl font-black tabular-nums ${toneClass}`}>{value}</p></button>;
}
