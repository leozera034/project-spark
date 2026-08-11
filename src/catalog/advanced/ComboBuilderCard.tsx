import { useQuery } from "@tanstack/react-query";
import { Boxes, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatPriceBRL, parsePriceInput } from "../types";
import { useCatalog } from "../CatalogProvider";
import type { AdvancedBuilder } from "../advanced-types";
import {
  createComboChoice,
  createProductOptionGroupFromTemplate,
  listComboCatalogCandidates,
} from "../shark-groups.api";

export function ComboBuilderCard({ builder, onSaved }: { builder: AdvancedBuilder; onSaved: () => void }) {
  const { storeId, run, isBusy } = useCatalog();
  const isCombo = builder.product.product_type === "combo" || Boolean(builder.product.capabilities?.combo_steps);
  const [stepName, setStepName] = useState("");
  const [choiceDrafts, setChoiceDrafts] = useState<Record<string, { productId: string; variantId: string; label: string; price: string }>>({});

  const candidates = useQuery({
    queryKey: ["catalog", "combo-candidates", storeId, builder.product.id],
    queryFn: () => listComboCatalogCandidates(storeId!, builder.product.id),
    enabled: Boolean(storeId) && isCombo,
  });

  const steps = useMemo(() => builder.groups.filter((group) => group.role === "combo_step"), [builder.groups]);
  if (!isCombo || !builder.can.update || builder.product.is_archived) return null;

  const createStep = async () => {
    if (!storeId || stepName.trim().length < 2) return;
    const result = await run(() => createProductOptionGroupFromTemplate({
      storeId,
      productId: builder.product.id,
      name: stepName.trim(),
      role: "combo_step",
      required: true,
      min: 1,
      max: 1,
      included: 0,
      selectionType: "unica",
      configuration: { combo_step: true },
    }), "Etapa do combo criada.");
    if (result) {
      setStepName("");
      onSaved();
    }
  };

  const draftFor = (groupId: string) => choiceDrafts[groupId] ?? { productId: "", variantId: "", label: "", price: "0,00" };

  const addChoice = async (groupId: string) => {
    if (!storeId) return;
    const draft = draftFor(groupId);
    const candidate = candidates.data?.find((item) => item.id === draft.productId);
    if (!candidate) return;
    const variant = draft.variantId ? candidate.variants.find((item) => item.id === draft.variantId) : null;
    const price = parsePriceInput(draft.price);
    if (price === null || price < 0) return;
    const label = draft.label.trim() || `${candidate.name}${variant ? ` · ${variant.name}` : ""}`;
    const result = await run(() => createComboChoice({
      storeId,
      groupId,
      name: label,
      linkedProductId: candidate.id,
      linkedVariantId: variant?.id ?? null,
      priceDifference: price,
    }), "Opção adicionada ao combo.");
    if (result) {
      setChoiceDrafts((prev) => ({ ...prev, [groupId]: { productId: "", variantId: "", label: "", price: "0,00" } }));
      onSaved();
    }
  };

  return (
    <Card className="border-violet-400/20">
      <CardHeader>
        <div className="mb-2 flex items-center gap-2"><Boxes className="size-4 text-violet-500" /><Badge variant="outline">Combo estruturado</Badge></div>
        <CardTitle className="text-base">Construtor visual de combo</CardTitle>
        <CardDescription>
          Cada etapa é um grupo obrigatório e cada opção aponta para um produto real do cardápio. A diferença de preço é validada no backend.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-col gap-2 rounded-2xl border border-dashed p-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5"><Label>Nova etapa</Label><Input value={stepName} onChange={(e) => setStepName(e.target.value)} placeholder="Ex.: Escolha sua bebida" /></div>
          <Button disabled={isBusy || stepName.trim().length < 2} onClick={() => void createStep()}><Plus className="size-4" /> Criar etapa</Button>
        </div>

        {steps.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ainda não há etapas. Crie a primeira para transformar este produto em um combo configurável.</p>
        ) : (
          <div className="space-y-4">
            {steps.map((step, index) => {
              const draft = draftFor(step.id);
              const selectedProduct = candidates.data?.find((item) => item.id === draft.productId) ?? null;
              return (
                <div key={step.id} className="space-y-3 rounded-2xl border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><p className="font-semibold">{index + 1}. {step.name}</p><p className="text-xs text-muted-foreground">Obrigatório · escolha {step.max_selections === 1 ? "1" : `até ${step.max_selections}`}</p></div>
                    <Badge variant="secondary">{step.items.filter((item) => item.is_active && !item.is_archived).length} opção(ões)</Badge>
                  </div>

                  {step.items.length > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {step.items.filter((item) => !item.is_archived).map((item) => {
                        const product = candidates.data?.find((candidate) => candidate.id === item.linked_product_id);
                        const variant = product?.variants.find((candidate) => candidate.id === item.linked_variant_id);
                        return <div key={item.id} className="rounded-xl border border-border bg-muted/20 p-3"><p className="text-sm font-medium">{item.name}</p><p className="mt-1 text-xs text-muted-foreground">{product ? product.name : "Produto não vinculado"}{variant ? ` · ${variant.name}` : ""}</p><p className="mt-1 text-xs font-semibold">{item.additional_price > 0 ? `+ ${formatPriceBRL(item.additional_price)}` : "Incluso"}</p></div>;
                      })}
                    </div>
                  ) : null}

                  <div className="grid gap-3 rounded-xl bg-muted/25 p-3 lg:grid-cols-[1fr_1fr_1fr_160px_auto] lg:items-end">
                    <div className="space-y-1.5"><Label>Produto permitido</Label><Select value={draft.productId} onValueChange={(value) => setChoiceDrafts((prev) => ({ ...prev, [step.id]: { ...draft, productId: value, variantId: "" } }))}><SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger><SelectContent>{(candidates.data ?? []).map((item) => <SelectItem key={item.id} value={item.id}>{item.name}{!item.is_available || item.is_sold_out ? " (indisponível)" : ""}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1.5"><Label>Variação específica</Label><Select value={draft.variantId || "__default"} disabled={!selectedProduct || selectedProduct.variants.length === 0} onValueChange={(value) => setChoiceDrafts((prev) => ({ ...prev, [step.id]: { ...draft, variantId: value === "__default" ? "" : value } }))}><SelectTrigger><SelectValue placeholder="Padrão" /></SelectTrigger><SelectContent><SelectItem value="__default">Produto / padrão</SelectItem>{selectedProduct?.variants.map((variant) => <SelectItem key={variant.id} value={variant.id}>{variant.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1.5"><Label>Nome exibido</Label><Input value={draft.label} onChange={(e) => setChoiceDrafts((prev) => ({ ...prev, [step.id]: { ...draft, label: e.target.value } }))} placeholder={selectedProduct?.name ?? "Ex.: Coca-Cola 600 ml"} /></div>
                    <div className="space-y-1.5"><Label>Diferença de preço</Label><Input inputMode="decimal" value={draft.price} onChange={(e) => setChoiceDrafts((prev) => ({ ...prev, [step.id]: { ...draft, price: e.target.value } }))} placeholder="0,00" /></div>
                    <Button disabled={isBusy || !draft.productId || parsePriceInput(draft.price) === null} onClick={() => void addChoice(step.id)}>Adicionar</Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
