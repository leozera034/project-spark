import { useState } from "react";
import { Plus, Star, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  archiveVariant,
  createVariant,
  setDefaultVariant,
  updateVariant,
} from "../advanced-api";
import type { AdvancedBuilder, ProductVariant } from "../advanced-types";
import { useCatalog } from "../CatalogProvider";
import { updateVariantFlavorStructure } from "../shark-variants.api";
import { formatPriceBRL, parsePriceInput } from "../types";

type Draft = { name: string; price: string; maxFlavors: string; flavorParts: string };
const EMPTY: Draft = { name: "", price: "", maxFlavors: "", flavorParts: "" };

function parsePositive(value: string) {
  if (!value.trim()) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 20 ? parsed : undefined;
}

function variantParts(variant: ProductVariant) {
  return variant.flavor_parts ?? variant.max_flavors ?? null;
}

export function SizeVariantsCard({ builder, onSaved }: { builder: AdvancedBuilder; onSaved: () => void }) {
  const { storeId, run, isBusy } = useCatalog();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Draft>(EMPTY);

  const product = builder.product;
  const multiFlavor = Boolean(product.capabilities?.multi_flavor);
  const visible = builder.variants.filter((variant) => !variant.is_archived);

  function flavorRules(d: Draft) {
    const maxFlavors = parsePositive(d.maxFlavors);
    const flavorParts = parsePositive(d.flavorParts);
    const valid = !multiFlavor || (
      maxFlavors !== undefined && flavorParts !== undefined &&
      maxFlavors !== null && flavorParts !== null && maxFlavors <= flavorParts
    );
    return { maxFlavors, flavorParts, valid };
  }

  async function addSize() {
    if (!storeId || !draft.name.trim()) return;
    const price = parsePriceInput(draft.price);
    const rules = flavorRules(draft);
    if (price === null || !rules.valid) return;

    const created = await run(async () => {
      const variant = await createVariant({
        storeId,
        productId: product.id,
        name: draft.name.trim(),
        price,
        packageQuantity: null,
        packageUnit: null,
        isDefault: visible.length === 0,
      });
      if (multiFlavor) {
        return updateVariantFlavorStructure({
          storeId,
          id: variant.id,
          maxFlavors: rules.maxFlavors ?? null,
          flavorParts: rules.flavorParts ?? null,
          expectedUpdatedAt: variant.updated_at,
        });
      }
      return variant;
    }, "Tamanho adicionado.");

    if (created) {
      setDraft(EMPTY);
      onSaved();
    }
  }

  async function saveSize(variant: ProductVariant) {
    if (!storeId || !edit.name.trim()) return;
    const price = parsePriceInput(edit.price);
    const rules = flavorRules(edit);
    if (price === null || !rules.valid) return;

    const saved = await run(async () => {
      const base = await updateVariant({
        storeId,
        id: variant.id,
        name: edit.name.trim(),
        price,
        packageQuantity: null,
        packageUnit: null,
        expectedUpdatedAt: variant.updated_at,
      });
      if (multiFlavor) {
        return updateVariantFlavorStructure({
          storeId,
          id: variant.id,
          maxFlavors: rules.maxFlavors ?? null,
          flavorParts: rules.flavorParts ?? null,
          expectedUpdatedAt: base.updated_at,
        });
      }
      return base;
    }, "Tamanho atualizado.");

    if (saved) {
      setEditingId(null);
      onSaved();
    }
  }

  function startEdit(variant: ProductVariant) {
    setEditingId(variant.id);
    setEdit({
      name: variant.name,
      price: String(variant.price).replace(".", ","),
      maxFlavors: variant.max_flavors ? String(variant.max_flavors) : "",
      flavorParts: variantParts(variant) ? String(variantParts(variant)) : "",
    });
  }

  function flavorFields(value: Draft, setValue: (next: Draft) => void) {
    if (!multiFlavor) return null;
    const rules = flavorRules(value);
    return (
      <>
        <div className="space-y-1.5">
          <Label>Até quantos sabores</Label>
          <Input type="number" min={1} max={20} value={value.maxFlavors} onChange={(event) => setValue({ ...value, maxFlavors: event.target.value })} placeholder="2" />
        </div>
        <div className="space-y-1.5">
          <Label>Dividir em partes</Label>
          <Input type="number" min={1} max={20} value={value.flavorParts} onChange={(event) => setValue({ ...value, flavorParts: event.target.value })} placeholder="2" />
          {!rules.valid && value.maxFlavors && value.flavorParts ? <p className="text-[11px] text-destructive">O número de sabores não pode ser maior que o de partes.</p> : null}
        </div>
      </>
    );
  }

  return (
    <Card className="overflow-hidden border-violet-400/15 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,.09),transparent_42%),var(--card)]">
      <CardHeader>
        <CardTitle className="text-base">Tamanhos e preços</CardTitle>
        <CardDescription>
          Cadastre do jeito que você fala no balcão. O Shark cuida da variação técnica por trás.
          {multiFlavor ? " Em produtos multi-sabor, defina quantos sabores diferentes cabem e em quantas partes o tamanho pode ser dividido." : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Nenhum tamanho ainda. Exemplo: Pequena, Média e Grande.
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map((variant) => (
              <div key={variant.id} className="rounded-2xl border border-border bg-background/25 p-3">
                {editingId === variant.id ? (
                  <div className={`grid gap-3 ${multiFlavor ? "sm:grid-cols-2 lg:grid-cols-[1fr_150px_150px_150px_auto]" : "sm:grid-cols-[1fr_160px_auto]"} sm:items-end`}>
                    <div className="space-y-1.5"><Label>Nome</Label><Input value={edit.name} onChange={(event) => setEdit({ ...edit, name: event.target.value })} /></div>
                    <div className="space-y-1.5"><Label>Preço</Label><Input inputMode="decimal" value={edit.price} onChange={(event) => setEdit({ ...edit, price: event.target.value })} /></div>
                    {flavorFields(edit, setEdit)}
                    <div className="flex gap-2"><Button size="sm" disabled={isBusy || !flavorRules(edit).valid} onClick={() => void saveSize(variant)}>Salvar</Button><Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancelar</Button></div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{variant.name}</p>
                        {variant.is_default ? <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/12 px-2 py-0.5 text-[11px] font-semibold text-violet-200"><Star className="size-3" />Padrão</span> : null}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span>{formatPriceBRL(variant.price)}</span>
                        {multiFlavor ? <span>{variant.max_flavors ? `até ${variant.max_flavors} sabor${variant.max_flavors > 1 ? "es" : ""}` : "sabores sem limite específico"}</span> : null}
                        {multiFlavor && variantParts(variant) ? <span>{variantParts(variant)} parte{variantParts(variant)! > 1 ? "s" : ""}</span> : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => startEdit(variant)}>Editar</Button>
                      {!variant.is_default ? <Button size="sm" variant="ghost" disabled={isBusy} onClick={() => void run(() => setDefaultVariant(storeId!, variant.id, variant.updated_at), "Tamanho padrão atualizado.").then(onSaved)}>Usar como padrão</Button> : null}
                      {builder.can.archive ? <Button size="icon" variant="ghost" aria-label={`Remover tamanho ${variant.name}`} disabled={isBusy} onClick={() => void run(() => archiveVariant(storeId!, variant.id, true, variant.updated_at), "Tamanho removido.").then(onSaved)}><Trash2 className="size-4" /></Button> : null}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-border pt-4">
          <p className="mb-3 text-sm font-semibold">Adicionar tamanho</p>
          <div className={`grid gap-3 ${multiFlavor ? "sm:grid-cols-2 lg:grid-cols-[1fr_150px_150px_150px_auto]" : "sm:grid-cols-[1fr_160px_auto]"} sm:items-end`}>
            <div className="space-y-1.5"><Label>Nome</Label><Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Ex.: Grande" /></div>
            <div className="space-y-1.5"><Label>Preço</Label><Input inputMode="decimal" value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} placeholder="49,90" /></div>
            {flavorFields(draft, setDraft)}
            <Button disabled={isBusy || !draft.name.trim() || parsePriceInput(draft.price) === null || !flavorRules(draft).valid} onClick={() => void addSize()}><Plus className="mr-1.5 size-4" />Adicionar</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
