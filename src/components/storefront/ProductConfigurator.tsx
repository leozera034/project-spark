import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Minus, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { UNIT_LABELS, brl } from "@/components/storefront/format";
import { CART_MESSAGES } from "@/storefront/cart/cart.errors";
import { useCart } from "@/storefront/cart/cart.context";
import type { PublicProductDetail, PublicOptionGroup } from "@/lib/storefront.server";

type Selection = { option_group_id: string; option_item_id: string; quantity: number };

type Props = {
  slug: string;
  productId: string;
  storeOpen: boolean;
  editLineId?: string | null;
  onClose: () => void;
};

async function fetchProduct(slug: string, productId: string): Promise<PublicProductDetail> {
  const res = await fetch(`/api/public/storefront/${slug}/produtos/${productId}`);
  if (!res.ok) throw new Error("indisponivel");
  return res.json();
}

async function fetchPrice(slug: string, body: unknown) {
  const res = await fetch(`/api/public/storefront/${slug}/preco`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<{
    ok: boolean;
    error?: string;
    total?: number;
    unit_price?: number;
    options_total?: number;
  }>;
}

function groupInstruction(group: PublicOptionGroup, chosen: number) {
  const min = group.is_required ? Math.max(1, group.min_selections) : group.min_selections;
  const missing = Math.max(0, min - chosen);
  const remaining = Math.max(0, group.max_selections - chosen);
  const parts = [group.is_required ? "Obrigatório" : "Opcional"];

  if (group.max_selections === 1) parts.push("escolha 1");
  else if (group.max_selections > 1) parts.push(`até ${group.max_selections}`);
  if (min > 0 && group.max_selections !== 1) parts.push(`mínimo ${min}`);
  if (missing > 0) parts.push(`faltam ${missing}`);
  else if (remaining > 0 && chosen > 0 && group.max_selections > 1) parts.push(`${remaining} restante${remaining > 1 ? "s" : ""}`);

  return parts.join(" · ");
}

function optionPriceLabel(group: PublicOptionGroup, value: number) {
  if (value <= 0) return null;
  return group.included_selections > 0 ? `Excedente + ${brl(value)}` : `+ ${brl(value)}`;
}

export function ProductConfigurator({
  slug,
  productId,
  storeOpen,
  editLineId = null,
  onClose,
}: Props) {
  const cart = useCart();
  const [cartError, setCartError] = useState<string | null>(null);
  const { data, isPending, isError } = useQuery({
    queryKey: ["storefront-product", slug, productId],
    queryFn: () => fetchProduct(slug, productId),
    staleTime: 60_000,
  });

  const [variantId, setVariantId] = useState<string | null>(null);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!data) return;
    const editing = editLineId ? (cart.lines.find((line) => line.lineId === editLineId) ?? null) : null;

    if (editing && editing.productId === data.product.id) {
      setVariantId(editing.variantId);
      setSelections(editing.selections.map((s) => ({
        option_group_id: s.option_group_id,
        option_item_id: s.option_item_id,
        quantity: s.quantity,
      })));
      setQuantity(editing.quantity);
      setNotes(editing.notes ?? "");
      return;
    }

    const fallback = data.variants.find((v) => v.is_default) ?? data.variants[0] ?? null;
    setVariantId(fallback?.id ?? null);
    setSelections([]);
    setQuantity(Math.max(data.product.minimum_quantity, data.product.quantity_step));
    setNotes("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, editLineId]);

  const groups = data?.option_groups ?? [];

  const countIn = (groupId: string) => selections
    .filter((s) => s.option_group_id === groupId)
    .reduce((total, s) => total + s.quantity, 0);

  const pendingGroups = useMemo(() => groups.filter((group) => {
    const chosen = countIn(group.id);
    const minimum = group.is_required ? Math.max(1, group.min_selections) : group.min_selections;
    return chosen < minimum;
  }), [groups, selections]);

  const isComplete = pendingGroups.length === 0;

  const { data: price, isFetching: pricing } = useQuery({
    queryKey: ["storefront-price", slug, productId, variantId, quantity, selections],
    enabled: Boolean(data) && isComplete,
    staleTime: 0,
    queryFn: () => fetchPrice(slug, {
      product_id: productId,
      variant_id: variantId,
      quantity,
      selections,
    }),
  });

  const toggleSingle = (groupId: string, itemId: string) => setSelections((prev) => [
    ...prev.filter((s) => s.option_group_id !== groupId),
    { option_group_id: groupId, option_item_id: itemId, quantity: 1 },
  ]);

  const toggleMulti = (groupId: string, itemId: string, max: number) => setSelections((prev) => {
    const exists = prev.find((s) => s.option_group_id === groupId && s.option_item_id === itemId);
    if (exists) return prev.filter((s) => !(s.option_group_id === groupId && s.option_item_id === itemId));
    const current = prev.filter((s) => s.option_group_id === groupId).length;
    if (max > 0 && current >= max) return prev;
    return [...prev, { option_group_id: groupId, option_item_id: itemId, quantity: 1 }];
  });

  const bumpQuantity = (
    groupId: string,
    itemId: string,
    delta: number,
    maxItem: number,
    maxGroup: number,
  ) => setSelections((prev) => {
    const current = prev.find((s) => s.option_group_id === groupId && s.option_item_id === itemId);
    const groupTotal = prev
      .filter((s) => s.option_group_id === groupId)
      .reduce((total, s) => total + s.quantity, 0);
    const next = (current?.quantity ?? 0) + delta;

    if (delta > 0 && maxGroup > 0 && groupTotal >= maxGroup) return prev;
    if (next <= 0) return prev.filter((s) => !(s.option_group_id === groupId && s.option_item_id === itemId));
    if (next > maxItem) return prev;
    if (current) {
      return prev.map((s) => s.option_group_id === groupId && s.option_item_id === itemId ? { ...s, quantity: next } : s);
    }
    return [...prev, { option_group_id: groupId, option_item_id: itemId, quantity: next }];
  });

  const submit = () => {
    if (!data || !price?.ok) return;
    const variant = data.variants.find((v) => v.id === variantId) ?? null;
    const itemName = (groupId: string, itemId: string) => data.option_groups
      .find((g) => g.id === groupId)?.items.find((i) => i.id === itemId)?.name ?? "";

    const input = {
      productId: data.product.id,
      productNameSnapshot: data.product.name,
      variantId: variant?.id ?? null,
      variantNameSnapshot: variant?.name ?? null,
      selections: selections.map((s) => ({ ...s, nameSnapshot: itemName(s.option_group_id, s.option_item_id) })),
      quantity,
      notes: notes.trim() ? notes.trim().slice(0, 280) : null,
      saleMode: data.product.sale_mode,
      unitLabel: data.product.measurement_unit,
      minimumQuantity: data.product.minimum_quantity,
      quantityStep: data.product.quantity_step,
      maxQuantity: data.product.max_quantity,
      lastKnownUnitPrice: price.unit_price ?? 0,
      lastKnownTotal: price.total ?? 0,
    };

    if (editLineId) {
      cart.replaceLine(editLineId, input);
      onClose();
      return;
    }
    const result = cart.addLine(input);
    if (!result) {
      setCartError(CART_MESSAGES.limitReached);
      return;
    }
    onClose();
  };

  if (isPending) return (
    <div className="space-y-4 p-1">
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-24 w-full" />
    </div>
  );

  if (isError || !data) return (
    <div className="space-y-4 py-10 text-center">
      <p className="text-sm text-muted-foreground">Não conseguimos carregar este item agora.</p>
      <Button variant="outline" onClick={onClose}>Voltar ao cardápio</Button>
    </div>
  );

  const product = data.product;
  const measured = product.sale_mode === "measured";
  const unit = UNIT_LABELS[product.measurement_unit] ?? product.unit_label ?? "un";
  const step = product.quantity_step || 1;
  const minQty = product.minimum_quantity || step;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto px-1 pb-6">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} loading="lazy" decoding="async" className="aspect-[16/10] w-full rounded-xl object-cover" />
        ) : null}

        <div className="space-y-2">
          <h2 className="text-xl font-semibold leading-tight">{product.name}</h2>
          {product.description ? <p className="text-sm text-muted-foreground">{product.description}</p> : null}
          <div className="flex flex-wrap gap-2">
            {measured ? <Badge variant="secondary">Vendido por {unit} · mínimo {minQty} {unit}</Badge> : null}
            {product.product_type === "combo" ? <Badge variant="secondary">Combo personalizável</Badge> : null}
            {Boolean(product.capabilities?.multi_flavor) ? <Badge variant="secondary">Permite vários sabores</Badge> : null}
          </div>
        </div>

        {data.variants.length > 0 ? (
          <section className="space-y-3">
            <header><h3 className="text-sm font-semibold">Escolha uma opção</h3><p className="text-xs text-muted-foreground">Obrigatório · escolha 1</p></header>
            <RadioGroup value={variantId ?? ""} onValueChange={setVariantId} className="space-y-2">
              {data.variants.map((variant) => (
                <label key={variant.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3">
                  <span className="flex items-center gap-3">
                    <RadioGroupItem value={variant.id} id={variant.id} />
                    <span className="text-sm">{variant.name}{variant.package_quantity ? <span className="block text-xs text-muted-foreground">{variant.package_quantity}{UNIT_LABELS[variant.package_unit ?? ""] ?? ""}</span> : null}</span>
                  </span>
                  <span className="text-sm font-medium">{brl(variant.price)}</span>
                </label>
              ))}
            </RadioGroup>
          </section>
        ) : null}

        {groups.map((group) => {
          const chosen = countIn(group.id);
          const incomplete = pendingGroups.some((g) => g.id === group.id);
          const atLimit = group.max_selections > 0 && chosen >= group.max_selections;
          return (
            <section key={group.id} className="space-y-3 rounded-2xl border border-border/70 p-4">
              <header className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold">{group.name}</h3>
                    {group.role === "combo_step" ? <Badge variant="outline">Etapa do combo</Badge> : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{groupInstruction(group, chosen)}</p>
                  {group.included_selections > 0 ? (
                    <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                      Até {group.included_selections} escolha{group.included_selections > 1 ? "s" : ""} incluída{group.included_selections > 1 ? "s" : ""} no preço. Excedentes são cobrados individualmente.
                    </p>
                  ) : null}
                </div>
                {incomplete ? (
                  <Badge variant="destructive" className="shrink-0">Falta escolher</Badge>
                ) : chosen > 0 ? (
                  <Badge variant="secondary" className="shrink-0"><CheckCircle2 className="mr-1 size-3.5" />{chosen}/{group.max_selections}</Badge>
                ) : null}
              </header>

              <div className="space-y-2">
                {group.items.map((item) => {
                  const selected = selections.find((s) => s.option_group_id === group.id && s.option_item_id === item.id);
                  const priceLabel = optionPriceLabel(group, item.additional_price);

                  if (group.selection_type === "quantidade" || group.allow_quantity) {
                    return (
                      <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                        <div className="min-w-0"><p className="truncate text-sm">{item.name}</p>{priceLabel ? <p className="text-xs text-muted-foreground">{priceLabel}</p> : <p className="text-xs text-muted-foreground">Sem acréscimo</p>}</div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Button type="button" size="icon" variant="outline" className="size-8" aria-label={`Remover ${item.name}`} disabled={!selected} onClick={() => bumpQuantity(group.id, item.id, -1, item.max_quantity, group.max_selections)}><Minus className="size-4" /></Button>
                          <span className="w-5 text-center text-sm tabular-nums">{selected?.quantity ?? 0}</span>
                          <Button type="button" size="icon" variant="outline" className="size-8" aria-label={`Adicionar ${item.name}`} disabled={atLimit || (selected?.quantity ?? 0) >= item.max_quantity} onClick={() => bumpQuantity(group.id, item.id, 1, item.max_quantity, group.max_selections)}><Plus className="size-4" /></Button>
                        </div>
                      </div>
                    );
                  }

                  if (group.selection_type === "unica") {
                    return (
                      <label key={item.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3">
                        <span className="flex items-center gap-3"><input type="radio" className="size-4 accent-[var(--brand,currentColor)]" name={group.id} checked={Boolean(selected)} onChange={() => toggleSingle(group.id, item.id)} /><span className="text-sm">{item.name}</span></span>
                        {priceLabel ? <span className="text-sm">{priceLabel}</span> : <span className="text-xs text-muted-foreground">Incluso</span>}
                      </label>
                    );
                  }

                  return (
                    <label key={item.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3">
                      <span className="flex items-center gap-3"><Checkbox checked={Boolean(selected)} onCheckedChange={() => toggleMulti(group.id, item.id, group.max_selections)} /><span className="text-sm">{item.name}</span></span>
                      {priceLabel ? <span className="text-sm">{priceLabel}</span> : <span className="text-xs text-muted-foreground">Sem acréscimo</span>}
                    </label>
                  );
                })}
              </div>
            </section>
          );
        })}

        <Separator />
        <section className="space-y-3">
          <Label htmlFor="quantidade" className="text-sm font-semibold">{measured ? `Quantidade (${unit})` : "Quantidade"}</Label>
          <div className="flex items-center gap-3">
            <Button type="button" size="icon" variant="outline" aria-label="Diminuir quantidade" onClick={() => setQuantity((q) => Math.max(minQty, Number((q - step).toFixed(3))))}><Minus className="size-4" /></Button>
            <span id="quantidade" className="w-16 text-center text-base tabular-nums">{quantity}{measured ? ` ${unit}` : ""}</span>
            <Button type="button" size="icon" variant="outline" aria-label="Aumentar quantidade" onClick={() => setQuantity((q) => { const next = Number((q + step).toFixed(3)); if (product.max_quantity && next > product.max_quantity) return q; return next; })}><Plus className="size-4" /></Button>
          </div>
        </section>

        {product.allows_notes ? (
          <section className="space-y-2"><Label htmlFor="observacao" className="text-sm font-semibold">Observação</Label><Textarea id="observacao" value={notes} maxLength={280} onChange={(event) => setNotes(event.target.value)} placeholder="Ex.: sem cebola" /></section>
        ) : null}
      </div>

      <div className="sticky bottom-0 space-y-2 border-t bg-background px-1 pb-2 pt-3">
        {!isComplete ? <p className="text-center text-xs text-muted-foreground">Falta escolher: {pendingGroups.map((g) => g.name).join(", ")}</p> : null}
        {cartError ? <p className="text-center text-xs text-destructive">{cartError}</p> : null}
        <Button className="h-12 w-full text-base" onClick={submit} disabled={!isComplete || !storeOpen || product.is_sold_out || !price?.ok} loading={pricing} loadingLabel="Calculando preço">
          {pricing ? "Calculando preço…" : product.is_sold_out ? "Item esgotado" : !storeOpen ? "Loja fechada" : isComplete && price?.ok ? <>{editLineId ? "Salvar alterações" : "Adicionar"} · <span className="tabular-nums">{brl(price.total ?? 0)}</span></> : "Complete as escolhas"}
        </Button>
        <p className="text-center text-[11px] text-muted-foreground">Preço final recalculado e validado no servidor da loja.</p>
      </div>
    </div>
  );
}
