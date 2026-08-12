import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, CheckCircle2, PackagePlus, Sparkles } from "lucide-react";

import { createProduct } from "@/catalog/api";
import { useCatalog } from "@/catalog/CatalogProvider";
import { ProductForm, initialProductValues, type ProductFormValues } from "@/catalog/ProductForm";
import {
  ProductIntelligenceSetup,
  initialIntelligenceValues,
  type ProductIntelligenceValues,
} from "@/catalog/ProductIntelligenceSetup";
import {
  getStoreCategoryProfile,
  updateProductEngineProfile,
  PRODUCT_TYPE_LABELS,
  type CategoryProfile,
} from "@/catalog/shark-engine.api";
import {
  applyMealGroupDefaults,
  applySharkBuildableExperienceDrafts,
  createProductStarterGroupDrafts,
  ensureBuildableBeverageDraft,
  ensureRemainingExperienceDrafts,
} from "@/catalog/shark-groups.api";
import { parsePriceInput } from "@/catalog/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/catalog/PageHeader";

export const Route = createFileRoute("/app/loja/cardapio/produtos/novo")({ component: NovoProduto });

type WizardStep = "structure" | "details";

function NovoProduto() {
  const navigate = useNavigate();
  const { storeId, activeCategories, overview, run, isBusy } = useCatalog();
  const [values, setValues] = useState<ProductFormValues>(initialProductValues());
  const [profile, setProfile] = useState<CategoryProfile | null>(null);
  const [intelligence, setIntelligence] = useState<ProductIntelligenceValues>(initialIntelligenceValues(null));
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [step, setStep] = useState<WizardStep>("structure");

  useEffect(() => {
    if (!storeId) return;
    let active = true;
    void getStoreCategoryProfile(storeId)
      .then((next) => {
        if (!active) return;
        setProfile(next);
        setIntelligence(initialIntelligenceValues(next));
      })
      .catch(() => undefined)
      .finally(() => active && setProfileLoaded(true));
    return () => { active = false; };
  }, [storeId]);

  useEffect(() => {
    const onlyCategory = activeCategories.length === 1 ? activeCategories[0] : undefined;
    if (onlyCategory && !values.categoryId) {
      setValues((current) => ({ ...current, categoryId: onlyCategory.id }));
    }
  }, [activeCategories, values.categoryId]);

  if (!overview?.can.create) {
    return <Alert><AlertTitle>Sem permissão</AlertTitle><AlertDescription>Seu perfil não pode cadastrar produtos nesta loja.</AlertDescription></Alert>;
  }

  if (activeCategories.length === 0) {
    return <Alert><AlertTitle>Crie uma categoria primeiro</AlertTitle><AlertDescription>Todo produto precisa pertencer a uma categoria da própria loja.</AlertDescription></Alert>;
  }

  async function submit() {
    if (!storeId) return;
    const price = parsePriceInput(values.price);
    if (price === null) return;

    const created = await run(async () => {
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

      let engineConfigured = false;
      try {
        await updateProductEngineProfile({
          storeId,
          productId: product.id,
          productType: intelligence.productType,
          capabilities: intelligence.capabilities,
          pricingRules: intelligence.pricingRules,
        });
        engineConfigured = true;
      } catch (error) {
        console.error("[shark] product engine profile fallback to simple", error);
      }

      if (engineConfigured) {
        try {
          await createProductStarterGroupDrafts(storeId, product.id);
          if (intelligence.productType !== "combo" && intelligence.capabilities.beverages === true) {
            await ensureBuildableBeverageDraft(storeId, product.id);
          }
          if (intelligence.capabilities.meal_experience === true) {
            await applyMealGroupDefaults(storeId, product.id);
          }
          if (intelligence.capabilities.burger_experience === true) {
            await applySharkBuildableExperienceDrafts(storeId, product.id);
          }
          if (
            intelligence.capabilities.icecream_experience === true
            || intelligence.capabilities.pastry_experience === true
            || intelligence.capabilities.beverage_experience === true
          ) {
            await ensureRemainingExperienceDrafts(storeId, product.id);
          }
        } catch (error) {
          console.warn("[shark] starter drafts unavailable; product remains valid", error);
        }
      }

      return product;
    }, "Produto criado. O Shark preparou a estrutura inicial para você.");

    if (created) void navigate({ to: "/app/loja/cardapio/produtos/$id", params: { id: created.id } });
  }

  const selectedType = PRODUCT_TYPE_LABELS.find((item) => item.type === intelligence.productType);
  const enabledCapabilities = Object.entries(intelligence.capabilities).filter(([, enabled]) => enabled === true).length;

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        title="Novo produto"
        description={step === "structure" ? "Primeiro diga ao Shark como esse item funciona." : "Agora preencha só os dados básicos. Depois você configura as escolhas específicas."}
      />

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setStep("structure")} className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${step === "structure" ? "border-violet-400/35 bg-violet-500/10" : "border-border bg-card/40"}`}>
          <span className={`grid size-9 place-items-center rounded-xl ${step === "details" ? "bg-emerald-500/12 text-emerald-300" : "bg-violet-500/12 text-violet-300"}`}>{step === "details" ? <CheckCircle2 className="size-4" /> : <Sparkles className="size-4" />}</span>
          <div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Passo 1</p><p className="text-sm font-bold">Como funciona</p></div>
        </button>
        <div className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${step === "details" ? "border-violet-400/35 bg-violet-500/10" : "border-border bg-card/25 opacity-70"}`}>
          <span className="grid size-9 place-items-center rounded-xl bg-muted text-muted-foreground"><PackagePlus className="size-4" /></span>
          <div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Passo 2</p><p className="text-sm font-bold">Dados do produto</p></div>
        </div>
      </div>

      {step === "structure" ? (
        <>
          {profileLoaded ? <ProductIntelligenceSetup profile={profile} value={intelligence} onChange={setIntelligence} /> : null}
          <div className="flex justify-end">
            <Button size="lg" className="min-w-40" onClick={() => setStep("details")}>
              Continuar <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        </>
      ) : (
        <>
          <Card className="border-violet-400/15 bg-violet-500/[.035]">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-2xl bg-violet-500/12 text-violet-300"><Sparkles className="size-4" /></span>
                <div>
                  <p className="text-sm font-bold">{selectedType?.label ?? "Produto personalizado"}</p>
                  <p className="text-xs text-muted-foreground">{enabledCapabilities > 0 ? `${enabledCapabilities} recursos preparados automaticamente` : "Sem configurações extras"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {profile ? <Badge variant="outline">{profile.name}</Badge> : null}
                <Button type="button" size="sm" variant="ghost" onClick={() => setStep("structure")}>Alterar estrutura</Button>
              </div>
            </CardContent>
          </Card>

          <ProductForm
            categories={activeCategories}
            values={values}
            onChange={setValues}
            onSubmit={() => void submit()}
            onCancel={() => void navigate({ to: "/app/loja/cardapio/produtos" })}
            submitting={isBusy}
            showStatusFields
            submitLabel="Criar produto e configurar"
          />

          <div className="hidden justify-start lg:flex">
            <Button variant="ghost" onClick={() => setStep("structure")}><ArrowLeft className="mr-2 size-4" />Voltar para estrutura</Button>
          </div>
        </>
      )}
    </div>
  );
}
