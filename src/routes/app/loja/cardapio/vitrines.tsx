import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LayoutGrid, Search, Tags } from "lucide-react";

import { listProducts } from "@/catalog/api";
import {
  listCatalogProductCategoryPlacements,
  setCatalogProductCategoryPlacements,
} from "@/catalog/category-placements";
import { useCatalog } from "@/catalog/CatalogProvider";
import { formatPriceBRL, type CatalogProduct } from "@/catalog/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const MAX_ADDITIONAL_CATEGORIES = 8;

export const Route = createFileRoute("/app/loja/cardapio/vitrines")({
  component: CatalogVitrinesPage,
});

function CatalogVitrinesPage() {
  const { storeId, categories, overview, run, isBusy } = useCatalog();
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftCategoryIds, setDraftCategoryIds] = useState<string[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(term.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [term]);

  const productsQuery = useQuery({
    queryKey: ["catalog", "vitrines-products", storeId, search],
    queryFn: () => listProducts({
      storeId,
      search,
      categoryId: null,
      status: "todos",
      limit: 50,
      offset: 0,
    }),
    enabled: Boolean(storeId),
    retry: false,
  });

  const placementsQuery = useQuery({
    queryKey: ["catalog", "placements", storeId],
    queryFn: () => listCatalogProductCategoryPlacements(storeId!),
    enabled: Boolean(storeId),
    retry: false,
  });

  const activeCategories = useMemo(
    () => categories.filter((category) => category.is_active && !category.is_archived),
    [categories],
  );

  const placementByProduct = useMemo(
    () => new Map((placementsQuery.data ?? []).map((placement) => [placement.product_id, placement] as const)),
    [placementsQuery.data],
  );

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category] as const)),
    [categories],
  );

  const products = productsQuery.data?.items ?? [];
  const canUpdate = Boolean(overview?.can.update);

  function startEditing(product: CatalogProduct) {
    setEditingId(product.id);
    setDraftCategoryIds(placementByProduct.get(product.id)?.additional_category_ids ?? []);
  }

  function toggleCategory(categoryId: string) {
    setDraftCategoryIds((current) => {
      if (current.includes(categoryId)) return current.filter((id) => id !== categoryId);
      if (current.length >= MAX_ADDITIONAL_CATEGORIES) return current;
      return [...current, categoryId];
    });
  }

  async function save(product: CatalogProduct) {
    if (!storeId || !canUpdate) return;
    const saved = await run(
      () => setCatalogProductCategoryPlacements({
        storeId,
        productId: product.id,
        categoryIds: draftCategoryIds,
      }),
      "Vitrines do produto atualizadas.",
    );
    if (saved) {
      await placementsQuery.refetch();
      setEditingId(null);
      setDraftCategoryIds([]);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.14em] text-brand">
            <LayoutGrid className="size-4" /> Merchandising
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-tight">Vitrines do cardápio</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Faça o mesmo produto aparecer em outras categorias sem duplicar preço, estoque, adicionais ou histórico de vendas.
          </p>
        </div>
        <Badge variant="outline" className="w-fit">Até {MAX_ADDITIONAL_CATEGORIES} categorias extras por produto</Badge>
      </div>

      <Alert>
        <Tags className="size-4" />
        <AlertTitle>Um produto, várias vitrines</AlertTitle>
        <AlertDescription>
          A categoria principal continua sendo a referência operacional. As categorias extras servem somente para exposição no cardápio público e apontam para a mesma ficha do produto.
        </AlertDescription>
      </Alert>

      {activeCategories.length < 2 ? (
        <Alert>
          <AlertTitle>Crie pelo menos duas categorias ativas</AlertTitle>
          <AlertDescription>É necessário ter outra categoria disponível para usar vitrines adicionais.</AlertDescription>
        </Alert>
      ) : null}

      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Buscar produto ou categoria principal"
          className="h-12 pl-10"
          aria-label="Buscar produtos para configurar vitrines"
        />
      </div>

      {productsQuery.isLoading || placementsQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      ) : productsQuery.error || placementsQuery.error ? (
        <Alert variant="destructive">
          <AlertTitle>Não foi possível carregar as vitrines</AlertTitle>
          <AlertDescription>Tente novamente. Nenhuma configuração foi alterada.</AlertDescription>
        </Alert>
      ) : products.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="font-semibold">Nenhum produto encontrado.</p>
            <p className="mt-1 text-sm text-muted-foreground">Ajuste a busca ou cadastre produtos no cardápio.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {products.map((product) => {
            const placement = placementByProduct.get(product.id);
            const additional = placement?.additional_category_ids ?? [];
            const additionalNames = additional
              .map((id) => categoryById.get(id)?.name)
              .filter((name): name is string => Boolean(name));
            const editing = editingId === product.id;
            const eligibleCategories = activeCategories.filter((category) => category.id !== product.category_id);

            return (
              <Card key={product.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base">{product.name}</CardTitle>
                        {!product.is_active ? <Badge variant="secondary">Oculto</Badge> : null}
                        {product.is_sold_out ? <Badge variant="destructive">Esgotado</Badge> : null}
                      </div>
                      <CardDescription className="mt-1">
                        Principal: <strong className="text-foreground">{product.category_name ?? "Sem nome"}</strong> · {formatPriceBRL(product.base_price)}
                      </CardDescription>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {additionalNames.length > 0
                          ? `Também aparece em: ${additionalNames.join(", ")}.`
                          : "Ainda não aparece em nenhuma categoria adicional."}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant={editing ? "secondary" : "outline"}
                      disabled={!canUpdate || isBusy || eligibleCategories.length === 0}
                      onClick={() => editing ? setEditingId(null) : startEditing(product)}
                    >
                      {editing ? "Fechar" : "Editar vitrines"}
                    </Button>
                  </div>
                </CardHeader>

                {editing ? (
                  <CardContent className="space-y-4 border-t pt-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">Exibir também em</p>
                      <span className="text-xs font-bold tabular-nums text-muted-foreground">
                        {draftCategoryIds.length}/{MAX_ADDITIONAL_CATEGORIES}
                      </span>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {eligibleCategories.map((category) => {
                        const checked = draftCategoryIds.includes(category.id);
                        const atLimit = draftCategoryIds.length >= MAX_ADDITIONAL_CATEGORIES && !checked;
                        return (
                          <label
                            key={category.id}
                            className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition ${checked ? "border-brand/40 bg-brand/5" : "border-border"} ${atLimit ? "cursor-not-allowed opacity-55" : "hover:border-brand/30"}`}
                          >
                            <Checkbox
                              checked={checked}
                              disabled={!canUpdate || isBusy || atLimit}
                              onCheckedChange={() => toggleCategory(category.id)}
                            />
                            <span className="min-w-0 font-medium">{category.name}</span>
                          </label>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        disabled={!canUpdate || isBusy}
                        loading={isBusy}
                        loadingLabel="Salvando vitrines"
                        onClick={() => void save(product)}
                      >
                        Salvar vitrines
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={isBusy}
                        onClick={() => {
                          setEditingId(null);
                          setDraftCategoryIds([]);
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </CardContent>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      {productsQuery.data?.has_more ? (
        <p className="rounded-xl bg-muted/35 p-3 text-xs leading-relaxed text-muted-foreground">
          Existem mais de 50 produtos para esta busca. Digite parte do nome para localizar rapidamente o item que deseja configurar.
        </p>
      ) : null}
    </div>
  );
}
