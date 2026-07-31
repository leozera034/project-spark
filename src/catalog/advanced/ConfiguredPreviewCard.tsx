import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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

import { previewConfiguration } from "../advanced-api";
import {
  MEASUREMENT_SHORT,
  configurationMessage,
  describeVariant,
  type AdvancedBuilder,
  type PreviewSelection,
} from "../advanced-types";
import { useCatalog } from "../CatalogProvider";
import { formatPriceBRL } from "../types";

/**
 * Prévia administrativa. Nenhum valor é calculado no navegador: montamos a
 * seleção e o servidor devolve o preço canônico e os erros de validação.
 */
export function ConfiguredPreviewCard({ builder }: { builder: AdvancedBuilder }) {
  const { storeId } = useCatalog();
  const product = builder.product;

  const variants = builder.variants.filter((v) => v.is_active && !v.is_archived);
  const groups = builder.groups.filter(
    (g) => g.is_active && !g.is_archived && g.link_is_active,
  );

  const [variantId, setVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(String(product.minimum_quantity ?? 1));
  const [chosen, setChosen] = useState<Record<string, Record<string, number>>>({});
  const [debounced, setDebounced] = useState(0);

  useEffect(() => {
    const preferred = variants.find((v) => v.is_default) ?? variants[0] ?? null;
    setVariantId(preferred ? preferred.id : null);
  }, [builder.product.id, builder.variants.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const selections = useMemo<PreviewSelection[]>(
    () =>
      Object.entries(chosen)
        .map(([groupId, items]) => ({
          group_id: groupId,
          items: Object.entries(items)
            .filter(([, qty]) => qty > 0)
            .map(([itemId, qty]) => ({ item_id: itemId, quantity: qty })),
        }))
        .filter((s) => s.items.length > 0),
    [chosen],
  );

  useEffect(() => {
    const timer = setTimeout(() => setDebounced((n) => n + 1), 250);
    return () => clearTimeout(timer);
  }, [variantId, quantity, selections]);

  const parsedQuantity = Number(quantity.replace(",", ".")) || 0;

  const previewQuery = useQuery({
    queryKey: [
      "catalog",
      "preview",
      storeId,
      product.id,
      variantId,
      parsedQuantity,
      JSON.stringify(selections),
      debounced,
    ],
    queryFn: () =>
      previewConfiguration({
        storeId: storeId!,
        productId: product.id,
        variantId,
        quantity: parsedQuantity,
        selections,
      }),
    enabled: Boolean(storeId),
    retry: false,
  });

  const preview = previewQuery.data ?? null;
  const errors = preview?.validation_errors ?? [];

  function toggle(groupId: string, itemId: string, single: boolean, next: number) {
    setChosen((current) => {
      const group = single ? {} : { ...(current[groupId] ?? {}) };
      if (next <= 0) delete group[itemId];
      else group[itemId] = next;
      return { ...current, [groupId]: group };
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Prévia administrativa</CardTitle>
        <CardDescription>
          Simule uma configuração como se fosse o cliente. O preço é sempre calculado no servidor.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {variants.length > 0 ? (
            <div className="space-y-1.5">
              <Label htmlFor="preview-variant">Variação</Label>
              <Select value={variantId ?? ""} onValueChange={setVariantId}>
                <SelectTrigger id="preview-variant">
                  <SelectValue placeholder="Escolha" />
                </SelectTrigger>
                <SelectContent>
                  {variants.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {describeVariant(v)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="preview-qty">
              Quantidade
              {product.sale_mode === "measured"
                ? ` (${MEASUREMENT_SHORT[product.measurement_unit]})`
                : ""}
            </Label>
            <Input
              id="preview-qty"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
        </div>

        {groups.map((group) => {
          const single = group.selection_type === "unica";
          const byQuantity = group.selection_type === "quantidade" || group.portion_count !== null;
          const items = group.items.filter((i) => i.is_active && !i.is_archived);
          return (
            <fieldset key={group.id} className="rounded-lg border border-border p-3">
              <legend className="px-1 text-sm font-medium text-foreground">
                {group.name}
                {group.is_required ? " *" : ""}
              </legend>
              <p className="mb-2 text-xs text-muted-foreground">
                {group.portion_count
                  ? `Divida em ${group.portion_count} porções.`
                  : `Escolha de ${group.min_selections} a ${group.max_selections} item(ns).`}
              </p>
              <ul className="space-y-2">
                {items.map((item) => {
                  const current = chosen[group.id]?.[item.id] ?? 0;
                  return (
                    <li key={item.id} className="flex items-center gap-3">
                      {byQuantity ? (
                        <Input
                          type="number"
                          min={0}
                          max={item.max_quantity}
                          className="w-20"
                          aria-label={`Quantidade de ${item.name}`}
                          value={current}
                          onChange={(e) =>
                            toggle(group.id, item.id, false, Number(e.target.value) || 0)
                          }
                        />
                      ) : (
                        <Checkbox
                          id={`prev-${item.id}`}
                          checked={current > 0}
                          onCheckedChange={(v) =>
                            toggle(group.id, item.id, single, v ? 1 : 0)
                          }
                        />
                      )}
                      <Label htmlFor={`prev-${item.id}`} className="flex-1 font-normal">
                        {item.name}
                      </Label>
                      <span className="text-xs text-muted-foreground">
                        {formatPriceBRL(item.additional_price)}
                      </span>
                    </li>
                  );
                })}
                {items.length === 0 ? (
                  <li className="text-xs text-muted-foreground">Nenhum item ativo neste grupo.</li>
                ) : null}
              </ul>
            </fieldset>
          );
        })}

        <div className="rounded-lg border border-border bg-muted/30 p-4">
          {previewQuery.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : preview ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-2xl font-semibold text-foreground">
                  {preview.final_total !== null ? formatPriceBRL(preview.final_total) : "—"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Base {formatPriceBRL(preview.base_total)} · adicionais{" "}
                {formatPriceBRL(preview.additive_groups_total)}
                {preview.replacement_group_total !== null
                  ? ` · preço substituído por ${formatPriceBRL(preview.replacement_group_total)}`
                  : ""}
              </p>
              {preview.breakdown.length > 0 ? (
                <ul className="space-y-1 pt-1">
                  {preview.breakdown.map((row) => (
                    <li key={row.group_id} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        {row.group_name}
                        <Badge variant="outline" className="ml-2">
                          {row.pricing_strategy === "highest_price"
                            ? "mais caro"
                            : row.pricing_strategy === "average_price"
                              ? "média"
                              : "soma"}
                        </Badge>
                      </span>
                      <span className="text-foreground">{formatPriceBRL(row.value)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {errors.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-destructive">
                  {errors.map((code) => (
                    <li key={code}>{configurationMessage(code)}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Não foi possível calcular a prévia.</p>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Prévia interna. O cardápio público do cliente chega em fase posterior.
        </p>
      </CardContent>
    </Card>
  );
}
