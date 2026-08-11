import { Link, createFileRoute } from "@tanstack/react-router";

import { useCatalog } from "@/catalog/CatalogProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/catalog/PageHeader";

export const Route = createFileRoute("/app/loja/cardapio/")({
  component: CardapioOverview,
});

function Metric({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {hint ? (
        <CardContent className="pt-0 text-xs text-muted-foreground">{hint}</CardContent>
      ) : null}
    </Card>
  );
}

function CardapioOverview() {
  const { overview, categories } = useCatalog();
  if (!overview) return null;

  const { counts, can } = overview;
  const emptyCatalog = counts.categories_total === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visão geral"
        description="Acompanhe categorias, produtos e destaques do seu cardápio."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Categorias ativas"
          value={counts.categories_active}
          hint={`${counts.categories_total} no total`}
        />
        <Metric
          label="Produtos ativos"
          value={counts.products_active}
          hint={`${counts.products_total} no total`}
        />
        <Metric label="Esgotados" value={counts.products_sold_out} hint="Ocultos do cliente" />
        <Metric label="Destaques" value={counts.products_featured} hint="Aparecem primeiro" />
      </div>

      {emptyCatalog ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Comece pelo primeiro passo</CardTitle>
            <CardDescription>
              Crie uma categoria para depois cadastrar seus produtos. Sem categoria não é possível
              publicar itens.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild disabled={!can.create}>
              <Link to="/app/loja/cardapio/categorias">Criar primeira categoria</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Categorias</CardTitle>
              <CardDescription>
                Organize a ordem em que o cliente enxerga as seções do cardápio.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link to="/app/loja/cardapio/categorias">Gerenciar categorias</Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Produtos</CardTitle>
              <CardDescription>
                Cadastre itens simples com preço único, foto e observações do cliente.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link to="/app/loja/cardapio/produtos">Ver produtos</Link>
              </Button>
              {can.create && categories.some((c) => !c.is_archived) ? (
                <Button asChild>
                  <Link to="/app/loja/cardapio/produtos/novo">Novo produto</Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}

      {counts.products_archived > 0 ? (
        <p className="text-xs text-muted-foreground">
          {counts.products_archived} produto(s) arquivado(s). Eles não aparecem para o cliente e
          podem ser restaurados na lista de produtos.
        </p>
      ) : null}
    </div>
  );
}
