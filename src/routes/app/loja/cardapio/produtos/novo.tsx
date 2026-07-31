import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { createProduct } from "@/catalog/api";
import { useCatalog } from "@/catalog/CatalogProvider";
import {
  ProductForm,
  initialProductValues,
  type ProductFormValues,
} from "@/catalog/ProductForm";
import { parsePriceInput } from "@/catalog/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const Route = createFileRoute("/app/loja/cardapio/produtos/novo")({
  component: NovoProduto,
});

function NovoProduto() {
  const navigate = useNavigate();
  const { storeId, activeCategories, overview, run, isBusy } = useCatalog();
  const [values, setValues] = useState<ProductFormValues>(initialProductValues());

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
        <AlertTitle>Crie uma categoria primeiro</AlertTitle>
        <AlertDescription>
          Todo produto precisa pertencer a uma categoria da própria loja.
        </AlertDescription>
      </Alert>
    );
  }

  async function submit() {
    if (!storeId) return;
    const price = parsePriceInput(values.price);
    if (price === null) return;
    const created = await run(
      () =>
        createProduct({
          storeId,
          categoryId: values.categoryId,
          name: values.name.trim(),
          description: values.description.trim(),
          basePrice: price,
          allowsNotes: values.allowsNotes,
          isActive: values.isActive,
          isFeatured: values.isFeatured,
          isSoldOut: values.isSoldOut,
        }),
      "Produto criado.",
    );
    if (created) {
      void navigate({ to: "/app/loja/cardapio/produtos/$id", params: { id: created.id } });
    }
  }

  return (
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
  );
}
