import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  LayoutTemplate,
  Loader2,
  PencilLine,
  Sparkles,
} from "lucide-react";

import { useCatalog } from "@/catalog/CatalogProvider";
import {
  applyCatalogStarterTemplate,
  type StarterTemplateCode,
} from "@/catalog/starter-templates";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/catalog/PageHeader";

export const Route = createFileRoute("/app/loja/cardapio/")({
  component: CardapioOverview,
});

type MenuModel = {
  code: StarterTemplateCode;
  name: string;
  description: string;
  creates: string;
};

const MENU_MODELS: MenuModel[] = [
  {
    code: "pizzaria",
    name: "Pizzaria",
    description: "Pizzas, tamanhos, sabores, bordas e adicionais.",
    creates: "Pizzas, combos, bebidas, sobremesas + grupos de sabores, borda, massa e adicionais.",
  },
  {
    code: "hamburgueria",
    name: "Hamburgueria",
    description: "Lanches, adicionais, molhos, ponto da carne e combos.",
    creates: "Hambúrgueres, combos, porções, bebidas, sobremesas + adicionais, molhos, ponto e pão.",
  },
  {
    code: "acai",
    name: "Açaí",
    description: "Tamanhos, frutas, cremes, coberturas e complementos.",
    creates: "Açaí, combos, bebidas + tamanho, frutas, cremes, coberturas e complementos.",
  },
  {
    code: "sorveteria",
    name: "Sorveteria",
    description: "Sabores, bolas, coberturas, recipientes e adicionais.",
    creates: "Sorvetes, picolés, açaí, bebidas + sabores, recipiente, coberturas e adicionais.",
  },
  {
    code: "restaurante",
    name: "Marmitaria / Restaurante",
    description: "Pratos, marmitas, proteínas, acompanhamentos e bebidas.",
    creates: "Pratos, marmitas, combos, porções, bebidas, sobremesas + tamanho, proteína e acompanhamentos.",
  },
  {
    code: "lanchonete",
    name: "Lanchonete",
    description: "Lanches, porções, bebidas, adicionais e combos.",
    creates: "Lanches, combos, porções, bebidas, sobremesas + adicionais, molhos e acompanhamentos.",
  },
  {
    code: "pastelaria",
    name: "Pastelaria",
    description: "Sabores, tamanhos, adicionais e combos.",
    creates: "Pastéis, combos, porções, bebidas + sabores, tamanho e adicionais.",
  },
  {
    code: "adega",
    name: "Bebidas / Adega",
    description: "Volumes, embalagens, kits, gelo e complementos.",
    creates: "Cervejas, refrigerantes, destilados, energéticos, água e gelo, kits + volume e embalagem.",
  },
  {
    code: "mercado",
    name: "Padaria / Mercado",
    description: "Produtos simples, peso/volume, variações, kits e estoque.",
    creates: "Padaria, mercearia, bebidas, frios, snacks, higiene + estrutura básica de variações.",
  },
];

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
  const navigate = useNavigate();
  const {
    overview,
    categories,
    storeId,
    run,
    pendingKey,
    setPendingKey,
    isBusy,
  } = useCatalog();
  if (!overview) return null;

  const { counts, can } = overview;
  const emptyCatalog = counts.categories_total === 0;

  async function useModel(model: MenuModel) {
    if (!storeId || !can.create || isBusy) return;
    const key = `starter:${model.code}`;
    setPendingKey(key);
    const result = await run(
      () => applyCatalogStarterTemplate(storeId, model.code),
      `Modelo ${model.name} aplicado. A estrutura inicial já está pronta para editar.`,
    );
    if (!result) return;
    void navigate({ to: "/app/loja/cardapio/categorias" });
  }

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
              Escolha seu tipo de negócio e a Comandiva cria automaticamente categorias e grupos de escolhas. Nada é apagado se você já tiver itens.
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
            A aplicação é aditiva e idempotente: categorias e grupos existentes não são duplicados nem apagados.
          </p>
        </div>

        {!can.create ? (
          <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
            Seu perfil pode visualizar o cardápio, mas não tem permissão para aplicar modelos.
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {MENU_MODELS.map((model) => {
            const loading = pendingKey === `starter:${model.code}` && isBusy;
            return (
              <Card key={model.code} className="group transition-colors hover:border-brand/35">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{model.name}</CardTitle>
                  <CardDescription>{model.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2 rounded-lg bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand" />
                    <span>{model.creates}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto px-0 text-brand hover:bg-transparent hover:text-brand"
                    disabled={!can.create || isBusy || !storeId}
                    onClick={() => void useModel(model)}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-1 size-4 animate-spin" /> Criando estrutura…
                      </>
                    ) : (
                      <>
                        Usar como base <ArrowRight className="ml-1 size-4" />
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
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
