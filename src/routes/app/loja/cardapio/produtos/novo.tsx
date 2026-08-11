import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

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
  type CategoryProfile,
} from "@/catalog/shark-engine.api";
import { parsePriceInput } from "@/catalog/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/catalog/PageHeader";

export const Route = createFileRoute("/app/loja/cardapio/produtos/novo")({ component: NovoProduto });

function NovoProduto() {
  const navigate = useNavigate();
  const { storeId, activeCategories, overview, run, isBusy } = useCatalog();
  const [values, setValues] = useState<ProductFormValues>(initialProductValues());
  const [profile, setProfile] = useState<CategoryProfile | null>(null);
  const [intelligence, setIntelligence] = useState<ProductIntelligenceValues>(initialIntelligenceValues(null));
  const [profileLoaded, setProfileLoaded] = useState(false);

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
      // A criação legado continua sendo a primeira etapa. Se a configuração inteligente
      // falhar por qualquer motivo, o item permanece como produto simples e nunca fica corrompido.
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
      try {
        await updateProductEngineProfile({
          storeId,
          productId: product.id,
          productType: intelligence.productType,
          capabilities: intelligence.capabilities,
          pricingRules: intelligence.pricingRules,
        });
      } catch (error) {
        console.error("[shark] product engine profile fallback to simple", error);
      }
      return product;
    }, "Produto criado.");

    if (created) void navigate({ to: "/app/loja/cardapio/produtos/$id", params: { id: created.id } });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Novo produto"
        description="Comece simples. O motor mostra apenas os recursos que fizerem sentido para este produto."
      />

      {profileLoaded ? (
        <ProductIntelligenceSetup profile={profile} value={intelligence} onChange={setIntelligence} />
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
