import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, BriefcaseBusiness, CheckCircle2, LayoutTemplate, Loader2, PencilLine, Plus, Sparkles } from "lucide-react";
import { useState } from "react";

import { useCatalog } from "@/catalog/CatalogProvider";
import { applyCatalogStarterTemplate, type StarterTemplateCode } from "@/catalog/starter-templates";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/catalog/PageHeader";

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

function CardapioOverview() {
  const navigate = useNavigate();
  const { overview, categories, storeId, run, pendingKey, setPendingKey, isBusy } = useCatalog();
  const [otherBusinessType, setOtherBusinessType] = useState("");
  if (!overview) return null;

  const { counts, can } = overview;
  const emptyCatalog = counts.categories_total === 0 && counts.products_total === 0;

  async function useModel(model: MenuModel) {
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
          description="Gerencie o que o cliente vê: produtos, categorias, disponibilidade e adicionais."
          action={can.create && categories.some((category) => !category.is_archived) ? <Button asChild><Link to="/app/loja/cardapio/produtos/novo"><Plus className="mr-1 size-4" /> Novo produto</Link></Button> : null}
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Categorias ativas" value={counts.categories_active} hint={`${counts.categories_total} no total`} />
          <Metric label="Produtos ativos" value={counts.products_active} hint={`${counts.products_total} no total`} />
          <Metric label="Esgotados" value={counts.products_sold_out} hint="Não disponíveis para compra" />
          <Metric label="Destaques" value={counts.products_featured} hint="Ganham prioridade no cardápio" />
        </div>

        <section className="grid gap-4 md:grid-cols-2">
          <Card><CardHeader><CardTitle>Produtos</CardTitle><CardDescription>Preço, imagem, disponibilidade, variações e adicionais.</CardDescription></CardHeader><CardContent><Button asChild><Link to="/app/loja/cardapio/produtos">Gerenciar produtos <ArrowRight className="ml-1 size-4" /></Link></Button></CardContent></Card>
          <Card><CardHeader><CardTitle>Categorias</CardTitle><CardDescription>Organize a ordem e as seções que o cliente encontra.</CardDescription></CardHeader><CardContent><Button asChild variant="outline"><Link to="/app/loja/cardapio/categorias">Gerenciar categorias <ArrowRight className="ml-1 size-4" /></Link></Button></CardContent></Card>
          <Card><CardHeader><CardTitle>Opções e adicionais</CardTitle><CardDescription>Sabores, tamanhos, molhos, complementos e escolhas obrigatórias.</CardDescription></CardHeader><CardContent><Button asChild variant="outline"><Link to="/app/loja/cardapio/opcoes">Abrir opções</Link></Button></CardContent></Card>
          <Card><CardHeader><CardTitle>Precisa de ajuda?</CardTitle><CardDescription>A Comandiva pode organizar seu cardápio como serviço opcional.</CardDescription></CardHeader><CardContent><Button asChild variant="ghost"><Link to="/app/loja/cardapio/servico">Ver serviço</Link></Button></CardContent></Card>
        </section>

        {counts.products_archived > 0 ? <p className="text-xs text-muted-foreground">{counts.products_archived} produto(s) arquivado(s). Eles ficam fora do cardápio e podem ser restaurados na lista.</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Monte seu primeiro cardápio" description="Escolha um modelo pronto ou comece manualmente. Você poderá editar tudo depois." />

      <section className="grid gap-3 lg:grid-cols-3">
        <Card className="border-brand/25 bg-brand-soft/35"><CardHeader><div className="mb-1 grid size-10 place-items-center rounded-xl bg-brand text-brand-foreground"><LayoutTemplate className="size-5" /></div><CardTitle className="text-lg">Começar com um modelo</CardTitle><CardDescription>Crie uma estrutura inicial adequada ao seu tipo de negócio.</CardDescription></CardHeader><CardContent><Button asChild className="w-full"><a href="#modelos">Ver modelos</a></Button></CardContent></Card>
        <Card><CardHeader><div className="mb-1 grid size-10 place-items-center rounded-xl bg-muted"><PencilLine className="size-5" /></div><CardTitle className="text-lg">Montar manualmente</CardTitle><CardDescription>Crie a primeira categoria e vá adicionando seus produtos.</CardDescription></CardHeader><CardContent><Button asChild variant="outline" className="w-full"><Link to="/app/loja/cardapio/categorias">Criar primeira categoria</Link></Button></CardContent></Card>
        <Card><CardHeader><div className="mb-1 grid size-10 place-items-center rounded-xl bg-[#FF6A4D]/10 text-[#E6573D]"><BriefcaseBusiness className="size-5" /></div><CardTitle className="text-lg">Quero ajuda da Comandiva</CardTitle><CardDescription>Serviço opcional para organizar produtos, adicionais, preços e fotos.</CardDescription></CardHeader><CardContent><Button asChild variant="outline" className="w-full"><Link to="/app/loja/cardapio/servico">Ver serviço</Link></Button></CardContent></Card>
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
                  <Button type="button" variant="ghost" className="h-auto px-0 text-brand hover:bg-transparent hover:text-brand" disabled={!can.create || isBusy || !storeId || otherInvalid} onClick={() => void useModel(model)}>
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
