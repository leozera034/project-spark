import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Boxes, CheckCircle2, ImagePlus, Plus, Scale, Shapes, Sparkles, Trash2, X } from "lucide-react";

import type { MeasurementUnit } from "@/catalog/advanced-types";
import { setProductImage, uploadCatalogImage } from "@/catalog/api";
import { useCatalog } from "@/catalog/CatalogProvider";
import {
  ProductForm,
  initialProductValues,
  type ProductFormValues,
} from "@/catalog/ProductForm";
import {
  createProductFromTemplate,
  FALLBACK_PRODUCT_TEMPLATES,
  getStoreCategoryProfile,
  type ProductStarterTemplate,
} from "@/catalog/product-templates";
import { parsePriceInput } from "@/catalog/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/catalog/PageHeader";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/loja/cardapio/produtos/novo")({
  component: NovoProduto,
});

type VariantDraft = { id: string; name: string; price: string };

function iconForTemplate(type: string) {
  if (type === "measured") return Scale;
  if (type === "combo" || type === "kit") return Boxes;
  if (type === "variant" || type === "multi_flavor" || type === "flavors") return Shapes;
  return Sparkles;
}

function descriptionForTemplate(template: ProductStarterTemplate) {
  const caps = template.capabilities ?? {};
  if (template.type === "measured") return "Ideal para itens vendidos por peso ou volume. A medida é configurada agora, sem editor técnico.";
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
  const [measurementUnit, setMeasurementUnit] = useState<MeasurementUnit>("g");
  const [minimumQuantity, setMinimumQuantity] = useState("100");
  const [quantityStep, setQuantityStep] = useState("100");
  const [variants, setVariants] = useState<VariantDraft[]>([
    { id: crypto.randomUUID(), name: "", price: "" },
    { id: crypto.randomUUID(), name: "", price: "" },
  ]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imageInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

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

  const needsMeasure = template?.type === "measured" || Boolean(template?.capabilities?.measured);
  const needsVariants = Boolean(
    template &&
      (template.type === "variant" ||
        template.type === "multi_flavor" ||
        template.capabilities?.variants ||
        template.capabilities?.sizes),
  );

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
        <AlertDescription>Aplique um modelo de cardápio ou crie uma categoria antes de cadastrar produtos.</AlertDescription>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => void navigate({ to: "/app/loja/cardapio" })}>Usar modelo pronto</Button>
          <Button variant="outline" onClick={() => void navigate({ to: "/app/loja/cardapio/categorias" })}>Criar categoria manualmente</Button>
        </div>
      </Alert>
    );
  }

  function chooseImage(file: File | undefined) {
    if (!file) return;
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function removeImage() {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    if (imageInput.current) imageInput.current.value = "";
  }

  async function submit() {
    if (!storeId || !template) return;
    const price = parsePriceInput(values.price);
    if (price === null) return;

    const minQty = Number(minimumQuantity.replace(",", "."));
    const stepQty = Number(quantityStep.replace(",", "."));
    if (needsMeasure && (!Number.isFinite(minQty) || minQty <= 0 || !Number.isFinite(stepQty) || stepQty <= 0)) return;

    const cleanVariants = variants
      .map((variant) => ({ ...variant, name: variant.name.trim(), parsedPrice: parsePriceInput(variant.price) }))
      .filter((variant) => variant.name.length > 0 || variant.price.trim().length > 0);

    if (needsVariants && cleanVariants.length === 0) return;
    if (cleanVariants.some((variant) => variant.name.length < 1 || variant.parsedPrice === null || variant.parsedPrice <= 0)) return;

    const created = await run(
      async () => createProductFromTemplate({
        storeId,
        categoryId: values.categoryId,
        name: values.name.trim(),
        description: values.description.trim(),
        basePrice: price,
        allowsNotes: values.allowsNotes,
        isActive: values.isActive,
        isFeatured: values.isFeatured,
        isSoldOut: values.isSoldOut,
        template,
        saleMode: needsMeasure ? "measured" : "unit",
        measurementUnit: needsMeasure ? measurementUnit : "unit",
        minimumQuantity: needsMeasure ? minQty : 1,
        quantityStep: needsMeasure ? stepQty : 1,
        variants: needsVariants
          ? cleanVariants.map((variant, index) => ({
              name: variant.name,
              price: variant.parsedPrice as number,
              package_quantity: null,
              package_unit: null,
              is_default: index === 0,
            }))
          : [],
      }),
      "Produto criado e configurado.",
    );

    if (created?.product?.id && imageFile) {
      await run(async () => {
        const path = await uploadCatalogImage({ storeId, scope: "products", entityId: created.product.id, file: imageFile });
        return setProductImage(storeId, created.product.id, path);
      }, "Foto adicionada ao produto.");
    }

    if (created?.product?.id) {
      void navigate({ to: "/app/loja/cardapio/produtos/$id", params: { id: created.product.id } });
    }
  }

  if (step === "type") {
    return (
      <div className="space-y-5">
        <PageHeader title="O que você quer cadastrar?" description="Escolha uma opção em linguagem simples. A Comandiva prepara a estrutura técnica automaticamente." />

        {profileQuery.data?.name ? (
          <div className="flex items-center gap-2 rounded-xl border border-brand/20 bg-brand-soft/40 px-4 py-3 text-sm">
            <CheckCircle2 className="size-4 text-brand" /> Sugestões adaptadas para <strong>{profileQuery.data.name}</strong>
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
                className={cn("cursor-pointer transition-all hover:border-brand/40 hover:shadow-sm", selected && "border-brand ring-2 ring-brand/15")}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand"><Icon className="size-5" /></div>
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

        <p className="text-xs text-muted-foreground">Você não precisa entender variações, grupos, tipos de seleção ou regras de preço para começar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title={template?.label ?? "Novo produto"} description="Responda só o que muda a forma de venda. O restante fica escondido no motor do cardápio." />
        <Button variant="outline" onClick={() => setStep("type")}><ArrowLeft className="mr-1 size-4" /> Trocar tipo</Button>
      </div>

      {template ? <div className="rounded-xl border border-brand/20 bg-brand-soft/35 px-4 py-3 text-sm"><strong>{template.label}</strong> · {descriptionForTemplate(template)}</div> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Foto do produto <span className="font-normal text-muted-foreground">(opcional)</span></CardTitle>
          <CardDescription>Uma boa foto ajuda o cliente a reconhecer e escolher o item. Você também pode adicionar ou trocar depois.</CardDescription>
        </CardHeader>
        <CardContent>
          <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => chooseImage(event.target.files?.[0])} />
          {imagePreview ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <img src={imagePreview} alt="Prévia da foto selecionada" className="aspect-[4/3] w-full rounded-2xl object-cover sm:h-28 sm:w-36" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{imageFile?.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">A foto será enviada quando o produto for criado.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" className="min-h-11" onClick={() => imageInput.current?.click()}><ImagePlus className="size-4" /> Trocar foto</Button>
                  <Button type="button" variant="ghost" className="min-h-11 text-destructive" onClick={removeImage}><X className="size-4" /> Remover</Button>
                </div>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => imageInput.current?.click()} className="flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-brand/25 bg-brand-soft/20 p-4 text-center transition hover:border-brand/45 hover:bg-brand-soft/30">
              <span className="grid size-11 place-items-center rounded-xl bg-background text-brand shadow-sm"><ImagePlus className="size-5" /></span>
              <span className="text-sm font-bold">Escolher foto</span>
              <span className="text-xs text-muted-foreground">PNG, JPG ou WebP de até 5 MB</span>
            </button>
          )}
        </CardContent>
      </Card>

      {needsMeasure ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Como este produto é medido?</CardTitle><CardDescription>Ex.: açaí por 100 g, carne por kg ou suco por 100 ml.</CardDescription></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5"><Label>Unidade</Label><Select value={measurementUnit} onValueChange={(value) => setMeasurementUnit(value as MeasurementUnit)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="g">Gramas (g)</SelectItem><SelectItem value="kg">Quilos (kg)</SelectItem><SelectItem value="ml">Mililitros (ml)</SelectItem><SelectItem value="l">Litros (L)</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Quantidade mínima</Label><Input inputMode="decimal" value={minimumQuantity} onChange={(event) => setMinimumQuantity(event.target.value)} placeholder="100" /></div>
            <div className="space-y-1.5"><Label>Cliente aumenta de quanto em quanto?</Label><Input inputMode="decimal" value={quantityStep} onChange={(event) => setQuantityStep(event.target.value)} placeholder="100" /></div>
          </CardContent>
        </Card>
      ) : null}

      {needsVariants ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Quais tamanhos ou versões você vende?</CardTitle><CardDescription>Cadastre aqui os nomes que o cliente entende. A primeira opção será a padrão.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {variants.map((variant, index) => (
              <div key={variant.id} className="grid gap-2 sm:grid-cols-[1fr_180px_auto] sm:items-end">
                <div className="space-y-1.5"><Label>{index === 0 ? "Nome da opção padrão" : "Nome da opção"}</Label><Input value={variant.name} onChange={(event) => setVariants((current) => current.map((item) => item.id === variant.id ? { ...item, name: event.target.value } : item))} placeholder={index === 0 ? "Ex.: Média" : "Ex.: Grande"} /></div>
                <div className="space-y-1.5"><Label>Preço</Label><Input inputMode="decimal" value={variant.price} onChange={(event) => setVariants((current) => current.map((item) => item.id === variant.id ? { ...item, price: event.target.value } : item))} placeholder="0,00" /></div>
                <Button type="button" size="icon" variant="ghost" className="min-h-11 min-w-11" aria-label="Remover opção" disabled={variants.length <= 1} onClick={() => setVariants((current) => current.filter((item) => item.id !== variant.id))}><Trash2 className="size-4" /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={() => setVariants((current) => [...current, { id: crypto.randomUUID(), name: "", price: "" }])}><Plus className="mr-1 size-4" /> Adicionar tamanho ou versão</Button>
          </CardContent>
        </Card>
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
