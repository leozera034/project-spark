import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import {
  archiveOptionGroup,
  archiveOptionItem,
  createOptionGroup,
  createOptionItem,
  listOptionGroups,
  setOptionGroupActive,
  setOptionItemActive,
  updateOptionGroup,
  type OptionGroupInput,
} from "../advanced-api";
import { catalogErrorMessage } from "../api";
import {
  PRICE_EFFECT_LABELS,
  PRICING_STRATEGY_LABELS,
  SELECTION_TYPE_LABELS,
  type OptionGroup,
  type OptionSelectionType,
  type PriceEffect,
  type PricingStrategy,
} from "../advanced-types";
import { useCatalog } from "../CatalogProvider";
import { formatPriceBRL, parsePriceInput } from "../types";

interface GroupDraft extends OptionGroupInput {
  portionEnabled: boolean;
}

const EMPTY_GROUP: GroupDraft = {
  name: "",
  description: "",
  selectionType: "unica",
  isRequired: false,
  minSelections: 0,
  maxSelections: 1,
  pricingStrategy: "sum",
  priceEffect: "additive",
  portionCount: null,
  portionEnabled: false,
};

function toDraft(group: OptionGroup): GroupDraft {
  return {
    name: group.name,
    description: group.description ?? "",
    selectionType: group.selection_type,
    isRequired: group.is_required,
    minSelections: group.min_selections,
    maxSelections: group.max_selections,
    pricingStrategy: group.pricing_strategy,
    priceEffect: group.price_effect,
    portionCount: group.portion_count,
    portionEnabled: group.portion_count !== null,
  };
}

function toInput(draft: GroupDraft): OptionGroupInput {
  return {
    name: draft.name.trim(),
    description: draft.description.trim(),
    selectionType: draft.selectionType,
    isRequired: draft.isRequired,
    minSelections: draft.minSelections,
    maxSelections: draft.maxSelections,
    pricingStrategy: draft.pricingStrategy,
    priceEffect: draft.priceEffect,
    portionCount: draft.portionEnabled ? (draft.portionCount ?? 2) : null,
  };
}

export function OptionGroupLibrary() {
  const { storeId, overview, run, isBusy } = useCatalog();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<GroupDraft>(EMPTY_GROUP);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<GroupDraft>(EMPTY_GROUP);
  const [itemDrafts, setItemDrafts] = useState<Record<string, { name: string; price: string; max: string }>>({});

  const can = overview?.can ?? { view: true, create: false, update: false, archive: false };

  const query = useQuery({
    queryKey: ["catalog", "option-groups", storeId, true],
    queryFn: () => listOptionGroups(storeId, true),
    enabled: Boolean(storeId),
    retry: false,
  });

  if (query.isLoading) return <Skeleton className="h-48 w-full" />;

  if (query.error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Não foi possível carregar os grupos</AlertTitle>
        <AlertDescription>{catalogErrorMessage(query.error)}</AlertDescription>
      </Alert>
    );
  }

  const groups = query.data ?? [];
  const refetch = () => void query.refetch();

  function groupFields(d: GroupDraft, set: (next: GroupDraft) => void, prefix: string) {
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${prefix}-nome`}>Nome do grupo</Label>
            <Input
              id={`${prefix}-nome`}
              value={d.name}
              maxLength={80}
              placeholder="Ex.: Sabores, Adicionais, Ponto da carne"
              onChange={(e) => set({ ...d, name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${prefix}-tipo`}>Tipo de escolha</Label>
            <Select
              value={d.selectionType}
              onValueChange={(v) =>
                set({
                  ...d,
                  selectionType: v as OptionSelectionType,
                  maxSelections: v === "unica" ? 1 : d.maxSelections,
                  portionEnabled: v === "unica" ? false : d.portionEnabled,
                })
              }
            >
              <SelectTrigger id={`${prefix}-tipo`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SELECTION_TYPE_LABELS) as OptionSelectionType[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {SELECTION_TYPE_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-desc`}>Descrição (opcional)</Label>
          <Textarea
            id={`${prefix}-desc`}
            rows={2}
            maxLength={300}
            value={d.description}
            onChange={(e) => set({ ...d, description: e.target.value })}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${prefix}-min`}>Mínimo de escolhas</Label>
            <Input
              id={`${prefix}-min`}
              type="number"
              min={0}
              value={d.minSelections}
              onChange={(e) => set({ ...d, minSelections: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${prefix}-max`}>Máximo de escolhas</Label>
            <Input
              id={`${prefix}-max`}
              type="number"
              min={1}
              disabled={d.selectionType === "unica"}
              value={d.maxSelections}
              onChange={(e) => set({ ...d, maxSelections: Number(e.target.value) || 1 })}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${prefix}-estrategia`}>Como cobrar o grupo</Label>
            <Select
              value={d.pricingStrategy}
              onValueChange={(v) => set({ ...d, pricingStrategy: v as PricingStrategy })}
            >
              <SelectTrigger id={`${prefix}-estrategia`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PRICING_STRATEGY_LABELS) as PricingStrategy[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {PRICING_STRATEGY_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${prefix}-efeito`}>Efeito no preço</Label>
            <Select
              value={d.priceEffect}
              onValueChange={(v) => set({ ...d, priceEffect: v as PriceEffect })}
            >
              <SelectTrigger id={`${prefix}-efeito`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PRICE_EFFECT_LABELS) as PriceEffect[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {PRICE_EFFECT_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id={`${prefix}-obrig`}
            checked={d.isRequired}
            onCheckedChange={(v) =>
              set({ ...d, isRequired: Boolean(v), minSelections: v ? Math.max(1, d.minSelections) : d.minSelections })
            }
          />
          <Label htmlFor={`${prefix}-obrig`}>Escolha obrigatória</Label>
        </div>

        {d.selectionType !== "unica" ? (
          <div className="space-y-2 rounded-md border border-border p-3">
            <div className="flex items-center gap-2">
              <Switch
                id={`${prefix}-porcoes`}
                checked={d.portionEnabled}
                onCheckedChange={(v) =>
                  set({ ...d, portionEnabled: Boolean(v), portionCount: v ? (d.portionCount ?? 2) : null })
                }
              />
              <Label htmlFor={`${prefix}-porcoes`}>Dividir em porções</Label>
            </div>
            {d.portionEnabled ? (
              <div className="space-y-1.5">
                <Label htmlFor={`${prefix}-qtd-porcoes`}>Quantidade de porções</Label>
                <Input
                  id={`${prefix}-qtd-porcoes`}
                  type="number"
                  min={2}
                  max={8}
                  className="w-28"
                  value={d.portionCount ?? 2}
                  onChange={(e) => set({ ...d, portionCount: Number(e.target.value) || 2 })}
                />
                <p className="text-xs text-muted-foreground">
                  Use para dividir um produto entre sabores. Combine com “cobrar o item mais caro”
                  ou “média proporcional”.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {groups.filter((g) => !g.is_archived).length} grupo(s) disponível(is)
        </p>
        {can.create ? (
          <Button onClick={() => setCreating((v) => !v)} variant={creating ? "ghost" : "default"}>
            {creating ? "Cancelar" : "Novo grupo"}
          </Button>
        ) : null}
      </div>

      {creating ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Novo grupo de opções</CardTitle>
            <CardDescription>
              Um grupo pode ser reaproveitado em vários produtos da mesma loja.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {groupFields(draft, setDraft, "novo-grupo")}
            <Button
              disabled={isBusy || draft.name.trim().length < 2}
              onClick={() =>
                void run(() => createOptionGroup(storeId!, toInput(draft)), "Grupo criado.").then(
                  (created) => {
                    if (created) {
                      setDraft(EMPTY_GROUP);
                      setCreating(false);
                      refetch();
                    }
                  },
                )
              }
            >
              Criar grupo
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum grupo cadastrado ainda.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {groups.map((group) => {
            const itemDraft = itemDrafts[group.id] ?? { name: "", price: "", max: "1" };
            const editing = editingId === group.id;
            return (
              <li key={group.id}>
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base">{group.name}</CardTitle>
                      {group.is_archived ? <Badge variant="outline">Arquivado</Badge> : null}
                      {!group.is_archived && !group.is_active ? (
                        <Badge variant="secondary">Inativo</Badge>
                      ) : null}
                      {group.is_required ? <Badge>Obrigatório</Badge> : <Badge variant="secondary">Opcional</Badge>}
                      <Badge variant="outline">mín {group.min_selections}</Badge>
                      <Badge variant="outline">máx {group.max_selections}</Badge>
                      {group.portion_count ? (
                        <Badge variant="outline">{group.portion_count} porções</Badge>
                      ) : null}
                    </div>
                    <CardDescription>
                      {SELECTION_TYPE_LABELS[group.selection_type]} ·{" "}
                      {PRICING_STRATEGY_LABELS[group.pricing_strategy]} ·{" "}
                      {PRICE_EFFECT_LABELS[group.price_effect]} · usado em{" "}
                      {group.linked_product_count} produto(s)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {editing ? (
                      <div className="space-y-3">
                        {groupFields(editDraft, setEditDraft, `edit-${group.id}`)}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={isBusy}
                            onClick={() =>
                              void run(
                                () =>
                                  updateOptionGroup(
                                    storeId!,
                                    group.id,
                                    toInput(editDraft),
                                    group.updated_at,
                                  ),
                                "Grupo atualizado.",
                              ).then((saved) => {
                                if (saved) {
                                  setEditingId(null);
                                  refetch();
                                }
                              })
                            }
                          >
                            Salvar grupo
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <ul className="space-y-2">
                          {group.items.length === 0 ? (
                            <li className="text-sm text-muted-foreground">
                              Nenhum item neste grupo.
                            </li>
                          ) : (
                            group.items.map((item) => (
                              <li
                                key={item.id}
                                className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2"
                              >
                                <span className="flex-1 text-sm text-foreground">
                                  {item.name}
                                  {item.is_archived ? " (arquivado)" : ""}
                                  {!item.is_archived && !item.is_active ? " (inativo)" : ""}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  {formatPriceBRL(item.additional_price)}
                                </span>
                                {can.update && !item.is_archived ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={isBusy}
                                    onClick={() =>
                                      void run(
                                        () =>
                                          setOptionItemActive(
                                            storeId!,
                                            item.id,
                                            !item.is_active,
                                            item.updated_at,
                                          ),
                                        item.is_active ? "Item desativado." : "Item ativado.",
                                      ).then(refetch)
                                    }
                                  >
                                    {item.is_active ? "Desativar" : "Ativar"}
                                  </Button>
                                ) : null}
                                {can.archive ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={isBusy}
                                    onClick={() =>
                                      void run(
                                        () =>
                                          archiveOptionItem(
                                            storeId!,
                                            item.id,
                                            !item.is_archived,
                                            item.updated_at,
                                          ),
                                        item.is_archived ? "Item restaurado." : "Item arquivado.",
                                      ).then(refetch)
                                    }
                                  >
                                    {item.is_archived ? "Restaurar" : "Arquivar"}
                                  </Button>
                                ) : null}
                              </li>
                            ))
                          )}
                        </ul>

                        {can.create && !group.is_archived ? (
                          <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-end">
                            <div className="flex-1 space-y-1.5">
                              <Label htmlFor={`item-nome-${group.id}`}>Novo item</Label>
                              <Input
                                id={`item-nome-${group.id}`}
                                value={itemDraft.name}
                                maxLength={80}
                                placeholder="Ex.: Calabresa, Bacon, Sem cebola"
                                onChange={(e) =>
                                  setItemDrafts({
                                    ...itemDrafts,
                                    [group.id]: { ...itemDraft, name: e.target.value },
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor={`item-preco-${group.id}`}>Adicional</Label>
                              <Input
                                id={`item-preco-${group.id}`}
                                className="w-28"
                                inputMode="decimal"
                                placeholder="0,00"
                                value={itemDraft.price}
                                onChange={(e) =>
                                  setItemDrafts({
                                    ...itemDrafts,
                                    [group.id]: { ...itemDraft, price: e.target.value },
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor={`item-max-${group.id}`}>Máx.</Label>
                              <Input
                                id={`item-max-${group.id}`}
                                className="w-20"
                                type="number"
                                min={1}
                                value={itemDraft.max}
                                onChange={(e) =>
                                  setItemDrafts({
                                    ...itemDrafts,
                                    [group.id]: { ...itemDraft, max: e.target.value },
                                  })
                                }
                              />
                            </div>
                            <Button
                              disabled={isBusy || itemDraft.name.trim() === ""}
                              onClick={() =>
                                void run(
                                  () =>
                                    createOptionItem({
                                      storeId: storeId!,
                                      groupId: group.id,
                                      name: itemDraft.name.trim(),
                                      additionalPrice: parsePriceInput(itemDraft.price) ?? 0,
                                      description: "",
                                      maxQuantity: Number(itemDraft.max) || 1,
                                    }),
                                  "Item adicionado.",
                                ).then((created) => {
                                  if (created) {
                                    setItemDrafts({
                                      ...itemDrafts,
                                      [group.id]: { name: "", price: "", max: "1" },
                                    });
                                    refetch();
                                  }
                                })
                              }
                            >
                              Adicionar
                            </Button>
                          </div>
                        ) : null}

                        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                          {can.update && !group.is_archived ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingId(group.id);
                                  setEditDraft(toDraft(group));
                                }}
                              >
                                Editar grupo
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={isBusy}
                                onClick={() =>
                                  void run(
                                    () =>
                                      setOptionGroupActive(
                                        storeId!,
                                        group.id,
                                        !group.is_active,
                                        group.updated_at,
                                      ),
                                    group.is_active ? "Grupo desativado." : "Grupo ativado.",
                                  ).then(refetch)
                                }
                              >
                                {group.is_active ? "Desativar" : "Ativar"}
                              </Button>
                            </>
                          ) : null}
                          {can.archive ? (
                            <Button
                              size="sm"
                              variant={group.is_archived ? "default" : "ghost"}
                              disabled={isBusy}
                              onClick={() =>
                                void run(
                                  () =>
                                    archiveOptionGroup(
                                      storeId!,
                                      group.id,
                                      !group.is_archived,
                                      group.updated_at,
                                    ),
                                  group.is_archived ? "Grupo restaurado." : "Grupo arquivado.",
                                ).then(refetch)
                              }
                            >
                              {group.is_archived ? "Restaurar" : "Arquivar"}
                            </Button>
                          ) : null}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
