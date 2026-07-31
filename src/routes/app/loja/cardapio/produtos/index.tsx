import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PackageSearch } from "lucide-react";

import {
  archiveProduct,
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
  type ProductStatusFilter,
} from "@/catalog/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { ListSkeleton } from "@/components/feedback/Skeletons";

export const Route = createFileRoute("/app/loja/cardapio/produtos/")({
  component: ProdutosPage,
});

function ProdutosPage() {
  const { storeId, categories, activeCategories, overview, run, isBusy } = useCatalog();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [categoryId, setCategoryId] = useState<string>("todas");
  const [status, setStatus] = useState<ProductStatusFilter>("todos");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => setPage(0), [debounced, categoryId, status]);

  const can = overview?.can ?? { view: true, create: false, update: false, archive: false };

  const query = useQuery({
    queryKey: ["catalog", "products", storeId, debounced, categoryId, status, page],
    queryFn: () =>
      listProducts({
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

  const categoryOptions = useMemo(
    () => categories.filter((c) => !c.is_archived),
    [categories],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="busca">Buscar</Label>
          <Input
            id="busca"
            value={search}
            placeholder="Nome do produto ou categoria"
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filtro-categoria">Categoria</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger id="filtro-categoria">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {categoryOptions.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filtro-status">Situação</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as ProductStatusFilter)}>
            <SelectTrigger id="filtro-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_STATUS_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {query.isLoading ? "Carregando…" : `${total} produto(s)`}
        </p>
        {canCreate ? (
          <Button asChild>
            <Link to="/app/loja/cardapio/produtos/novo">Novo produto</Link>
          </Button>
        ) : can.create ? (
          <span className="text-xs text-muted-foreground">
            Crie uma categoria ativa para cadastrar produtos.
          </span>
        ) : null}
      </div>

      {query.isLoading ? (
        <ListSkeleton rows={4} />
      ) : query.isError ? (
        <ErrorState
          title="Não foi possível carregar os produtos"
          description="A conexão com o servidor falhou. Tente novamente."
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="Nenhum produto encontrado"
          description="Ajuste os filtros de busca ou cadastre um novo produto para o cardápio."
        />
      ) : (
        <ul className="space-y-3">
          {items.map((product) => (
            <li key={product.id}>
              <Card>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <CatalogImage
                    path={product.image_path}
                    alt={product.name}
                    className="h-16 w-16 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium text-foreground">{product.name}</span>
                      {product.is_archived ? <Badge variant="outline">Arquivado</Badge> : null}
                      {!product.is_archived && !product.is_active ? (
                        <Badge variant="secondary">Inativo</Badge>
                      ) : null}
                      {product.is_sold_out ? <Badge variant="destructive">Esgotado</Badge> : null}
                      {product.is_featured ? <Badge>Destaque</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {product.category_name ?? "Sem categoria"} ·{" "}
                      <span className="font-medium text-foreground">
                        {formatPriceBRL(product.base_price)}
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {can.update && !product.is_archived ? (
                      <>
                        <Button asChild variant="outline" size="sm">
                          <Link
                            to="/app/loja/cardapio/produtos/$id"
                            params={{ id: product.id }}
                          >
                            Editar
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isBusy}
                          onClick={() =>
                            void run(
                              () =>
                                setProductActive(
                                  storeId!,
                                  product.id,
                                  !product.is_active,
                                  product.updated_at,
                                ),
                              product.is_active ? "Produto desativado." : "Produto ativado.",
                            ).then(() => query.refetch())
                          }
                        >
                          {product.is_active ? "Desativar" : "Ativar"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isBusy}
                          onClick={() =>
                            void run(
                              () =>
                                setProductSoldOut(
                                  storeId!,
                                  product.id,
                                  !product.is_sold_out,
                                  product.updated_at,
                                ),
                              product.is_sold_out
                                ? "Produto disponível novamente."
                                : "Produto marcado como esgotado.",
                            ).then(() => query.refetch())
                          }
                        >
                          {product.is_sold_out ? "Repor" : "Esgotar"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isBusy}
                          onClick={() =>
                            void run(
                              () =>
                                setProductFeatured(
                                  storeId!,
                                  product.id,
                                  !product.is_featured,
                                  product.updated_at,
                                ),
                              product.is_featured
                                ? "Destaque removido."
                                : "Produto em destaque.",
                            ).then(() => query.refetch())
                          }
                        >
                          {product.is_featured ? "Tirar destaque" : "Destacar"}
                        </Button>
                      </>
                    ) : null}

                    {can.archive ? (
                      <Button
                        variant={product.is_archived ? "default" : "ghost"}
                        size="sm"
                        disabled={isBusy}
                        onClick={() =>
                          void run(
                            () =>
                              archiveProduct(
                                storeId!,
                                product.id,
                                !product.is_archived,
                                product.updated_at,
                              ),
                            product.is_archived ? "Produto restaurado." : "Produto arquivado.",
                          ).then(() => query.refetch())
                        }
                      >
                        {product.is_archived ? "Restaurar" : "Arquivar"}
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {total > CATALOG_PAGE_SIZE ? (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Anterior
          </Button>
          <span className="text-xs text-muted-foreground">
            Página {page + 1} de {Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE))}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!query.data?.has_more}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      ) : null}
    </div>
  );
}
