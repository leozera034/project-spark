import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pizza, Save } from "lucide-react";
import { toast } from "sonner";

import { useCatalog } from "@/catalog/CatalogProvider";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = supabase.rpc.bind(supabase) as any;

type PizzaVariant = {
  id: string;
  name: string;
  price: number;
  max_flavors?: number | null;
  updated_at: string;
  is_archived?: boolean;
  is_active?: boolean;
};

type PizzaItem = {
  id: string;
  name: string;
  additional_price: number;
  is_archived?: boolean;
  is_active?: boolean;
};

type PizzaGroup = {
  id: string;
  name: string;
  description?: string | null;
  role?: string | null;
  selection_type: "unica" | "multipla" | "quantidade";
  is_required: boolean;
  min_selections: number;
  max_selections: number;
  pricing_strategy: "sum" | "highest_price" | "average_price";
  price_effect: "additive" | "replace_base";
  updated_at: string;
  items?: PizzaItem[];
};

type VariantOptionPrice = {
  variant_id: string;
  item_id: string;
  price: number;
};

type PizzaBuilderPayload = {
  isPizza: boolean;
  variants: PizzaVariant[];
  groups: PizzaGroup[];
  variantOptionPrices: VariantOptionPrice[];
};

type PricingMode = "highest_price" | "average_price";

function priceKey(variantId: string, itemId: string) {
  return `${variantId}:${itemId}`;
}

function parseMoney(value: string): number | null {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatMoneyInput(value: number) {
  return Number(value).toFixed(2).replace(".", ",");
}

export function PizzaSimpleBuilder({ productId }: { productId: string }) {
  const { storeId } = useCatalog();
  const queryClient = useQueryClient();
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [pricingMode, setPricingMode] = useState<PricingMode>("highest_price");
  const [priceMatrix, setPriceMatrix] = useState<Record<string, string>>({});

  const query = useQuery({
    queryKey: ["catalog", "pizza-simple", storeId, productId],
    enabled: Boolean(storeId),
    retry: false,
    queryFn: async () => {
      const [
        { data: profile, error: profileError },
        { data: variants, error: variantsError },
        { data: builder, error: builderError },
      ] = await Promise.all([
        rpc("get_product_engine_profile", { _store_id: storeId, _product_id: productId }),
        rpc("list_product_variants", { _store_id: storeId, _product_id: productId }),
        rpc("get_product_advanced_builder", { _store_id: storeId, _product_id: productId }),
      ]);
      if (profileError) throw new Error(profileError.message);
      if (variantsError) throw new Error(variantsError.message);
      if (builderError) throw new Error(builderError.message);
      const productType = String(profile?.product_type ?? "");
      const capabilities = (profile?.capabilities ?? {}) as Record<string, unknown>;
      const isPizza = productType === "multi_flavor" || capabilities.multi_flavor === true;
      return {
        isPizza,
        variants: ((variants ?? []) as PizzaVariant[]).filter((variant) => !variant.is_archived),
        groups: ((builder?.groups ?? []) as PizzaGroup[]).filter((group) => group.role === "flavor" || group.name.toLowerCase().includes("sabor")),
        variantOptionPrices: (builder?.variant_option_prices ?? []) as VariantOptionPrice[],
      } satisfies PizzaBuilderPayload;
    },
  });

  const flavorGroup = query.data?.groups[0] ?? null;
  const flavorItems = useMemo(
    () => (flavorGroup?.items ?? []).filter((item) => !item.is_archived && item.is_active !== false),
    [flavorGroup?.items],
  );

  useEffect(() => {
    if (!query.data?.isPizza) return;
    const next: Record<string, number> = {};
    for (const variant of query.data.variants) next[variant.id] = Math.max(1, Math.min(4, Number(variant.max_flavors ?? 1)));
    const prices: Record<string, string> = {};
    for (const row of query.data.variantOptionPrices) {
      prices[priceKey(row.variant_id, row.item_id)] = formatMoneyInput(Number(row.price));
    }
    queueMicrotask(() => {
      setLimits(next);
      setPricingMode(flavorGroup?.pricing_strategy === "average_price" ? "average_price" : "highest_price");
      setPriceMatrix(prices);
    });
  }, [query.data, flavorGroup?.pricing_strategy]);

  const maxConfigured = useMemo(() => {
    const values = Object.values(limits);
    return values.length ? Math.max(...values) : 1;
  }, [limits]);

  const save = useMutation({
    mutationFn: async () => {
      if (!storeId) throw new Error("Loja não selecionada.");
      if (!query.data?.isPizza) throw new Error("Este produto não está configurado como pizza.");
      if (query.data.variants.length === 0) throw new Error("Cadastre pelo menos um tamanho para a pizza.");

      for (const variant of query.data.variants) {
        const maxFlavors = Math.max(1, Math.min(4, Math.floor(limits[variant.id] ?? 1)));
        const { error } = await rpc("update_variant_flavor_structure", {
          _store_id: storeId,
          _id: variant.id,
          _max_flavors: maxFlavors,
          _flavor_parts: null,
          _expected_updated_at: variant.updated_at,
        });
        if (error) throw new Error(error.message);

        if (flavorGroup) {
          const { error: ruleError } = await rpc("upsert_product_variant_group_rule", {
            _store_id: storeId,
            _product_id: productId,
            _product_variant_id: variant.id,
            _option_group_id: flavorGroup.id,
            _min_selections: 1,
            _max_selections: maxFlavors,
            _included_selections: 0,
          });
          if (ruleError) throw new Error(ruleError.message);
        }
      }

      if (flavorGroup) {
        const { error: groupError } = await rpc("update_option_group", {
          _store_id: storeId,
          _id: flavorGroup.id,
          _name: flavorGroup.name,
          _description: flavorGroup.description ?? null,
          _selection_type: maxConfigured === 1 ? "unica" : "multipla",
          _is_required: true,
          _min_selections: 1,
          _max_selections: maxConfigured,
          _pricing_strategy: pricingMode,
          _price_effect: "replace_base",
          _portion_count: null,
          _expected_updated_at: flavorGroup.updated_at,
        });
        if (groupError) throw new Error(groupError.message);

        const { error: engineError } = await rpc("update_option_group_engine", {
          _store_id: storeId,
          _id: flavorGroup.id,
          _role: "flavor",
          _included_selections: 0,
          _configuration: { simple_pizza_builder: true, fractional_ui: false },
        });
        if (engineError) throw new Error(engineError.message);
      }
    },
    onSuccess: async () => {
      toast.success("Regras da pizza salvas.");
      await queryClient.invalidateQueries({ queryKey: ["catalog", "pizza-simple", storeId, productId] });
      await queryClient.invalidateQueries({ queryKey: ["catalog", "advanced", storeId, productId] });
      await queryClient.invalidateQueries({ queryKey: ["catalog", "simple-options", storeId, productId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível salvar as regras da pizza."),
  });

  const savePrices = useMutation({
    mutationFn: async () => {
      if (!storeId) throw new Error("Loja não selecionada.");
      if (!flavorGroup) throw new Error("Cadastre o grupo de sabores antes de definir os preços.");
      if (!query.data?.variants.length) throw new Error("Cadastre pelo menos um tamanho para a pizza.");
      if (!flavorItems.length) throw new Error("Cadastre pelo menos um sabor antes de definir os preços.");

      const prices: VariantOptionPrice[] = [];
      for (const variant of query.data.variants) {
        for (const item of flavorItems) {
          const key = priceKey(variant.id, item.id);
          const price = parseMoney(priceMatrix[key] ?? "");
          if (price === null) {
            throw new Error(`Informe um preço válido para ${item.name} no tamanho ${variant.name}.`);
          }
          prices.push({ variant_id: variant.id, item_id: item.id, price });
        }
      }

      const { error } = await rpc("replace_variant_option_prices", {
        _store_id: storeId,
        _product_id: productId,
        _prices: prices,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Preços por sabor e tamanho salvos.");
      await queryClient.invalidateQueries({ queryKey: ["catalog", "pizza-simple", storeId, productId] });
      await queryClient.invalidateQueries({ queryKey: ["catalog", "advanced", storeId, productId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível salvar os preços da pizza."),
  });

  if (query.isLoading || !query.data?.isPizza) return null;
  if (query.isError) return <p className="text-sm text-destructive">Não foi possível carregar a configuração da pizza.</p>;

  return (
    <Card className="border-brand/20">
      <CardHeader>
        <div className="mb-1 grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
          <Pizza className="size-5" />
        </div>
        <CardTitle className="text-lg">Configuração rápida de pizza</CardTitle>
        <CardDescription>
          Defina quantos sabores cada tamanho aceita, como cobrar pizzas mistas e o preço de cada sabor em cada tamanho.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {query.data.variants.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {query.data.variants.map((variant) => (
              <div key={variant.id} className="rounded-xl border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <strong>{variant.name}</strong>
                    <p className="text-xs text-muted-foreground">Preço base: R$ {Number(variant.price).toFixed(2).replace(".", ",")}</p>
                  </div>
                  <div className="w-24">
                    <Label htmlFor={`pizza-flavors-${variant.id}`} className="text-xs">Até quantos sabores?</Label>
                    <Input
                      id={`pizza-flavors-${variant.id}`}
                      type="number"
                      min={1}
                      max={4}
                      value={limits[variant.id] ?? 1}
                      onChange={(event) => setLimits((current) => ({ ...current, [variant.id]: Number(event.target.value) }))}
                    />
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {variant.name}: até {limits[variant.id] ?? 1} {(limits[variant.id] ?? 1) === 1 ? "sabor" : "sabores"}.
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            Esta pizza ainda não tem tamanhos. Cadastre as variações de tamanho para liberar esta configuração.
          </p>
        )}

        <div className="space-y-2">
          <Label>Quando o cliente escolher mais de um sabor:</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant={pricingMode === "highest_price" ? "default" : "outline"}
              className="h-auto justify-start px-4 py-3 text-left"
              onClick={() => setPricingMode("highest_price")}
            >
              <span><strong>Cobrar o sabor mais caro</strong><br /><span className="text-xs opacity-80">Regra mais comum em pizzarias.</span></span>
            </Button>
            <Button
              type="button"
              variant={pricingMode === "average_price" ? "default" : "outline"}
              className="h-auto justify-start px-4 py-3 text-left"
              onClick={() => setPricingMode("average_price")}
            >
              <span><strong>Fazer a média dos sabores</strong><br /><span className="text-xs opacity-80">Calcula a média dos preços escolhidos.</span></span>
            </Button>
          </div>
        </div>

        <Button loading={save.isPending} disabled={!query.data.variants.length} onClick={() => save.mutate()}>
          <Save className="mr-1 size-4" /> Salvar regras da pizza
        </Button>

        {!flavorGroup ? (
          <div className="rounded-xl border border-dashed border-brand/30 bg-brand-soft/20 p-4 text-sm">
            <strong>Cadastre os sabores para concluir.</strong>
            <p className="mt-1 text-muted-foreground">
              Logo abaixo, em “Escolhas e adicionais”, crie o grupo Sabores. Esta tela cuidará dos limites por tamanho e da regra de preço.
            </p>
          </div>
        ) : flavorItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-brand/30 bg-brand-soft/20 p-4 text-sm">
            <strong>Adicione sabores ao grupo.</strong>
            <p className="mt-1 text-muted-foreground">Depois disso a tabela de preços por tamanho aparecerá aqui automaticamente.</p>
          </div>
        ) : query.data.variants.length ? (
          <div className="space-y-3 border-t pt-5">
            <div>
              <Label className="text-base">Preço de cada sabor por tamanho</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Informe o preço final da pizza para cada combinação. Ex.: Portuguesa Média R$ 47,00 e Portuguesa Grande R$ 62,00.
              </p>
            </div>

            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Sabor</th>
                    {query.data.variants.map((variant) => (
                      <th key={variant.id} className="px-3 py-3 text-left font-medium">{variant.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {flavorItems.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="px-4 py-3 font-medium">{item.name}</td>
                      {query.data.variants.map((variant) => {
                        const key = priceKey(variant.id, item.id);
                        return (
                          <td key={variant.id} className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">R$</span>
                              <Input
                                className="min-w-28"
                                inputMode="decimal"
                                value={priceMatrix[key] ?? ""}
                                placeholder={formatMoneyInput(Number(variant.price))}
                                onChange={(event) => setPriceMatrix((current) => ({ ...current, [key]: event.target.value }))}
                              />
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-muted-foreground">
              A Comandiva usa esses valores como preços completos do sabor naquele tamanho. Nenhuma soma escondida é aplicada ao preço base.
            </p>

            <Button loading={savePrices.isPending} onClick={() => savePrices.mutate()}>
              <Save className="mr-1 size-4" /> Salvar preços dos sabores
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
