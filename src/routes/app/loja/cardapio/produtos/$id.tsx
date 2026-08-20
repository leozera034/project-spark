import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ImagePlus, Loader2 } from "lucide-react";

import {
  getProduct,
  removeCatalogImage,
  setProductImage,
  updateProduct,
  uploadCatalogImage,
} from "@/catalog/api";
import { CatalogImage } from "@/catalog/CatalogImage";
import { useCatalog } from "@/catalog/CatalogProvider";
import {
  ProductForm,
  initialProductValues,
  type ProductFormValues,
} from "@/catalog/ProductForm";
import { ProductBuilder } from "@/catalog/advanced/ProductBuilder";
import { ComboSimpleBuilder } from "@/catalog/simple/ComboSimpleBuilder";
import { PizzaSimpleBuilder } from "@/catalog/simple/PizzaSimpleBuilder";
import { SimpleOptionsBuilder } from "@/catalog/simple/SimpleOptionsBuilder";
import { parsePriceInput } from "@/catalog/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/catalog/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/app/loja/cardapio/produtos/$id")({
  component: EditarProduto,
});

function EditarProduto() {
  const { id } = useParams({ from: "/app/loja/cardapio/produtos/$id" });
  const navigate = useNavigate();
  const { storeId, categories, overview, run, isBusy, refresh } = useCatalog();
  const [values, setValues] = useState<ProductFormValues | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const productQuery = useQuery({
    queryKey: ["catalog", "product", storeId, id],
    queryFn: () => getProduct(storeId!, id),
    enabled: Boolean(storeId),
    retry: false,
  });

  const product = productQuery.data ?? null;

  useEffect(() => {
    if (product) setValues(initialProductValues(product));
  }, [product]);

  if (productQuery.isLoading || !values) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (productQuery.error || !product) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Produto indisponível</AlertTitle>
        <AlertDescription>
          Este produto não existe mais ou não pertence à loja selecionada.
        </AlertDescription>
      </Alert>
    );
  }

  const canUpdate = Boolean(overview?.can.update) && !product.is_archived;

  async function submit() {
    if (!storeId || !values || !product) return;
    const price = parsePriceInput(values.price);
    if (price === null) return;
    const updated = await run(
      () =>
        updateProduct({
          storeId,
          id: product.id,
          categoryId: values.categoryId,
          name: values.name.trim(),
          description: values.description.trim(),
          basePrice: price,
          allowsNotes: values.allowsNotes,
          expectedUpdatedAt: product.updated_at,
        }),
      "Produto atualizado.",
    );
    if (updated) void productQuery.refetch();
  }

  async function handleFile(file: File | undefined) {
    if (!file || !storeId || !product) return;
    setUploading(true);
    const previous = product.image_path;
    await run(async () => {
      const path = await uploadCatalogImage({
        storeId,
        scope: "products",
        entityId: product.id,
        file,
      });
      const updated = await setProductImage(storeId, product.id, path);
      await removeCatalogImage(previous);
      return updated;
    }, "Imagem atualizada.");
    setUploading(false);
    void productQuery.refetch();
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={product.name}
        description="Edite os dados do produto e monte as escolhas do cliente sem precisar entender configurações técnicas."
      />
      {product.is_archived ? (
        <Alert>
          <AlertTitle>Produto arquivado</AlertTitle>
          <AlertDescription>
            Restaure o produto na lista para voltar a editá-lo.
          </AlertDescription>
        </Alert>
      ) : null}

      <Tabs defaultValue="dados">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="dados">Dados e imagem</TabsTrigger>
          <TabsTrigger value="opcoes">Escolhas e adicionais</TabsTrigger>
          <TabsTrigger value="avancado">Avançado</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Imagem</CardTitle>
              <CardDescription>Foto exibida ao lado do produto no cardápio.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              <CatalogImage path={product.image_path} alt={product.name} className="h-24 w-24" />
              {canUpdate ? (
                <div className="space-y-2">
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      void handleFile(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                  <Button
                    variant="outline"
                    disabled={uploading}
                    onClick={() => fileInput.current?.click()}
                  >
                    {uploading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ImagePlus className="mr-2 h-4 w-4" />
                    )}
                    Enviar imagem
                  </Button>
                  <p className="text-xs text-muted-foreground">PNG, JPG ou WebP de até 5 MB.</p>
                  {product.image_path ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isBusy}
                      onClick={() =>
                        void run(async () => {
                          const previous = product.image_path;
                          const updated = await setProductImage(storeId!, product.id, null);
                          await removeCatalogImage(previous);
                          refresh();
                          void productQuery.refetch();
                          return updated;
                        }, "Imagem removida.")
                      }
                    >
                      Remover imagem
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <ProductForm
            categories={categories.filter((c) => !c.is_archived)}
            values={values}
            onChange={setValues}
            onSubmit={() => void submit()}
            onCancel={() => void navigate({ to: "/app/loja/cardapio/produtos" })}
            submitting={isBusy || !canUpdate}
            showStatusFields={false}
            submitLabel="Salvar alterações"
          />
        </TabsContent>

        <TabsContent value="opcoes" className="mt-4 space-y-4">
          <PizzaSimpleBuilder productId={product.id} />
          <ComboSimpleBuilder productId={product.id} />
          <SimpleOptionsBuilder productId={product.id} />
        </TabsContent>

        <TabsContent value="avancado" className="mt-4 space-y-3">
          <Alert>
            <AlertTitle>Modo avançado</AlertTitle>
            <AlertDescription>
              Use esta área somente quando a configuração simples não atender sua operação. Para adicionais, sabores, molhos, bebidas, acompanhamentos e etapas de combo, prefira a aba “Escolhas e adicionais”.
            </AlertDescription>
          </Alert>
          <ProductBuilder productId={product.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
