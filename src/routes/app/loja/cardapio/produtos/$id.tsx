import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, CircleDollarSign, ImagePlus, Loader2, PackageCheck, Settings2 } from "lucide-react";

import {
  getProduct,
  removeCatalogImage,
  setProductImage,
  updateProduct,
  updateProductAvailability,
  updateProductCost,
  uploadCatalogImage,
} from "@/catalog/api";
import { CatalogImage } from "@/catalog/CatalogImage";
import { useCatalog } from "@/catalog/CatalogProvider";
import { ProductForm, initialProductValues, type ProductFormValues } from "@/catalog/ProductForm";
import { ProductBuilder } from "@/catalog/advanced/ProductBuilder";
import { ComboSimpleBuilder } from "@/catalog/simple/ComboSimpleBuilder";
import { PizzaSimpleBuilder } from "@/catalog/simple/PizzaSimpleBuilder";
import { SimpleOptionsBuilder } from "@/catalog/simple/SimpleOptionsBuilder";
import { formatPriceBRL, parsePriceInput, type CatalogProduct } from "@/catalog/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/catalog/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/app/loja/cardapio/produtos/$id")({ component: EditarProduto });

const DAYS = [
  { value: 0, short: "Dom", label: "Domingo" },
  { value: 1, short: "Seg", label: "Segunda" },
  { value: 2, short: "Ter", label: "Terça" },
  { value: 3, short: "Qua", label: "Quarta" },
  { value: 4, short: "Qui", label: "Quinta" },
  { value: 5, short: "Sex", label: "Sexta" },
  { value: 6, short: "Sáb", label: "Sábado" },
] as const;

function dbTime(value: string | null | undefined) {
  return value ? value.slice(0, 5) : "";
}

function numericOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function AvailabilityEditor({
  product,
  storeId,
  canUpdate,
  busy,
  save,
}: {
  product: CatalogProduct;
  storeId: string;
  canUpdate: boolean;
  busy: boolean;
  save: (input: Parameters<typeof updateProductAvailability>[0]) => Promise<unknown>;
}) {
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [days, setDays] = useState<number[]>(DAYS.map((day) => day.value));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [stockEnabled, setStockEnabled] = useState(false);
  const [stock, setStock] = useState("");
  const [lowStock, setLowStock] = useState("5");
  const [maxPerOrder, setMaxPerOrder] = useState("");

  useEffect(() => {
    const configuredDays = product.available_weekdays ?? DAYS.map((day) => day.value);
    setScheduleEnabled(Boolean(product.available_weekdays || product.available_from || product.available_to));
    setDays(configuredDays);
    setFrom(dbTime(product.available_from));
    setTo(dbTime(product.available_to));
    setStockEnabled(product.stock_quantity !== null && product.stock_quantity !== undefined);
    setStock(product.stock_quantity === null || product.stock_quantity === undefined ? "" : String(product.stock_quantity));
    setLowStock(String(product.low_stock_threshold ?? 5));
    setMaxPerOrder(product.max_quantity === null || product.max_quantity === undefined ? "" : String(product.max_quantity));
  }, [product.id, product.updated_at]);

  const stockNumber = numericOrNull(stock);
  const lowStockNumber = numericOrNull(lowStock);
  const maxNumber = numericOrNull(maxPerOrder);
  const invalid =
    (scheduleEnabled && days.length === 0) ||
    (stockEnabled && (stockNumber === null || stockNumber < 0)) ||
    lowStockNumber === null ||
    lowStockNumber < 0 ||
    (maxNumber !== null && (!Number.isInteger(maxNumber) || maxNumber <= 0));

  const customDays = days.length !== DAYS.length;
  const scheduleSummary = !scheduleEnabled
    ? "Todos os dias e horários em que a loja estiver aberta"
    : `${customDays ? `${days.length} dia(s) da semana` : "Todos os dias"}${from || to ? ` · ${from || "00:00"}–${to || "fim do dia"}` : ""}`;

  async function submit() {
    if (!canUpdate || invalid) return;
    await save({
      storeId,
      id: product.id,
      availableWeekdays: scheduleEnabled && customDays ? days : null,
      availableFrom: scheduleEnabled && from ? from : null,
      availableTo: scheduleEnabled && to ? to : null,
      maxQuantity: maxNumber === null ? null : maxNumber,
      stockQuantity: stockEnabled ? stockNumber : null,
      lowStockThreshold: lowStockNumber ?? 5,
      expectedUpdatedAt: product.updated_at,
    });
  }

  return (
    <div className="space-y-4">
      {product.runtime_available === false && product.is_active && !product.is_sold_out ? (
        <Alert>
          <AlertTitle>Este produto não está disponível agora</AlertTitle>
          <AlertDescription>
            A Comandiva está respeitando automaticamente horário, dias, estoque e variações configuradas. O cliente volta a vê-lo assim que as regras permitirem.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
              <CalendarClock className="size-5" />
            </span>
            <div className="min-w-0">
              <CardTitle className="text-base">Dias e horários de venda</CardTitle>
              <CardDescription>
                Ideal para almoço, happy hour, pratos de fim de semana ou qualquer item com horário próprio.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-border p-4">
            <div className="min-w-0">
              <Label htmlFor="schedule-product" className="font-semibold">Usar horário específico para este produto</Label>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{scheduleSummary}</p>
            </div>
            <Switch id="schedule-product" checked={scheduleEnabled} disabled={!canUpdate || busy} onCheckedChange={setScheduleEnabled} />
          </div>

          {scheduleEnabled ? (
            <div className="space-y-4 rounded-2xl bg-muted/30 p-4">
              <div>
                <Label>Dias disponíveis</Label>
                <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-7">
                  {DAYS.map((day) => {
                    const selected = days.includes(day.value);
                    return (
                      <Button
                        key={day.value}
                        type="button"
                        variant={selected ? "default" : "outline"}
                        className="min-h-11 px-2"
                        aria-pressed={selected}
                        aria-label={day.label}
                        disabled={!canUpdate || busy}
                        onClick={() =>
                          setDays((current) =>
                            selected
                              ? current.filter((value) => value !== day.value)
                              : [...current, day.value].sort((a, b) => a - b),
                          )
                        }
                      >
                        {day.short}
                      </Button>
                    );
                  })}
                </div>
                {days.length === 0 ? <p className="mt-2 text-xs font-medium text-destructive">Selecione pelo menos um dia.</p> : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="available-from">Começa a vender</Label>
                  <Input id="available-from" type="time" value={from} disabled={!canUpdate || busy} onChange={(event) => setFrom(event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="available-to">Para de vender</Label>
                  <Input id="available-to" type="time" value={to} disabled={!canUpdate || busy} onChange={(event) => setTo(event.target.value)} />
                </div>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Pode deixar os horários vazios para restringir somente os dias. Se o horário final for menor que o inicial, a janela atravessa a meia-noite.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
              <PackageCheck className="size-5" />
            </span>
            <div className="min-w-0">
              <CardTitle className="text-base">Estoque e limite por pedido</CardTitle>
              <CardDescription>
                Evite vender o que acabou e impeça uma única compra de levar toda a disponibilidade.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-border p-4">
            <div className="min-w-0">
              <Label htmlFor="stock-product" className="font-semibold">Controlar estoque deste produto</Label>
              <p className="mt-1 text-xs text-muted-foreground">Desative para vender sem uma quantidade de estoque cadastrada.</p>
            </div>
            <Switch id="stock-product" checked={stockEnabled} disabled={!canUpdate || busy} onCheckedChange={setStockEnabled} />
          </div>

          {stockEnabled ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="stock-quantity">Quantidade em estoque</Label>
                <Input id="stock-quantity" type="number" min="0" step="0.001" inputMode="decimal" value={stock} disabled={!canUpdate || busy} onChange={(event) => setStock(event.target.value)} />
                {stockNumber !== null && lowStockNumber !== null && stockNumber <= lowStockNumber ? (
                  <Badge variant={stockNumber <= 0 ? "destructive" : "secondary"}>{stockNumber <= 0 ? "Sem estoque" : "Estoque baixo"}</Badge>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="low-stock">Avisar quando chegar em</Label>
                <Input id="low-stock" type="number" min="0" step="0.001" inputMode="decimal" value={lowStock} disabled={!canUpdate || busy} onChange={(event) => setLowStock(event.target.value)} />
                <p className="text-xs text-muted-foreground">A lista do cardápio destaca o item quando atingir este valor.</p>
              </div>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="max-per-order">Máximo por pedido <span className="font-normal text-muted-foreground">(opcional)</span></Label>
            <Input id="max-per-order" type="number" min="1" step="1" inputMode="numeric" className="max-w-[220px]" value={maxPerOrder} disabled={!canUpdate || busy} onChange={(event) => setMaxPerOrder(event.target.value)} placeholder="Sem limite" />
            <p className="text-xs text-muted-foreground">Ex.: limite 4 para impedir que um cliente compre mais de 4 unidades deste item no mesmo pedido.</p>
          </div>

          <Button disabled={!canUpdate || busy || invalid} loading={busy} loadingLabel="Salvando disponibilidade" onClick={() => void submit()}>
            Salvar disponibilidade e estoque
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function CostEditor({
  product,
  storeId,
  canUpdate,
  busy,
  save,
}: {
  product: CatalogProduct;
  storeId: string;
  canUpdate: boolean;
  busy: boolean;
  save: (input: Parameters<typeof updateProductCost>[0]) => Promise<unknown>;
}) {
  const [cost, setCost] = useState("");

  useEffect(() => {
    setCost(product.unit_cost === null || product.unit_cost === undefined ? "" : String(product.unit_cost).replace(".", ","));
  }, [product.id, product.unit_cost]);

  const hasCost = cost.trim().length > 0;
  const parsedCost = hasCost ? parsePriceInput(cost) : null;
  const invalid = hasCost && parsedCost === null;
  const estimatedMargin = parsedCost === null ? null : product.base_price - parsedCost;
  const estimatedMarginPercent = estimatedMargin === null || product.base_price <= 0
    ? null
    : (estimatedMargin / product.base_price) * 100;

  async function submit() {
    if (!canUpdate || invalid) return;
    await save({
      storeId,
      id: product.id,
      unitCost: parsedCost,
      expectedUpdatedAt: product.updated_at,
    });
  }

  return (
    <div className="space-y-4">
      <Alert>
        <CircleDollarSign className="size-4" />
        <AlertTitle>Margem estimada, não lucro contábil</AlertTitle>
        <AlertDescription>
          Nesta primeira versão, a Comandiva considera apenas o custo base informado abaixo. Taxas, impostos, embalagem, ingredientes e custo específico de adicionais ainda não entram neste cálculo.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Custo do produto</CardTitle>
          <CardDescription>Informe quanto custa produzir ou comprar uma unidade comercial deste item.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="max-w-sm space-y-1.5">
            <Label htmlFor="unit-cost">Custo estimado</Label>
            <Input
              id="unit-cost"
              inputMode="decimal"
              value={cost}
              disabled={!canUpdate || busy}
              onChange={(event) => setCost(event.target.value)}
              placeholder="Ex.: 12,50"
            />
            <p className="text-xs text-muted-foreground">Deixe vazio para remover o custo cadastrado.</p>
            {invalid ? <p className="text-xs font-medium text-destructive">Informe um valor válido.</p> : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border p-4">
              <p className="text-xs font-semibold text-muted-foreground">Preço base</p>
              <p className="mt-1 text-xl font-black tabular-nums">{formatPriceBRL(product.base_price)}</p>
            </div>
            <div className="rounded-2xl border border-border p-4">
              <p className="text-xs font-semibold text-muted-foreground">Custo estimado</p>
              <p className="mt-1 text-xl font-black tabular-nums">{parsedCost === null ? "—" : formatPriceBRL(parsedCost)}</p>
            </div>
            <div className="rounded-2xl border border-border p-4">
              <p className="text-xs font-semibold text-muted-foreground">Margem bruta estimada</p>
              <p className={`mt-1 text-xl font-black tabular-nums ${estimatedMargin !== null && estimatedMargin < 0 ? "text-destructive" : ""}`}>
                {estimatedMargin === null ? "—" : formatPriceBRL(estimatedMargin)}
              </p>
              {estimatedMarginPercent !== null ? <p className="mt-1 text-xs text-muted-foreground">{estimatedMarginPercent.toFixed(1).replace(".", ",")}% do preço base</p> : null}
            </div>
          </div>

          {product.has_variants ? (
            <p className="rounded-xl bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
              Este produto possui variações. A prévia acima usa o preço base; o relatório de vendas usa a receita real registrada nos pedidos, mas ainda aplica este mesmo custo base por quantidade vendida.
            </p>
          ) : null}

          <Button disabled={!canUpdate || busy || invalid} loading={busy} loadingLabel="Salvando custo" onClick={() => void submit()}>
            Salvar custo
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function EditarProduto() {
  const { id } = useParams({ from: "/app/loja/cardapio/produtos/$id" });
  const navigate = useNavigate();
  const { storeId, categories, overview, run, isBusy, refresh } = useCatalog();
  const [values, setValues] = useState<ProductFormValues | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const productQuery = useQuery({ queryKey: ["catalog", "product", storeId, id], queryFn: () => getProduct(storeId!, id), enabled: Boolean(storeId), retry: false });
  const product = productQuery.data ?? null;

  useEffect(() => { if (product) setValues(initialProductValues(product)); }, [product]);

  if (productQuery.isLoading || !values) return <Skeleton className="h-64 w-full" />;
  if (productQuery.error || !product) return <Alert variant="destructive"><AlertTitle>Produto indisponível</AlertTitle><AlertDescription>Este produto não existe mais ou não pertence à loja selecionada.</AlertDescription></Alert>;

  const canUpdate = Boolean(overview?.can.update) && !product.is_archived;

  async function submit() {
    if (!storeId || !values || !product) return;
    const price = parsePriceInput(values.price);
    if (price === null) return;
    const updated = await run(() => updateProduct({
      storeId,
      id: product.id,
      categoryId: values.categoryId,
      name: values.name.trim(),
      description: values.description.trim(),
      basePrice: price,
      allowsNotes: values.allowsNotes,
      expectedUpdatedAt: product.updated_at,
    }), "Produto atualizado.");
    if (updated) void productQuery.refetch();
  }

  async function handleFile(file: File | undefined) {
    if (!file || !storeId || !product) return;
    setUploading(true);
    const previous = product.image_path;
    await run(async () => {
      const path = await uploadCatalogImage({ storeId, scope: "products", entityId: product.id, file });
      const updated = await setProductImage(storeId, product.id, path);
      await removeCatalogImage(previous);
      return updated;
    }, "Imagem atualizada.");
    setUploading(false);
    void productQuery.refetch();
  }

  return (
    <div className="space-y-4">
      <PageHeader title={product.name} description="Edite informações, foto, custo, disponibilidade e escolhas que o cliente encontra neste produto." />
      {product.is_archived ? <Alert><AlertTitle>Produto arquivado</AlertTitle><AlertDescription>Restaure o produto na lista para voltar a editá-lo.</AlertDescription></Alert> : null}

      <Tabs defaultValue="dados">
        <TabsList className="h-auto max-w-full flex-wrap justify-start">
          <TabsTrigger value="dados">Informações</TabsTrigger>
          <TabsTrigger value="custo">Custo e margem</TabsTrigger>
          <TabsTrigger value="opcoes">Preços e adicionais</TabsTrigger>
          <TabsTrigger value="disponibilidade">Disponibilidade</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Imagem</CardTitle><CardDescription>Foto exibida ao lado do produto no cardápio.</CardDescription></CardHeader>
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <CatalogImage path={product.image_path} alt={product.name} className="h-28 w-28 shrink-0" />
              {canUpdate ? (
                <div className="space-y-2">
                  <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => { void handleFile(event.target.files?.[0]); event.target.value = ""; }} />
                  <Button variant="outline" disabled={uploading} onClick={() => fileInput.current?.click()}>{uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}Enviar imagem</Button>
                  <p className="text-xs text-muted-foreground">PNG, JPG ou WebP de até 5 MB. Prefira foto clara, centralizada e sem textos pequenos.</p>
                  {product.image_path ? <Button variant="ghost" size="sm" disabled={isBusy} onClick={() => void run(async () => {
                    const previous = product.image_path;
                    const updated = await setProductImage(storeId!, product.id, null);
                    await removeCatalogImage(previous);
                    refresh();
                    void productQuery.refetch();
                    return updated;
                  }, "Imagem removida.")}>Remover imagem</Button> : null}
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

        <TabsContent value="custo" className="mt-4">
          {storeId ? (
            <CostEditor
              product={product}
              storeId={storeId}
              canUpdate={canUpdate}
              busy={isBusy}
              save={async (input) => {
                const saved = await run(() => updateProductCost(input), "Custo do produto atualizado.");
                if (saved) await productQuery.refetch();
                return saved;
              }}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="opcoes" className="mt-4 space-y-4">
          <PizzaSimpleBuilder productId={product.id} />
          <ComboSimpleBuilder productId={product.id} />
          <SimpleOptionsBuilder productId={product.id} />
        </TabsContent>

        <TabsContent value="disponibilidade" className="mt-4">
          {storeId ? (
            <AvailabilityEditor
              product={product}
              storeId={storeId}
              canUpdate={canUpdate}
              busy={isBusy}
              save={async (input) => {
                const saved = await run(() => updateProductAvailability(input), "Disponibilidade e estoque atualizados.");
                if (saved) await productQuery.refetch();
                return saved;
              }}
            />
          ) : null}
        </TabsContent>
      </Tabs>

      <details className="rounded-2xl border border-dashed border-border bg-muted/20">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 text-sm font-semibold text-muted-foreground">
          <Settings2 className="size-4" /> Configurações avançadas
        </summary>
        <div className="space-y-3 border-t border-border p-4">
          <Alert><AlertTitle>Use somente quando necessário</AlertTitle><AlertDescription>Para sabores, adicionais, acompanhamentos e combos, prefira a aba “Preços e adicionais”. Esta área atende configurações menos comuns.</AlertDescription></Alert>
          <ProductBuilder productId={product.id} />
        </div>
      </details>
    </div>
  );
}
