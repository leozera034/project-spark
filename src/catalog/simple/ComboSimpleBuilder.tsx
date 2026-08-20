import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useCatalog } from "@/catalog/CatalogProvider";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = supabase.rpc.bind(supabase) as any;

type CandidateVariant = { id: string; name: string; price: number; is_default?: boolean };
type CandidateProduct = {
  id: string;
  name: string;
  base_price: number;
  has_variants?: boolean;
  variants?: CandidateVariant[];
};

type ComboItem = {
  id: string;
  name: string;
  additional_price: number;
  linked_product_id?: string | null;
  linked_variant_id?: string | null;
};

type ComboGroup = {
  id: string;
  name: string;
  role?: string | null;
  is_required: boolean;
  min_selections: number;
  max_selections: number;
  included_selections?: number;
  updated_at: string;
  items: ComboItem[];
};

type DraftChoice = {
  key: string;
  productId: string;
  variantId: string;
  priceDifference: string;
};

function parseMoney(value: string) {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized || 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function formatMoney(value: number) {
  return Number(value || 0).toFixed(2).replace(".", ",");
}

export function ComboSimpleBuilder({ productId }: { productId: string }) {
  const { storeId } = useCatalog();
  const queryClient = useQueryClient();
  const [stepName, setStepName] = useState("Escolha uma opção");
  const [required, setRequired] = useState(true);
  const [min, setMin] = useState(1);
  const [max, setMax] = useState(1);
  const [included, setIncluded] = useState(1);
  const [choices, setChoices] = useState<DraftChoice[]>([
    { key: crypto.randomUUID(), productId: "", variantId: "", priceDifference: "0,00" },
  ]);

  const query = useQuery({
    queryKey: ["catalog", "combo-simple", storeId, productId],
    enabled: Boolean(storeId),
    retry: false,
    queryFn: async () => {
      const [{ data: profile, error: profileError }, { data: builder, error: builderError }, { data: candidates, error: candidatesError }] = await Promise.all([
        rpc("get_product_engine_profile", { _store_id: storeId, _product_id: productId }),
        rpc("get_product_advanced_builder", { _store_id: storeId, _product_id: productId }),
        rpc("list_combo_catalog_candidates", { _store_id: storeId, _exclude_product_id: productId }),
      ]);
      if (profileError) throw new Error(profileError.message);
      if (builderError) throw new Error(builderError.message);
      if (candidatesError) throw new Error(candidatesError.message);
      const productType = String(profile?.product_type ?? "");
      const capabilities = (profile?.capabilities ?? {}) as Record<string, unknown>;
      const isCombo = productType === "combo" || productType === "kit" || capabilities.combo_steps === true;
      return {
        isCombo,
        groups: ((builder?.groups ?? []) as ComboGroup[]).filter((group) => group.role === "combo_step"),
        candidates: (candidates ?? []) as CandidateProduct[],
      };
    },
  });

  const candidateMap = useMemo(
    () => new Map((query.data?.candidates ?? []).map((candidate) => [candidate.id, candidate])),
    [query.data?.candidates],
  );

  const createStep = useMutation({
    mutationFn: async () => {
      if (!storeId) throw new Error("Loja não selecionada.");
      if (!query.data?.isCombo) throw new Error("Este produto não está configurado como combo.");
      if (stepName.trim().length < 2) throw new Error("Dê um nome para esta etapa.");

      const safeMin = required ? Math.max(1, Math.floor(min || 1)) : Math.max(0, Math.floor(min || 0));
      const safeMax = Math.max(safeMin || 1, Math.floor(max || 1));
      const safeIncluded = Math.max(0, Math.min(safeMax, Math.floor(included || 0)));
      const validChoices = choices.filter((choice) => choice.productId && parseMoney(choice.priceDifference) !== null);
      if (validChoices.length === 0) throw new Error("Selecione pelo menos um produto para esta etapa.");

      const { data: group, error: groupError } = await rpc("create_product_option_group_from_template", {
        _store_id: storeId,
        _product_id: productId,
        _name: stepName.trim(),
        _role: "combo_step",
        _required: required,
        _min: safeMin,
        _max: safeMax,
        _included: safeIncluded,
        _selection_type: safeMax === 1 ? "unica" : "multipla",
        _portion_count: null,
        _configuration: { simple_combo_builder: true },
      });
      if (groupError) throw new Error(groupError.message);
      const groupId = group?.id;
      if (!groupId) throw new Error("Não foi possível criar a etapa do combo.");

      for (const choice of validChoices) {
        const candidate = candidateMap.get(choice.productId);
        if (!candidate) continue;
        const variant = choice.variantId ? candidate.variants?.find((item) => item.id === choice.variantId) : undefined;
        const label = variant ? `${candidate.name} — ${variant.name}` : candidate.name;
        const { error } = await rpc("create_combo_choice", {
          _store_id: storeId,
          _group_id: groupId,
          _name: label,
          _linked_product_id: candidate.id,
          _linked_variant_id: variant?.id ?? null,
          _price_difference: parseMoney(choice.priceDifference) ?? 0,
        });
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: async () => {
      toast.success("Etapa adicionada ao combo.");
      setStepName("Escolha uma opção");
      setRequired(true);
      setMin(1);
      setMax(1);
      setIncluded(1);
      setChoices([{ key: crypto.randomUUID(), productId: "", variantId: "", priceDifference: "0,00" }]);
      await queryClient.invalidateQueries({ queryKey: ["catalog", "combo-simple", storeId, productId] });
      await queryClient.invalidateQueries({ queryKey: ["catalog", "advanced", storeId, productId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível criar a etapa do combo."),
  });

  const removeStep = useMutation({
    mutationFn: async (group: ComboGroup) => {
      if (!storeId) throw new Error("Loja não selecionada.");
      const { error: detachError } = await rpc("detach_option_group_from_product", {
        _store_id: storeId,
        _product_id: productId,
        _option_group_id: group.id,
      });
      if (detachError) throw new Error(detachError.message);
      const { error: archiveError } = await rpc("archive_option_group", {
        _store_id: storeId,
        _id: group.id,
        _archived: true,
        _expected_updated_at: group.updated_at,
      });
      if (archiveError) throw new Error(archiveError.message);
    },
    onSuccess: async () => {
      toast.success("Etapa removida do combo.");
      await queryClient.invalidateQueries({ queryKey: ["catalog", "combo-simple", storeId, productId] });
      await queryClient.invalidateQueries({ queryKey: ["catalog", "advanced", storeId, productId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível remover a etapa."),
  });

  if (query.isLoading || !query.data?.isCombo) return null;
  if (query.isError) return <p className="text-sm text-destructive">Não foi possível carregar a configuração do combo.</p>;

  return (
    <div className="space-y-4">
      <Card className="border-brand/20">
        <CardHeader>
          <div className="mb-1 grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
            <Boxes className="size-5" />
          </div>
          <CardTitle className="text-lg">Montar combo por etapas</CardTitle>
          <CardDescription>
            Crie etapas como “Escolha o lanche”, “Escolha o acompanhamento” e “Escolha a bebida”. Cada opção pode apontar para um produto real do seu cardápio.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label>Nome da etapa</Label>
            <Input value={stepName} onChange={(event) => setStepName(event.target.value)} placeholder="Ex.: Escolha a bebida" />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Mínimo</Label>
              <Input type="number" min={0} max={20} value={min} onChange={(event) => setMin(Number(event.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Máximo</Label>
              <Input type="number" min={1} max={20} value={max} onChange={(event) => setMax(Number(event.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Quantos já estão inclusos?</Label>
              <Input type="number" min={0} max={max} value={included} onChange={(event) => setIncluded(Number(event.target.value))} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch id="combo-step-required" checked={required} onCheckedChange={(value) => setRequired(Boolean(value))} />
            <Label htmlFor="combo-step-required">Esta etapa é obrigatória</Label>
          </div>

          <div className="space-y-3">
            <div>
              <Label>Produtos disponíveis nesta etapa</Label>
              <p className="text-xs text-muted-foreground">Escolha produtos do próprio cardápio e informe apenas um acréscimo, se houver.</p>
            </div>
            {choices.map((choice) => {
              const candidate = candidateMap.get(choice.productId);
              return (
                <div key={choice.key} className="grid gap-2 rounded-xl border p-3 lg:grid-cols-[1.3fr_1fr_150px_auto]">
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={choice.productId}
                    onChange={(event) => setChoices((current) => current.map((row) => row.key === choice.key ? { ...row, productId: event.target.value, variantId: "" } : row))}
                  >
                    <option value="">Selecione um produto</option>
                    {query.data?.candidates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>

                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={choice.variantId}
                    disabled={!candidate?.variants?.length}
                    onChange={(event) => setChoices((current) => current.map((row) => row.key === choice.key ? { ...row, variantId: event.target.value } : row))}
                  >
                    <option value="">{candidate?.variants?.length ? "Qualquer tamanho" : "Sem variações"}</option>
                    {candidate?.variants?.map((variant) => <option key={variant.id} value={variant.id}>{variant.name}</option>)}
                  </select>

                  <Input
                    inputMode="decimal"
                    value={choice.priceDifference}
                    onChange={(event) => setChoices((current) => current.map((row) => row.key === choice.key ? { ...row, priceDifference: event.target.value } : row))}
                    placeholder="Acréscimo 0,00"
                  />

                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Remover produto desta etapa"
                    disabled={choices.length === 1}
                    onClick={() => setChoices((current) => current.filter((row) => row.key !== choice.key))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              );
            })}

            <Button type="button" variant="outline" onClick={() => setChoices((current) => [...current, { key: crypto.randomUUID(), productId: "", variantId: "", priceDifference: "0,00" }])}>
              <Plus className="mr-1 size-4" /> Adicionar outro produto
            </Button>
          </div>

          <Button loading={createStep.isPending} onClick={() => createStep.mutate()}>
            Adicionar etapa ao combo
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Etapas já configuradas</CardTitle>
          <CardDescription>O cliente verá estas etapas nesta ordem ao montar o combo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(query.data?.groups.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma etapa criada ainda.</p>
          ) : (
            query.data?.groups.map((group, index) => (
              <div key={group.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <strong>{index + 1}. {group.name}</strong>
                    <p className="text-xs text-muted-foreground">
                      {group.is_required ? "Obrigatória" : "Opcional"} · escolha de {group.min_selections} até {group.max_selections} · {group.included_selections ?? 0} incluso(s)
                    </p>
                  </div>
                  <Button type="button" size="sm" variant="ghost" onClick={() => removeStep.mutate(group)}>
                    <Trash2 className="mr-1 size-4" /> Remover etapa
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <span key={item.id} className="rounded-full border px-3 py-1 text-xs">
                      {item.name}{Number(item.additional_price) > 0 ? ` + R$ ${formatMoney(item.additional_price)}` : ""}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
