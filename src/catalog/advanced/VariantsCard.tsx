import { useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  archiveVariant,
  createVariant,
  reorderVariants,
  setDefaultVariant,
  setVariantActive,
  updateVariant,
} from "../advanced-api";
import {
  MEASUREMENT_SHORT,
  type AdvancedBuilder,
  type MeasurementUnit,
  type ProductVariant,
} from "../advanced-types";
import { useCatalog } from "../CatalogProvider";
import { formatPriceBRL, parsePriceInput } from "../types";

const PACKAGE_UNITS: MeasurementUnit[] = ["kg", "g", "l", "ml"];

interface Draft {
  name: string;
  price: string;
  packageQuantity: string;
  packageUnit: string;
}

const EMPTY: Draft = { name: "", price: "", packageQuantity: "", packageUnit: "none" };

export function VariantsCard({
  builder,
  onSaved,
}: {
  builder: AdvancedBuilder;
  onSaved: () => void;
}) {
  const { storeId, run, isBusy } = useCatalog();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY);

  const product = builder.product;
  const canUpdate = builder.can.update && !product.is_archived;
  const canCreate = builder.can.create && !product.is_archived;
  const measured = product.sale_mode === "measured";
  const packageRequired = product.sale_mode === "fixed_package";

  const visible = builder.variants.filter((v) => !v.is_archived);
  const archived = builder.variants.filter((v) => v.is_archived);

  function parseDraft(d: Draft) {
    const price = parsePriceInput(d.price);
    const quantity =
      d.packageQuantity.trim() === "" ? null : Number(d.packageQuantity.replace(",", "."));
    const unit = d.packageUnit === "none" ? null : (d.packageUnit as MeasurementUnit);
    return { price, quantity, unit };
  }

  async function add() {
    if (!storeId) return;
    const { price, quantity, unit } = parseDraft(draft);
    if (price === null || draft.name.trim() === "") return;
    const created = await run(
      () =>
        createVariant({
          storeId,
          productId: product.id,
          name: draft.name.trim(),
          price,
          packageQuantity: unit ? quantity : null,
          packageUnit: unit,
          isDefault: visible.length === 0,
        }),
      "Variação criada.",
    );
    if (created) {
      setDraft(EMPTY);
      onSaved();
    }
  }

  async function saveEdit(variant: ProductVariant) {
    if (!storeId) return;
    const { price, quantity, unit } = parseDraft(editDraft);
    if (price === null || editDraft.name.trim() === "") return;
    const saved = await run(
      () =>
        updateVariant({
          storeId,
          id: variant.id,
          name: editDraft.name.trim(),
          price,
          packageQuantity: unit ? quantity : null,
          packageUnit: unit,
          expectedUpdatedAt: variant.updated_at,
        }),
      "Variação atualizada.",
    );
    if (saved) {
      setEditingId(null);
      onSaved();
    }
  }

  async function move(index: number, delta: number) {
    if (!storeId) return;
    const next = [...visible];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    const done = await run(
      () =>
        reorderVariants(
          storeId,
          product.id,
          next.map((v) => v.id),
        ),
      "Ordem atualizada.",
    );
    if (done) onSaved();
  }

  function fields(d: Draft, set: (next: Draft) => void, prefix: string) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor={`${prefix}-nome`}>Nome</Label>
          <Input
            id={`${prefix}-nome`}
            value={d.name}
            maxLength={80}
            placeholder="Ex.: Grande, 500 g, Pote 1 L"
            onChange={(e) => set({ ...d, name: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-preco`}>Preço</Label>
          <Input
            id={`${prefix}-preco`}
            inputMode="decimal"
            value={d.price}
            placeholder="0,00"
            onChange={(e) => set({ ...d, price: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-emb`}>Embalagem</Label>
          <div className="flex gap-2">
            <Input
              id={`${prefix}-emb`}
              inputMode="decimal"
              className="w-24"
              value={d.packageQuantity}
              placeholder="500"
              onChange={(e) => set({ ...d, packageQuantity: e.target.value })}
            />
            <Select value={d.packageUnit} onValueChange={(v) => set({ ...d, packageUnit: v })}>
              <SelectTrigger aria-label="Unidade da embalagem">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem peso fixo</SelectItem>
                {PACKAGE_UNITS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {MEASUREMENT_SHORT[u]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Variações e tamanhos</CardTitle>
        <CardDescription>
          Cada variação tem preço próprio. Uma delas é a padrão e aparece pré-selecionada.
          {packageRequired ? " Neste modo, toda variação precisa de peso ou volume fixo." : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {measured ? (
          <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            Produtos vendidos por peso ou volume não usam variações. Troque o modo de venda para
            cadastrar tamanhos.
          </p>
        ) : (
          <>
            {visible.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma variação cadastrada. Sem variações, o produto usa apenas o preço base.
              </p>
            ) : (
              <ul className="space-y-2">
                {visible.map((variant, index) => (
                  <li key={variant.id} className="rounded-lg border border-border p-3">
                    {editingId === variant.id ? (
                      <div className="space-y-3">
                        {fields(editDraft, setEditDraft, `var-edit-${variant.id}`)}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={isBusy}
                            onClick={() => void saveEdit(variant)}
                          >
                            Salvar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-foreground">{variant.name}</span>
                            {variant.is_default ? <Badge>Padrão</Badge> : null}
                            {variant.is_active ? null : <Badge variant="secondary">Inativa</Badge>}
                          </div>
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {formatPriceBRL(variant.price)}
                            {variant.package_quantity && variant.package_unit
                              ? ` · ${variant.package_quantity} ${MEASUREMENT_SHORT[variant.package_unit]}`
                              : ""}
                          </p>
                        </div>

                        {canUpdate ? (
                          <div className="flex flex-wrap items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Mover para cima"
                              disabled={isBusy || index === 0}
                              onClick={() => void move(index, -1)}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Mover para baixo"
                              disabled={isBusy || index === visible.length - 1}
                              onClick={() => void move(index, 1)}
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingId(variant.id);
                                setEditDraft({
                                  name: variant.name,
                                  price: String(variant.price).replace(".", ","),
                                  packageQuantity: variant.package_quantity
                                    ? String(variant.package_quantity)
                                    : "",
                                  packageUnit: variant.package_unit ?? "none",
                                });
                              }}
                            >
                              Editar
                            </Button>
                            {!variant.is_default && variant.is_active ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={isBusy}
                                onClick={() =>
                                  void run(
                                    () =>
                                      setDefaultVariant(storeId!, variant.id, variant.updated_at),
                                    "Variação padrão definida.",
                                  ).then(onSaved)
                                }
                              >
                                Tornar padrão
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={isBusy}
                              onClick={() =>
                                void run(
                                  () =>
                                    setVariantActive(
                                      storeId!,
                                      variant.id,
                                      !variant.is_active,
                                      variant.updated_at,
                                    ),
                                  variant.is_active ? "Variação desativada." : "Variação ativada.",
                                ).then(onSaved)
                              }
                            >
                              {variant.is_active ? "Desativar" : "Ativar"}
                            </Button>
                            {builder.can.archive ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={isBusy}
                                onClick={() =>
                                  void run(
                                    () =>
                                      archiveVariant(
                                        storeId!,
                                        variant.id,
                                        true,
                                        variant.updated_at,
                                      ),
                                    "Variação arquivada.",
                                  ).then(onSaved)
                                }
                              >
                                Arquivar
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {archived.length > 0 ? (
              <details className="rounded-lg border border-dashed border-border p-3">
                <summary className="cursor-pointer text-sm text-muted-foreground">
                  {archived.length} variação(ões) arquivada(s)
                </summary>
                <ul className="mt-2 space-y-2">
                  {archived.map((variant) => (
                    <li key={variant.id} className="flex items-center justify-between gap-2">
                      <span className="text-sm text-muted-foreground">{variant.name}</span>
                      {builder.can.archive ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isBusy}
                          onClick={() =>
                            void run(
                              () => archiveVariant(storeId!, variant.id, false, variant.updated_at),
                              "Variação restaurada.",
                            ).then(onSaved)
                          }
                        >
                          Restaurar
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            {canCreate ? (
              <div className="space-y-3 border-t border-border pt-4">
                <p className="text-sm font-medium text-foreground">Nova variação</p>
                {fields(draft, setDraft, "var-new")}
                <Button
                  disabled={
                    isBusy || draft.name.trim() === "" || parsePriceInput(draft.price) === null
                  }
                  onClick={() => void add()}
                >
                  Adicionar variação
                </Button>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
