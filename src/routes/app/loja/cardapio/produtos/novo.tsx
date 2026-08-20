import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Boxes, CheckCircle2, Scale, Shapes, Sparkles } from "lucide-react";

import { createProduct } from "@/catalog/api";
import { useCatalog } from "@/catalog/CatalogProvider";
import {
  ProductForm,
  initialProductValues,
  type ProductFormValues,
} from "@/catalog/ProductForm";
import {
  applyProductStarterTemplate,
  FALLBACK_PRODUCT_TEMPLATES,
  getStoreCategoryProfile,
  type ProductStarterTemplate,
} from "@/catalog/product-templates";
import { parsePriceInput } from "@/catalog/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/catalog/PageHeader";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/loja/cardapio/produtos/novo")({
  component: NovoProduto,
});

function iconForTemplate(type: string) {
  if (type === "measured") return Scale;
  if (type === "combo" || type === "kit") return Boxes;
  if (type === "variant" || type === "multi_flavor" || type === "flavors") return Shapes;
  return Sparkles;
}

function descriptionForTemplate(template: ProductStarterTemplate) {
  const caps = template.capabilities ?? {};
  if (template.type === "measured") return "Ideal para itens vendidos por peso ou volume. Você configura a medida depois de criar.";
  if (template.type === "combo" || template.type === "kit") return "Crie a base agora e monte as escolhas do combo na próxima tela.";
  if (template.type === "multi_flavor" || caps.multi_flavor) return "Preparado para sabores, tamanhos e montagem fracionada.";
  if (template.type === "variant" || caps.variants || caps.sizes) return "Preparado para tamanhos, volumes ou outras variações de preço.";
  if (caps.buildable || caps.add_ons || caps.option_groups) return "Preparado para adicionais e escolhas sem mostrar configurações técnicas.";
  return "Nome, preço e descrição. Você pode adicionar opções depois se precisar.";
}

function NovoProduto() {
  const navigate = useNavigate();
  const { storeId, activeCategories, overview, run, isBusy } = useCatalog();
  const [values, setValues] = useState<ProductFormValues>(initialProductValues());
  const [template, setTemplate] = useState<ProductStarterTemplate | null>(null);
  const [step, setStep] = useState<"type" | "details">("type");

  const profileQuery = useQuery({
    queryKey: ["catalog", "category-profile", storeId],
    queryFn: () => getStoreCategoryProfile(storeId as string),
    enabled: Boolean(storeId),
    retry: false,
  });

  const templates = useMemo(() => {
    const profileTemplates = profileQuery.data?.product_templates;
    if (Array.isArray(profileTemplates) && profileTemplates.length > 0) return profileTemplates;
    return FALLBACK_PRODUCT_TEMPLATES;
  }, [profileQuery.data]);

  if (!overview?.can.create) {
    return (
      <Alert>
        <AlertTitle>Sem permissão</AlertTitle>
        <AlertDescription>Seu perfil não pode cadastrar produtos nesta loja.</AlertDescription>
      </Alert>
    );
  }

  if (activeCategories.length === 0) {
    return (
      <Alert>
        <AlertTitle>Seu cardápio ainda não tem categorias</AlertTitle>
        <AlertDescription>
          Aplique um modelo de cardápio ou crie uma categoria antes de cadastrar produtos.
        </AlertDescription>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => void navigate({ to: "/app/loja/cardapio" })}>Usar modelo pronto</Button>
          <Button variant="outline" onClick={() => void navigate({ to: "/app/loja/cardapio/categorias" })}>
            Criar categoria manualmente
          </Button>
        </div>
      </Alert>
    );
  }

  async function submit() {
    if (!storeId || !template) return;
    const price = parsePriceInput(values.price);
    if (price === null) return;

    const created = await run(
      async () => {
        const product = await createProduct({
          storeId,
          categoryId: values.categoryId,
          name: values.name.trim(),
          description: values.description.trim(),
          basePrice: price,
          allowsNotes: values.allowsNotes,
          isActive: values.isActive,
          isFeatured: values.isFeatured,
          isSoldOut: values.isSoldOut,
        });
        await applyProductStarterTemplate({ storeId, productId: product.id, template });
        return product;
      },
      "Produto criado com a estrutura certa para sua operação.",
    );

    if (created) {
      void navigate({ to: "/app/loja/cardapio/produtos/$id", params: { id: created.id } });
    }
  }

  if (step === "type") {
    return (
      <div className="space-y-5">
        <PageHeader
          title="O que você quer cadastrar?"
          description="Escolha uma opção em linguagem simples. A Comandiva prepara a estrutura técnica automaticamente."
        />

        {profileQuery.data?.name ? (
          <div className="flex items-center gap-2 rounded-xl border border-brand/20 bg-brand-soft/40 px-4 py-3 text-sm">
            <CheckCircle2 className="size-4 text-brand" />
            Sugestões adaptadas para <strong>{profileQuery.data.name}</strong>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((item) => {
            const Icon = iconForTemplate(item.type);
            const selected = template?.type === item.type && template?.label === item.label;
            return (
              <Card
                key={`${item.type}-${item.label}`}
                role="button"
                tabIndex={0}
                onClick={() => setTemplate(item)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") setTemplate(item);
                }}
                className={cn(
                  "cursor-pointer transition-all hover:border-brand/40 hover:shadow-sm",
                  selected && "border-brand ring-2 ring-brand/15",
                )}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
                      <Icon className="size-5" />
                    </div>
                    {selected ? <Badge>Selecionado</Badge> : null}
                  </div>
                  <CardTitle className="text-base">{item.label}</CardTitle>
                  <CardDescription>{descriptionForTemplate(item)}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    type="button"
                    variant={selected ? "default" : "outline"}
                    className="w-full"
                    onClick={(event) => {
                      event.stopPropagation();
                      setTemplate(item);
                      setStep("details");
                    }}
                  >
                    Escolher <ArrowRight className="ml-1 size-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">
          Você não precisa entender variações, grupos, tipos de seleção ou regras de preço para começar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title={template?.label ?? "Novo produto"}
          description="Agora informe somente os dados que o cliente precisa ver. Configurações avançadas ficam para depois."
        />
        <Button variant="outline" onClick={() => setStep("type")}>
          <ArrowLeft className="mr-1 size-4" /> Trocar tipo
        </Button>
      </div>

      {template ? (
        <div className="rounded-xl border border-brand/20 bg-brand-soft/35 px-4 py-3 text-sm">
          <strong>{template.label}</strong> · {descriptionForTemplate(template)}
        </div>
      ) : null}

      <ProductForm
        categories={activeCategories}
        values={values}
        onChange={setValues}
        onSubmit={() => void submit()}
        onCancel={() => void navigate({ to: "/app/loja/cardapio/produtos" })}
        submitting={isBusy}
        showStatusFields
        submitLabel="Criar produto"
      />
    </div>
  );
}
