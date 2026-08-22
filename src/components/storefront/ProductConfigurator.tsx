import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Heart, Minus, Plus } from "lucide-react";

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
import { useStorefrontPreferences } from "@/storefront/preferences/storefront-preferences";
import type { PublicProductDetail } from "@/lib/storefront.server";

type Selection = { option_group_id: string; option_item_id: string; quantity: number };

type Props = {
  slug: string;
  productId: string;
  storeOpen: boolean;
  /** Quando presente, a montagem substitui esta linha do carrinho. */
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

export function ProductConfigurator({
  slug,
  productId,
  storeOpen,
  editLineId = null,
  onClose,
}: Props) {
  const cart = useCart();
  const preferences = useStorefrontPreferences(slug);
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
    const editing = editLineId
      ? (cart.lines.find((line) => line.lineId === editLineId) ?? null)
      : null;

    if (editing && editing.productId === data.product.id) {
      setVariantId(editing.variantId);
      setSelections(
        editing.selections.map((s) => ({
          option_group_id: s.option_group_id,
          option_item_id: s.option_item_id,
          quantity: s.quantity,
        })),
      );
      setQuantity(editing.quantity);
      setNotes(editing.notes ?? "");
      return;
    }

    const fallback = data.variants.find((v) => v.is_default) ?? data.variants[0] ?? null;
    setVariantId(fallback?.id ?? null);
    setSelections([]);
    setQuantity(Math.max(data.product.minimum_quantity, data.product.quantity_step));
    setNotes("");
    // `cart.lines` só é lido na abertura; mudanças posteriores não resetam a tela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, editLineId]);

  useEffect(() => {
    if (!data?.product.id) return;
    preferences.rememberViewed(data.product.id);
  }, [data?.product.id, preferences.rememberViewed]);

  useEffect(() => {
    setCartError(null);
  }, [variantId, selections, quantity, notes]);

  const groups = data?.option_groups ?? [];

  const countIn = (groupId: string) =>
    selections
      .filter((s) => s.option_group_id === groupId)
      .reduce((total, s) => total + s.quantity, 0);

  const pendingGroups = useMemo(
    () =>
      groups.filter((g) => {
        const chosen = countIn(g.id);
        if (g.is_required && chosen < Math.max(1, g.min_selections)) return true;
        return chosen < g.min_selections;
      }),
    [groups, selections],
  );

  const isComplete = pendingGroups.length === 0;

  const { data: price, isFetching: pricing } = useQuery({
    queryKey: ["storefront-price", slug, productId, variantId, quantity, selections],
    enabled: Boolean(data) && isComplete,
    staleTime: 0,
    queryFn: () =>
      fetchPrice(slug, {
        product_id: productId,
        variant_id: variantId,
        quantity,
        selections,
      }),
  });

  const toggleSingle = (groupId: string, itemId: string) =>
    setSelections((prev) => [
      ...prev.filter((s) => s.option_group_id !== groupId),
      { option_group_id: groupId, option_item_id: itemId, quantity: 1 },
    ]);

  const toggleMulti = (groupId: string, itemId: string, max: number) =>
    setSelections((prev) => {
      const exists = prev.find(
        (s) => s.option_group_id === groupId && s.option_item_id === itemId,
      );
      if (exists) {
        return prev.filter(
          (s) => !(s.option_group_id === groupId && s.option_item_id === itemId),
        );
      }
      const current = prev.filter((s) => s.option_group_id === groupId).length;
      if (max > 0 && current >= max) return prev;
      return [...prev, { option_group_id: groupId, option_item_id: itemId, quantity: 1 }];
    });

  const bumpQuantity = (groupId: string, itemId: string, delta: number, maxItem: number, maxGroup: number) =>
    setSelections((prev) => {
      const current = prev.find(
        (s) => s.option_group_id === groupId && s.option_item_id === itemId,
      );
      const groupTotal = prev
        .filter((s) => s.option_group_id === groupId)
        .reduce((total, s) => total + s.quantity, 0);
      const next = (current?.quantity ?? 0) + delta;

      if (delta > 0 && maxGroup > 0 && groupTotal >= maxGroup) return prev;
      if (next <= 0) {
        return prev.filter(
          (s) => !(s.option_group_id === groupId && s.option_item_id === itemId),
        );
      }
      if (next > maxItem) return prev;
      if (current) {
        return prev.map((s) =>
          s.option_group_id === groupId && s.option_item_id === itemId
            ? { ...s, quantity: next }
            : s,
        );
      }
      return [...prev, { option_group_id: groupId, option_item_id: itemId, quantity: next }];
    });

  const submit = () => {
    if (!data || !price?.ok) return;

    const variant = data.variants.find((v) => v.id === variantId) ?? null;
    const itemName = (groupId: string, itemId: string) =>
      data.option_groups
        .find((g) => g.id === groupId)
        ?.items.find((i) => i.id === itemId)?.name ?? "";

    const input = {
      productId: data.product.id,
      productNameSnapshot: data.product.name,
      variantId: variant?.id ?? null,
      variantNameSnapshot: variant?.name ?? null,
      selections: selections.map((s) => ({
        ...s,
        nameSnapshot: itemName(s.option_group_id, s.option_item_id),
      })),
      quantity,
      notes: notes.trim() ? notes.trim().slice(0, 280) : null,
      saleMode: data.product.sale_mode,
      unitLabel: data.product.measurement_unit,
      minimumQuantity: data.product.minimum_quantity,
      quantityStep: data.product.quantity_step,
      maxQuantity: data.product.max_quantity,
      // Apenas o último valor conhecido: o carrinho recotiza no servidor.
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

  if (isPending) {
    return (
      <div className="space-y-4 p-1">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          Não conseguimos carregar este item agora.
        </p>
        <Button variant="outline" onClick={onClose}>
          Voltar ao cardápio
        </Button>
      </div>
    );
  }

  const product = data.product;
  const favorite = preferences.isFavorite(product.id);
  const measured = product.sale_mode === "measured";
  const unit = UNIT_LABELS[product.measurement_unit] ?? product.unit_label ?? "un";
  const step = product.quantity_step || 1;
  const minQty = product.minimum_quantity || step;
  const priceUnavailable = isComplete && !pricing && Boolean(price) && !price?.ok;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto px-1 pb-6 overscroll-contain">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="aspect-[16/10] w-full rounded-2xl object-cover"
          />
        ) : null}

        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start gap-2">
                <h2 className="min-w-0 flex-1 text-xl font-black leading-tight tracking-[-.02em]">{product.name}</h2>
                {product.is_sold_out ? <Badge variant="destructive">Esgotado</Badge> : !storeOpen ? <Badge variant="secondary">Loja fechada</Badge> : null}
              </div>
            </div>
            <button
              type="button"
              aria-pressed={favorite}
              aria-label={favorite ? `Remover ${product.name} dos favoritos` : `Adicionar ${product.name} aos favoritos`}
              onClick={() => preferences.toggleFavorite(product.id)}
              className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground shadow-sm transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <Heart className={`size-5 ${favorite ? "fill-brand text-brand" : "text-muted-foreground"}`} />
            </button>
          </div>
          {product.description ? (
            <p className="text-sm leading-relaxed text-muted-foreground">{product.description}</p>
          ) : null}
          {measured ? (
            <Badge variant="secondary">
              Vendido por {unit} · mínimo {minQty} {unit}
            </Badge>
          ) : null}
        </div>

        {data.variants.length > 0 ? (
          <section className="space-y-3">
            <header>
              <h3 className="text-sm font-black">Escolha uma opção</h3>
              <p className="text-xs text-muted-foreground">Obrigatório · escolha 1</p>
            </header>
            <RadioGroup value={variantId ?? ""} onValueChange={setVariantId} className="space-y-2">
              {data.variants.map((variant) => {
                const selected = variant.id === variantId;
                return (
                  <label
                    key={variant.id}
                    className={`flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-xl border p-3.5 transition ${selected ? "border-brand/45 bg-brand/5 ring-1 ring-brand/15" : "border-border bg-background hover:border-brand/25"}`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <RadioGroupItem value={variant.id} id={variant.id} className="size-5" />
                      <span className="min-w-0 text-sm font-semibold">
                        <span className="block truncate">{variant.name}</span>
                        {variant.package_quantity ? (
                          <span className="block text-xs font-normal text-muted-foreground">
                            {variant.package_quantity}{UNIT_LABELS[variant.package_unit ?? ""] ?? ""}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular-nums">{brl(variant.price)}</span>
                  </label>
                );
              })}
            </RadioGroup>
          </section>
        ) : null}

        {groups.map((group) => {
          const chosen = countIn(group.id);
          const incomplete = pendingGroups.some((g) => g.id === group.id);
          return (
            <section key={group.id} className="space-y-3">
              <header className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black">{group.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {group.is_required ? "Obrigatório" : "Opcional"}
                    {group.max_selections > 0 ? ` · até ${group.max_selections}` : ""}
                    {group.min_selections > 0 ? ` · mínimo ${group.min_selections}` : ""}
                  </p>
                </div>
                {incomplete ? (
                  <Badge variant="warning" className="shrink-0">Falta escolher</Badge>
                ) : chosen > 0 ? (
                  <Badge variant="success" className="shrink-0">{chosen} escolhido{chosen > 1 ? "s" : ""}</Badge>
                ) : null}
              </header>

              <div className="space-y-2">
                {group.items.map((item) => {
                  const selected = selections.find(
                    (s) => s.option_group_id === group.id && s.option_item_id === item.id,
                  );

                  if (group.selection_type === "quantidade" || group.allow_quantity) {
                    return (
                      <div key={item.id} className={`flex min-h-14 items-center justify-between gap-3 rounded-xl border p-3 transition ${selected ? "border-brand/35 bg-brand/5" : "border-border"}`}>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{item.name}</p>
                          {item.additional_price > 0 ? <p className="text-xs text-muted-foreground">+ {brl(item.additional_price)}</p> : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="size-11 rounded-xl"
                            aria-label={`Remover ${item.name}`}
                            disabled={!selected}
                            onClick={() => bumpQuantity(group.id, item.id, -1, item.max_quantity, group.max_selections)}
                          >
                            <Minus className="size-4" />
                          </Button>
                          <span className="w-8 text-center text-sm font-bold tabular-nums">{selected?.quantity ?? 0}</span>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="size-11 rounded-xl"
                            aria-label={`Adicionar ${item.name}`}
                            onClick={() => bumpQuantity(group.id, item.id, 1, item.max_quantity, group.max_selections)}
                          >
                            <Plus className="size-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  }

                  if (group.selection_type === "unica") {
                    return (
                      <label key={item.id} className={`flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-xl border p-3.5 transition ${selected ? "border-brand/35 bg-brand/5" : "border-border hover:border-brand/25"}`}>
                        <span className="flex min-w-0 items-center gap-3">
                          <input type="radio" className="size-5 shrink-0 accent-[var(--brand,currentColor)]" name={group.id} checked={Boolean(selected)} onChange={() => toggleSingle(group.id, item.id)} />
                          <span className="truncate text-sm font-semibold">{item.name}</span>
                        </span>
                        {item.additional_price > 0 ? <span className="shrink-0 text-sm font-medium tabular-nums">+ {brl(item.additional_price)}</span> : null}
                      </label>
                    );
                  }

                  return (
                    <label key={item.id} className={`flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-xl border p-3.5 transition ${selected ? "border-brand/35 bg-brand/5" : "border-border hover:border-brand/25"}`}>
                      <span className="flex min-w-0 items-center gap-3">
                        <Checkbox checked={Boolean(selected)} className="size-5 shrink-0" onCheckedChange={() => toggleMulti(group.id, item.id, group.max_selections)} />
                        <span className="truncate text-sm font-semibold">{item.name}</span>
                      </span>
                      {item.additional_price > 0 ? <span className="shrink-0 text-sm font-medium tabular-nums">+ {brl(item.additional_price)}</span> : null}
                    </label>
                  );
                })}
              </div>
            </section>
          );
        })}

        <Separator />

        <section className="space-y-3">
          <div>
            <Label htmlFor="quantidade" className="text-sm font-black">
              {measured ? `Quantidade (${unit})` : "Quantidade"}
            </Label>
            {measured ? <p className="mt-0.5 text-xs text-muted-foreground">Ajuste em passos de {step} {unit}.</p> : null}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="size-11 rounded-xl"
              aria-label="Diminuir quantidade"
              disabled={quantity <= minQty}
              onClick={() => setQuantity((q) => Math.max(minQty, Number((q - step).toFixed(3))))}
            >
              <Minus className="size-4" />
            </Button>
            <span id="quantidade" className="min-w-20 rounded-xl bg-muted/45 px-3 py-2 text-center text-base font-black tabular-nums">
              {quantity}{measured ? ` ${unit}` : ""}
            </span>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="size-11 rounded-xl"
              aria-label="Aumentar quantidade"
              disabled={Boolean(product.max_quantity && quantity >= product.max_quantity)}
              onClick={() =>
                setQuantity((q) => {
                  const next = Number((q + step).toFixed(3));
                  if (product.max_quantity && next > product.max_quantity) return q;
                  return next;
                })
              }
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </section>

        {product.allows_notes ? (
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="observacao" className="text-sm font-black">Observação <span className="font-normal text-muted-foreground">(opcional)</span></Label>
              <span className="text-[11px] tabular-nums text-muted-foreground">{notes.length}/280</span>
            </div>
            <Textarea id="observacao" value={notes} maxLength={280} onChange={(event) => setNotes(event.target.value)} placeholder="Ex.: sem cebola, molho separado…" className="min-h-20 rounded-xl" />
          </section>
        ) : null}
      </div>

      <div className="sticky bottom-0 space-y-2 border-t border-border bg-background/96 px-1 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        {!isComplete ? <p className="text-center text-xs font-medium text-muted-foreground">Falta escolher: {pendingGroups.map((g) => g.name).join(", ")}</p> : null}
        {priceUnavailable ? <p className="text-center text-xs font-medium text-destructive">Não foi possível confirmar o preço desta combinação. Altere uma escolha ou tente novamente.</p> : null}
        {cartError ? <p className="text-center text-xs font-medium text-destructive">{cartError}</p> : null}
        <Button
          className="h-14 w-full rounded-xl text-base font-black"
          onClick={submit}
          disabled={!isComplete || !storeOpen || product.is_sold_out || !price?.ok}
          loading={pricing}
          loadingLabel="Calculando preço"
        >
          {pricing ? (
            "Calculando preço…"
          ) : product.is_sold_out ? (
            "Item esgotado"
          ) : !storeOpen ? (
            "Loja fechada"
          ) : priceUnavailable ? (
            "Preço indisponível"
          ) : isComplete && price?.ok ? (
            <>
              {editLineId ? "Salvar alterações" : "Adicionar ao carrinho"} · <span className="tabular-nums">{brl(price.total ?? 0)}</span>
            </>
          ) : (
            "Complete as escolhas"
          )}
        </Button>
        <p className="text-center text-[11px] text-muted-foreground">O valor final é confirmado pela loja antes do pedido.</p>
      </div>
    </div>
  );
}
