import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { replaceVariantOptionPrices } from "../advanced-api";
import { describeVariant, type AdvancedBuilder, type VariantOptionPrice } from "../advanced-types";
import { useCatalog } from "../CatalogProvider";
import { formatPriceBRL, parsePriceInput } from "../types";

/**
 * Preço específico por variação. Quando vazio, vale o preço adicional do item.
 * A gravação é feita em bloco, de forma transacional, no servidor.
 */
export function VariantPricesCard({
  builder,
  onSaved,
}: {
  builder: AdvancedBuilder;
  onSaved: () => void;
}) {
  const { storeId, run, isBusy } = useCatalog();
  const product = builder.product;
  const canUpdate = builder.can.update && !product.is_archived;

  const variants = builder.variants.filter((v) => !v.is_archived);
  const rows = useMemo(
    () =>
      builder.groups.flatMap((group) =>
        group.items.filter((item) => !item.is_archived).map((item) => ({ group, item })),
      ),
    [builder.groups],
  );

  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const price of builder.variant_option_prices) {
      next[`${price.variant_id}:${price.item_id}`] = String(price.price).replace(".", ",");
    }
    setDraft(next);
  }, [builder.variant_option_prices]);

  if (variants.length === 0 || rows.length === 0) {
    return null;
  }

  async function save() {
    if (!storeId) return;
    const prices: VariantOptionPrice[] = [];
    for (const [key, raw] of Object.entries(draft)) {
      if (raw.trim() === "") continue;
      const value = parsePriceInput(raw);
      if (value === null) continue;
      const [variantId, itemId] = key.split(":");
      prices.push({ variant_id: variantId, item_id: itemId, price: value });
    }
    const saved = await run(
      () => replaceVariantOptionPrices(storeId, product.id, prices),
      "Preços por variação salvos.",
    );
    if (saved) onSaved();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Preços por variação</CardTitle>
        <CardDescription>
          Use quando o mesmo item custa diferente em cada tamanho. Deixe em branco para manter o
          preço adicional padrão do item.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-4 font-medium">Item</th>
                {variants.map((variant) => (
                  <th key={variant.id} className="py-2 pr-4 font-medium">
                    {describeVariant(variant)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ group, item }) => (
                <tr key={item.id} className="border-b border-border/60">
                  <td className="py-2 pr-4 align-middle">
                    <span className="font-medium text-foreground">{item.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {group.name} · padrão {formatPriceBRL(item.additional_price)}
                    </span>
                  </td>
                  {variants.map((variant) => {
                    const key = `${variant.id}:${item.id}`;
                    return (
                      <td key={key} className="py-2 pr-4">
                        <Input
                          className="w-28"
                          inputMode="decimal"
                          disabled={!canUpdate}
                          aria-label={`Preço de ${item.name} em ${variant.name}`}
                          placeholder="padrão"
                          value={draft[key] ?? ""}
                          onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {canUpdate ? (
          <Button disabled={isBusy} onClick={() => void save()}>
            Salvar preços por variação
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
