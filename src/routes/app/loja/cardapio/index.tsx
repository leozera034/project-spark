import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, BriefcaseBusiness, LayoutTemplate, PencilLine, Sparkles } from "lucide-react";

import { useCatalog } from "@/catalog/CatalogProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/catalog/PageHeader";

export const Route = createFileRoute("/app/loja/cardapio/")({
  component: CardapioOverview,
});

const MENU_MODELS = [
  ["Pizzaria", "Pizzas, tamanhos, sabores, bordas e adicionais."],
  ["Hamburgueria", "Lanches, adicionais, molhos, ponto da carne e combos."],
  ["Açaí", "Tamanhos, frutas, cremes, coberturas e complementos."],
  ["Sorveteria", "Sabores, bolas, coberturas, recipientes e adicionais."],
  ["Marmitaria / Restaurante", "Pratos, marmitas, proteínas, acompanhamentos e bebidas."],
  ["Lanchonete", "Lanches, porções, bebidas, adicionais e combos."],
  ["Pastelaria", "Sabores, tamanhos, adicionais e combos."],
  ["Bebidas / Adega", "Volumes, embalagens, kits, gelo e complementos."],
  ["Padaria / Mercado", "Produtos simples, peso/volume, variações, kits e estoque."],
] as const;

function Metric({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {hint ? <CardContent className="pt-0 text-xs text-muted-foreground">{hint}</CardContent> : null}
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
        title="Cardápio"
        description="Monte seu cardápio do jeito mais simples: use um modelo, cadastre manualmente ou peça a implantação completa."
      />

      <section className="grid gap-3 lg:grid-cols-3">
        <Card className="border-brand/25 bg-brand-soft/35">
          <CardHeader>
            <div className="mb-1 grid size-10 place-items-center rounded-xl bg-brand text-brand-foreground">
              <LayoutTemplate className="size-5" />
            </div>
            <CardTitle className="text-lg">Começar com um modelo</CardTitle>
            <CardDescription>
              Escolha seu tipo de negócio e parta de uma estrutura pronta. Depois altere só nomes, preços, fotos e regras que precisar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <a href="#modelos">Ver modelos prontos</a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="mb-1 grid size-10 place-items-center rounded-xl bg-muted">
              <PencilLine className="size-5" />
            </div>
            <CardTitle className="text-lg">Montar do meu jeito</CardTitle>
            <CardDescription>
              Para quem já sabe o que quer. Crie categorias e produtos aos poucos sem precisar configurar recursos avançados agora.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link to={emptyCatalog ? "/app/loja/cardapio/categorias" : "/app/loja/cardapio/produtos"}>
                {emptyCatalog ? "Criar primeira categoria" : "Gerenciar produtos"}
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="mb-1 grid size-10 place-items-center rounded-xl bg-[#FF6A4D]/10 text-[#E6573D]">
              <BriefcaseBusiness className="size-5" />
            </div>
            <CardTitle className="text-lg">Quero que a Comandiva faça</CardTitle>
            <CardDescription>
              Serviço opcional de implantação. Você envia seu cardápio atual e nossa equipe organiza produtos, adicionais, preços e fotos para deixar tudo pronto.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild variant="outline" className="w-full">
              <Link to="/app/loja/plano">Consultar serviço de implantação</Link>
            </Button>
            <p className="text-xs text-muted-foreground">Cobrança avulsa, separada da mensalidade do plano.</p>
          </CardContent>
        </Card>
      </section>

      <section id="modelos" className="space-y-3 scroll-mt-24">
        <div>
          <div className="flex items-center gap-2 text-brand">
            <Sparkles className="size-4" />
            <span className="text-xs font-extrabold uppercase tracking-[.14em]">Modelos de cardápio</span>
          </div>
          <h2 className="mt-1 text-xl font-bold">Escolha a estrutura mais próxima da sua operação</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Os recursos avançados aparecem somente quando fizerem sentido para o tipo de estabelecimento.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {MENU_MODELS.map(([name, description]) => (
            <Card key={name} className="group transition-colors hover:border-brand/35">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{name}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="ghost" className="h-auto px-0 text-brand hover:bg-transparent hover:text-brand">
                  <Link to={emptyCatalog ? "/app/loja/cardapio/categorias" : "/app/loja/cardapio/produtos/novo"}>
                    Usar como base <ArrowRight className="ml-1 size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Categorias ativas" value={counts.categories_active} hint={`${counts.categories_total} no total`} />
        <Metric label="Produtos ativos" value={counts.products_active} hint={`${counts.products_total} no total`} />
        <Metric label="Esgotados" value={counts.products_sold_out} hint="Ocultos do cliente" />
        <Metric label="Destaques" value={counts.products_featured} hint="Aparecem primeiro" />
      </div>

      <section className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Categorias</CardTitle>
            <CardDescription>Organize as seções que o cliente enxerga no cardápio.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline"><Link to="/app/loja/cardapio/categorias">Gerenciar categorias</Link></Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Produtos</CardTitle>
            <CardDescription>Cadastre itens simples primeiro. Variações e adicionais podem ser configurados depois.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link to="/app/loja/cardapio/produtos">Ver produtos</Link></Button>
            {can.create && categories.some((c) => !c.is_archived) ? (
              <Button asChild><Link to="/app/loja/cardapio/produtos/novo">Novo produto</Link></Button>
            ) : null}
          </CardContent>
        </Card>
      </section>

      {counts.products_archived > 0 ? (
        <p className="text-xs text-muted-foreground">
          {counts.products_archived} produto(s) arquivado(s). Eles não aparecem para o cliente e podem ser restaurados na lista de produtos.
        </p>
      ) : null}
    </div>
  );
}
