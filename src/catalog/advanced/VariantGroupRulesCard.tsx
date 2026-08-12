import { useQuery } from "@tanstack/react-query";
import { SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { AdvancedBuilder, LinkedOptionGroup, ProductVariant } from "../advanced-types";
import { useCatalog } from "../CatalogProvider";
import {
  listVariantGroupRules,
  saveVariantGroupRule,
  type VariantGroupRule,
} from "../shark-variant-group-rules.api";

const RELEVANT_ROLES = new Set(["cream", "fruit", "topping", "addon", "protein", "side", "sauce", "container", "beverage", "removal"]);

function asNullableInt(value: string) {
  if (!value.trim()) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 100 ? parsed : undefined;
}

function roleHint(group: LinkedOptionGroup) {
  if (group.role === "side") return "Quantos acompanhamentos este tamanho permite e quantos já fazem parte do preço.";
  if (group.role === "protein") return "Use se tamanhos diferentes permitirem mais proteínas.";
  if (group.role === "beverage") return "Defina se este tamanho permite bebida e quantas opções podem ser escolhidas.";
  if (group.role === "topping" || group.role === "addon") return "Controle quantas escolhas cabem neste tamanho e quantas já estão incluídas.";
  if (group.role === "removal") return "Limite opcional para remoções neste tamanho; normalmente não gera cobrança.";
  return `Padrão atual: até ${group.max_selections} · ${group.included_selections ?? 0} incluídos`;
}

function RuleRow({
  variant,
  group,
  rule,
  onSaved,
}: {
  variant: ProductVariant;
  group: LinkedOptionGroup;
  rule: VariantGroupRule | null;
  onSaved: () => void;
}) {
  const { storeId, run, isBusy } = useCatalog();
  const [max, setMax] = useState("");
  const [included, setIncluded] = useState("");

  useEffect(() => {
    setMax(String(rule?.max_selections ?? group.max_selections));
    setIncluded(String(rule?.included_selections ?? group.included_selections ?? 0));
  }, [rule, group.max_selections, group.included_selections]);

  const maxValue = asNullableInt(max);
  const includedValue = asNullableInt(included);
  const valid = maxValue !== undefined && includedValue !== undefined && (maxValue ?? 1) >= 1 && (includedValue ?? 0) <= (maxValue ?? group.max_selections);

  const save = async () => {
    if (!storeId || !valid) return;
    const result = await run(() => saveVariantGroupRule({
      storeId,
      productId: variant.product_id,
      variantId: variant.id,
      groupId: group.id,
      minSelections: null,
      maxSelections: maxValue,
      includedSelections: includedValue,
    }), `Regras de ${variant.name} atualizadas.`);
    if (result) onSaved();
  };

  return (
    <div className="grid gap-3 rounded-2xl border border-border bg-background/25 p-3 sm:grid-cols-[1fr_130px_130px_auto] sm:items-end">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold">{group.name}</p>
          {group.role === "side" ? <Badge variant="secondary">Acompanhamentos</Badge> : null}
          {group.role === "protein" ? <Badge variant="secondary">Proteína</Badge> : null}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{roleHint(group)}</p>
      </div>
      <div className="space-y-1.5">
        <Label>{group.role === "side" ? "Pode escolher" : "Até quantos"}</Label>
        <Input type="number" min={1} max={100} value={max} onChange={(event) => setMax(event.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>{group.role === "side" ? "Já incluídos" : "Incluídos"}</Label>
        <Input type="number" min={0} max={100} value={included} onChange={(event) => setIncluded(event.target.value)} />
      </div>
      <Button size="sm" disabled={isBusy || !valid} onClick={() => void save()}>Salvar</Button>
    </div>
  );
}

export function VariantGroupRulesCard({ builder, onSaved }: { builder: AdvancedBuilder; onSaved: () => void }) {
  const { storeId } = useCatalog();
  const rulesQuery = useQuery({
    queryKey: ["catalog", "variant-group-rules", storeId, builder.product.id],
    queryFn: () => listVariantGroupRules(storeId!, builder.product.id),
    enabled: Boolean(storeId),
    retry: false,
  });

  const variants = builder.variants.filter((variant) => !variant.is_archived);
  const groups = builder.groups.filter((group) => !group.is_archived && (RELEVANT_ROLES.has(group.role) || group.included_selections > 0));
  const mealLike = groups.some((group) => group.role === "protein") && groups.some((group) => group.role === "side");

  if (variants.length === 0 || groups.length === 0 || !builder.can.update) return null;

  const refetch = () => {
    void rulesQuery.refetch();
    onSaved();
  };

  return (
    <Card className="overflow-hidden border-violet-400/15 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,.09),transparent_42%),var(--card)]">
      <CardHeader>
        <div className="mb-1 flex items-center gap-2"><SlidersHorizontal className="size-4 text-violet-300" /><Badge variant="outline">Por tamanho</Badge></div>
        <CardTitle className="text-base">{mealLike ? "O que cada marmita permite?" : "O que muda por tamanho?"}</CardTitle>
        <CardDescription>
          {mealLike
            ? "Exemplo: P permite 2 acompanhamentos, M permite 3 e G permite 4. O Shark aplica a regra no cardápio, carrinho e checkout."
            : "Use quando um tamanho inclui mais escolhas que outro. Ex.: 300 ml inclui 3 complementos; 500 ml inclui 5."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {variants.map((variant) => (
          <section key={variant.id} className="space-y-2 rounded-2xl border border-border/70 p-3">
            <div className="flex items-center justify-between gap-3">
              <div><p className="font-bold">{variant.name}</p><p className="text-xs text-muted-foreground">{mealLike ? "Regras desta marmita" : "Ajustes exclusivos deste tamanho"}</p></div>
              {variant.is_default ? <Badge variant="secondary">Padrão</Badge> : null}
            </div>
            <div className="space-y-2">
              {groups.map((group) => (
                <RuleRow
                  key={`${variant.id}-${group.id}`}
                  variant={variant}
                  group={group}
                  rule={(rulesQuery.data ?? []).find((item) => item.product_variant_id === variant.id && item.option_group_id === group.id) ?? null}
                  onSaved={refetch}
                />
              ))}
            </div>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
