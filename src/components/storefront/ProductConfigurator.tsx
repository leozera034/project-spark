import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronLeft, ChevronRight, CircleDot, Minus, Plus, Sparkles } from "lucide-react";

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
type SharkVariant = PublicProductDetail["variants"][number] & { flavor_parts?: number | null };
type SharkProductDetail = Omit<PublicProductDetail, "variants"> & {
  variants: SharkVariant[];
  combo_available_choice_ids?: string[];
};

type Props = {
  slug: string;
  productId: string;
  storeOpen: boolean;
  editLineId?: string | null;
  onClose: () => void;
};

async function fetchProduct(slug: string, productId: string): Promise<SharkProductDetail> {
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
  return res.json() as Promise<{ ok: boolean; error?: string; total?: number; unit_price?: number; options_total?: number }>;
}

function groupInstruction(group: PublicOptionGroup, chosen: number, maxSelections = group.max_selections) {
  const min = group.is_required ? Math.max(1, group.min_selections) : group.min_selections;
  const missing = Math.max(0, min - chosen);
  const remaining = Math.max(0, maxSelections - chosen);
  const parts = [group.is_required ? "Obrigatório" : "Opcional"];
  if (maxSelections === 1) parts.push("escolha 1");
  else if (maxSelections > 1) parts.push(`até ${maxSelections}`);
  if (min > 0 && maxSelections !== 1) parts.push(`mínimo ${min}`);
  if (missing > 0) parts.push(`faltam ${missing}`);
  else if (remaining > 0 && chosen > 0 && maxSelections > 1) parts.push(`${remaining} restante${remaining > 1 ? "s" : ""}`);
  return parts.join(" · ");
}

function optionPriceLabel(group: PublicOptionGroup, value: number) {
  if (value <= 0) return null;
  return group.included_selections > 0 ? `Excedente + ${brl(value)}` : `+ ${brl(value)}`;
}

function flavorRuleLabel(rule: unknown) {
  if (rule === "highest") return "Preço pelo sabor de maior valor";
  if (rule === "average") return "Preço pela média dos sabores";
  if (rule === "proportional") return "Preço proporcional às partes";
  if (rule === "fixed_size") return "Preço fixo do tamanho";
  return null;
}

function slotsFromSelections(selections: Selection[], groupId: string, parts: number) {
  const slots: Array<string | null> = [];
  for (const selection of selections.filter((item) => item.option_group_id === groupId)) {
    for (let index = 0; index < selection.quantity && slots.length < parts; index += 1) slots.push(selection.option_item_id);
  }
  while (slots.length < parts) slots.push(null);
  return slots.slice(0, parts);
}

function selectionsFromSlots(groupId: string, slots: Array<string | null>): Selection[] {
  const counts = new Map<string, number>();
  for (const itemId of slots) if (itemId) counts.set(itemId, (counts.get(itemId) ?? 0) + 1);
  return Array.from(counts.entries()).map(([option_item_id, quantity]) => ({ option_group_id: groupId, option_item_id, quantity }));
}

function sanitizeSlots(slots: Array<string | null>, maxFlavors: number | null) {
  if (!maxFlavors) return slots;
  const allowed = new Set<string>();
  return slots.map((itemId) => {
    if (!itemId || allowed.has(itemId)) return itemId;
    if (allowed.size >= maxFlavors) return null;
    allowed.add(itemId);
    return itemId;
  });
}

export function ProductConfigurator({ slug, productId, storeOpen, editLineId = null, onClose }: Props) {
  const cart = useCart();
  const navigate = useNavigate();
  const [cartError, setCartError] = useState<string | null>(null);
  const { data, isPending, isError } = useQuery({
    queryKey: ["storefront-product", slug, productId],
    queryFn: () => fetchProduct(slug, productId),
    staleTime: 60_000,
  });

  const [variantId, setVariantId] = useState<string | null>(null);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [flavorSlots, setFlavorSlots] = useState<Record<string, Array<string | null>>>({});
  const [activeFlavorPart, setActiveFlavorPart] = useState<Record<string, number>>({});
  const [activeComboStep, setActiveComboStep] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!data) return;
    const editing = editLineId ? (cart.lines.find((line) => line.lineId === editLineId) ?? null) : null;
    const baseSelections: Selection[] = editing && editing.productId === data.product.id
      ? editing.selections.map((s) => ({ option_group_id: s.option_group_id, option_item_id: s.option_item_id, quantity: s.quantity }))
      : [];
    const fallback = editing && editing.productId === data.product.id
      ? data.variants.find((variant) => variant.id === editing.variantId) ?? null
      : data.variants.find((variant) => variant.is_default) ?? data.variants[0] ?? null;

    setVariantId(fallback?.id ?? null);
    setSelections(baseSelections);
    setQuantity(editing && editing.productId === data.product.id ? editing.quantity : Math.max(data.product.minimum_quantity, data.product.quantity_step));
    setNotes(editing && editing.productId === data.product.id ? (editing.notes ?? "") : "");
    setCartError(null);
    setActiveComboStep(0);

    const parts = fallback?.flavor_parts ?? fallback?.max_flavors ?? null;
    const initialSlots: Record<string, Array<string | null>> = {};
    if (parts && parts > 1) {
      for (const group of data.option_groups.filter((item) => item.role === "flavor")) initialSlots[group.id] = slotsFromSelections(baseSelections, group.id, parts);
    }
    setFlavorSlots(initialSlots);
    setActiveFlavorPart({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, editLineId]);

  const groups = data?.option_groups ?? [];
  const comboGroups = groups.filter((group) => group.role === "combo_step");
  const isGuidedCombo = data?.product.product_type === "combo" && comboGroups.length > 0;
  const availableComboIds = new Set(data?.combo_available_choice_ids ?? comboGroups.flatMap((group) => group.items.map((item) => item.id)));
  const selectedVariant = data?.variants.find((variant) => variant.id === variantId) ?? null;
  const selectedFlavorParts = selectedVariant?.flavor_parts ?? selectedVariant?.max_flavors ?? null;
  const selectedMaxFlavors = selectedVariant?.max_flavors ?? null;

  const countIn = (groupId: string) => selections.filter((s) => s.option_group_id === groupId).reduce((total, s) => total + s.quantity, 0);
  const distinctIn = (groupId: string) => selections.filter((s) => s.option_group_id === groupId).length;

  const effectiveGroupMax = (group: PublicOptionGroup) => {
    if (group.role !== "flavor") return group.max_selections;
    if (selectedFlavorParts && selectedFlavorParts > 1) return selectedFlavorParts;
    if (selectedMaxFlavors) return Math.min(group.max_selections, selectedMaxFlavors);
    return group.max_selections;
  };

  const pendingGroups = groups.filter((group) => {
    const chosen = countIn(group.id);
    if (group.role === "flavor" && selectedFlavorParts && selectedFlavorParts > 1) {
      if (chosen !== selectedFlavorParts) return true;
      if (selectedMaxFlavors && distinctIn(group.id) > selectedMaxFlavors) return true;
      return false;
    }
    const minimum = group.is_required ? Math.max(1, group.min_selections) : group.min_selections;
    return chosen < minimum || chosen > effectiveGroupMax(group);
  });
  const isComplete = pendingGroups.length === 0;
  const comboCompleteCount = comboGroups.filter((group) => !pendingGroups.some((pending) => pending.id === group.id)).length;

  const { data: price, isFetching: pricing } = useQuery({
    queryKey: ["storefront-price", slug, productId, variantId, quantity, selections],
    enabled: Boolean(data) && isComplete,
    staleTime: 0,
    queryFn: () => fetchPrice(slug, { product_id: productId, variant_id: variantId, quantity, selections }),
  });

  const changeVariant = (nextId: string) => {
    const next = data?.variants.find((variant) => variant.id === nextId) ?? null;
    const nextParts = next?.flavor_parts ?? next?.max_flavors ?? null;
    const maxFlavors = next?.max_flavors ?? null;
    const flavorGroups = groups.filter((group) => group.role === "flavor");
    const nonFlavorSelections = selections.filter((selection) => !flavorGroups.some((group) => group.id === selection.option_group_id));
    const nextSlotsByGroup: Record<string, Array<string | null>> = {};
    const nextFlavorSelections: Selection[] = [];
    for (const group of flavorGroups) {
      if (nextParts && nextParts > 1) {
        const source = flavorSlots[group.id] ?? slotsFromSelections(selections, group.id, nextParts);
        const resized = Array.from({ length: nextParts }, (_, index) => source[index] ?? null);
        const sanitized = sanitizeSlots(resized, maxFlavors);
        nextSlotsByGroup[group.id] = sanitized;
        nextFlavorSelections.push(...selectionsFromSlots(group.id, sanitized));
      } else {
        const legacy = selections.filter((selection) => selection.option_group_id === group.id);
        nextFlavorSelections.push(...(maxFlavors ? legacy.slice(0, maxFlavors) : legacy));
      }
    }
    setVariantId(nextId);
    setFlavorSlots(nextSlotsByGroup);
    setActiveFlavorPart({});
    setSelections([...nonFlavorSelections, ...nextFlavorSelections]);
  };

  const chooseFlavorPart = (group: PublicOptionGroup, partIndex: number, itemId: string) => {
    if (!selectedFlavorParts || selectedFlavorParts <= 1) return;
    const current = flavorSlots[group.id] ?? slotsFromSelections(selections, group.id, selectedFlavorParts);
    const next = [...current];
    next[partIndex] = itemId;
    if (selectedMaxFlavors && new Set(next.filter((item): item is string => Boolean(item))).size > selectedMaxFlavors) return;
    setFlavorSlots((previous) => ({ ...previous, [group.id]: next }));
    setSelections((previous) => [...previous.filter((selection) => selection.option_group_id !== group.id), ...selectionsFromSlots(group.id, next)]);
    const nextEmpty = next.findIndex((item, index) => index > partIndex && !item);
    if (nextEmpty >= 0) setActiveFlavorPart((previous) => ({ ...previous, [group.id]: nextEmpty }));
  };

  const toggleSingle = (groupId: string, itemId: string) => setSelections((prev) => [
    ...prev.filter((s) => s.option_group_id !== groupId),
    { option_group_id: groupId, option_item_id: itemId, quantity: 1 },
  ]);

  const chooseCombo = (group: PublicOptionGroup, itemId: string) => {
    toggleSingle(group.id, itemId);
    const index = comboGroups.findIndex((entry) => entry.id === group.id);
    if (index >= 0 && index < comboGroups.length - 1) window.setTimeout(() => setActiveComboStep(index + 1), 120);
  };

  const toggleMulti = (groupId: string, itemId: string, max: number) => setSelections((prev) => {
    const exists = prev.find((s) => s.option_group_id === groupId && s.option_item_id === itemId);
    if (exists) return prev.filter((s) => !(s.option_group_id === groupId && s.option_item_id === itemId));
    const current = prev.filter((s) => s.option_group_id === groupId).length;
    if (max > 0 && current >= max) return prev;
    return [...prev, { option_group_id: groupId, option_item_id: itemId, quantity: 1 }];
  });

  const bumpQuantity = (groupId: string, itemId: string, delta: number, maxItem: number, maxGroup: number) => setSelections((prev) => {
    const current = prev.find((s) => s.option_group_id === groupId && s.option_item_id === itemId);
    const groupTotal = prev.filter((s) => s.option_group_id === groupId).reduce((total, s) => total + s.quantity, 0);
    const next = (current?.quantity ?? 0) + delta;
    if (delta > 0 && maxGroup > 0 && groupTotal >= maxGroup) return prev;
    if (next <= 0) return prev.filter((s) => !(s.option_group_id === groupId && s.option_item_id === itemId));
    if (next > maxItem) return prev;
    if (current) return prev.map((s) => s.option_group_id === groupId && s.option_item_id === itemId ? { ...s, quantity: next } : s);
    return [...prev, { option_group_id: groupId, option_item_id: itemId, quantity: next }];
  });

  const submit = () => {
    if (!data || !price?.ok) return;
    const variant = data.variants.find((v) => v.id === variantId) ?? null;
    const itemName = (groupId: string, itemId: string) => data.option_groups.find((g) => g.id === groupId)?.items.find((i) => i.id === itemId)?.name ?? "";
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
    if (editLineId) { cart.replaceLine(editLineId, input); onClose(); return; }
    const result = cart.addLine(input);
    if (!result) { setCartError(CART_MESSAGES.limitReached); return; }
    onClose();
  };

  const openRecommendation = (id: string) => void navigate({ to: "/loja/$slug", params: { slug }, search: { produto: id }, replace: true });

  if (isPending) return <div className="space-y-4 p-1"><Skeleton className="h-40 w-full rounded-xl" /><Skeleton className="h-6 w-2/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /><Skeleton className="h-24 w-full" /></div>;
  if (isError || !data) return <div className="space-y-4 py-10 text-center"><p className="text-sm text-muted-foreground">Não conseguimos carregar este item agora.</p><Button variant="outline" onClick={onClose}>Voltar ao cardápio</Button></div>;

  const product = data.product;
  const measured = product.sale_mode === "measured";
  const unit = UNIT_LABELS[product.measurement_unit] ?? product.unit_label ?? "un";
  const step = product.quantity_step || 1;
  const minQty = product.minimum_quantity || step;
  const firstDecisionNumber = data.variants.length > 0 ? 1 : 0;
  const pricingRule = flavorRuleLabel(product.pricing_rules?.multi_flavor_pricing);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto px-1 pb-6">
        {product.image_url ? <img src={product.image_url} alt={product.name} loading="lazy" decoding="async" className="aspect-[16/10] w-full rounded-xl object-cover" /> : null}
        <div className="space-y-2">
          <h2 className="text-xl font-semibold leading-tight">{product.name}</h2>
          {product.description ? <p className="text-sm text-muted-foreground">{product.description}</p> : null}
          <div className="flex flex-wrap gap-2">
            {measured ? <Badge variant="secondary">Vendido por {unit} · mínimo {minQty} {unit}</Badge> : null}
            {product.product_type === "combo" ? <Badge variant="secondary">Combo personalizável</Badge> : null}
            {Boolean(product.capabilities?.multi_flavor) ? <Badge variant="secondary">Montagem multi-sabor</Badge> : null}
          </div>
        </div>

        {isGuidedCombo ? (
          <section className="rounded-3xl border border-violet-400/20 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,.15),transparent_45%),rgba(10,8,22,.5)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-violet-300">Monte seu combo</p><h3 className="mt-1 text-base font-bold">Etapa {Math.min(activeComboStep + 1, comboGroups.length)} de {comboGroups.length}</h3></div>
              <Badge variant="secondary">{comboCompleteCount}/{comboGroups.length} prontas</Badge>
            </div>
            <div className="mt-4 flex gap-1.5">
              {comboGroups.map((group, index) => {
                const done = !pendingGroups.some((pending) => pending.id === group.id);
                return <button key={group.id} type="button" aria-label={`Ir para ${group.name}`} onClick={() => setActiveComboStep(index)} className={`h-2 flex-1 rounded-full transition ${index === activeComboStep ? "bg-fuchsia-400" : done ? "bg-emerald-400/70" : "bg-white/10"}`} />;
              })}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Escolha uma opção por etapa. Quando você selecionar, o Shark avança automaticamente.</p>
          </section>
        ) : null}

        {data.variants.length > 0 ? (
          <section className="space-y-3 rounded-2xl border border-border/70 p-4">
            <header className="flex items-start gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-violet-500/15 text-xs font-black text-violet-200">1</span><div><h3 className="text-sm font-semibold">Escolha o tamanho</h3><p className="text-xs text-muted-foreground">O tamanho define preço e quantidade de partes.</p></div></header>
            <RadioGroup value={variantId ?? ""} onValueChange={changeVariant} className="space-y-2">
              {data.variants.map((variant) => {
                const parts = variant.flavor_parts ?? variant.max_flavors ?? null;
                return <label key={variant.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 transition hover:border-violet-400/30"><span className="flex items-center gap-3"><RadioGroupItem value={variant.id} id={variant.id} /><span className="text-sm font-medium">{variant.name}{variant.package_quantity ? <span className="block text-xs text-muted-foreground">{variant.package_quantity}{UNIT_LABELS[variant.package_unit ?? ""] ?? ""}</span> : null}{variant.max_flavors ? <span className="block text-xs font-medium text-violet-300">até {variant.max_flavors} sabor{variant.max_flavors > 1 ? "es" : ""}{parts && parts > 1 ? ` · ${parts} partes` : ""}</span> : null}</span></span><span className="text-sm font-semibold">{brl(variant.price)}</span></label>;
              })}
            </RadioGroup>
          </section>
        ) : null}

        {groups.map((group, groupIndex) => {
          const chosen = countIn(group.id);
          const maxSelections = effectiveGroupMax(group);
          const incomplete = pendingGroups.some((g) => g.id === group.id);
          const atLimit = maxSelections > 0 && chosen >= maxSelections;
          const decisionNumber = firstDecisionNumber + groupIndex + 1;
          const isPortionedFlavor = group.role === "flavor" && Boolean(selectedFlavorParts && selectedFlavorParts > 1);

          if (group.role === "combo_step" && isGuidedCombo) {
            const comboIndex = comboGroups.findIndex((entry) => entry.id === group.id);
            const active = comboIndex === activeComboStep;
            const selected = selections.find((entry) => entry.option_group_id === group.id);
            const selectedItem = group.items.find((item) => item.id === selected?.option_item_id);
            const availableItems = group.items.filter((item) => availableComboIds.has(item.id));
            if (!active) {
              return <button key={group.id} type="button" onClick={() => setActiveComboStep(comboIndex)} className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left ${selectedItem ? "border-emerald-400/15 bg-emerald-500/[.035]" : "border-border bg-black/10"}`}><div><p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Etapa {comboIndex + 1}</p><p className="mt-1 text-sm font-bold">{group.name}</p><p className="mt-1 text-xs text-muted-foreground">{selectedItem?.name ?? "Ainda não escolhido"}</p></div>{selectedItem ? <CheckCircle2 className="size-5 text-emerald-300" /> : <ChevronRight className="size-5 text-muted-foreground" />}</button>;
            }
            return (
              <section key={group.id} className="space-y-4 rounded-3xl border border-fuchsia-400/25 bg-fuchsia-500/[.035] p-4 shadow-[0_0_34px_rgba(217,70,239,.05)]">
                <header className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-fuchsia-300">Etapa {comboIndex + 1} de {comboGroups.length}</p><h3 className="mt-1 text-base font-bold">{group.name}</h3><p className="mt-1 text-xs text-muted-foreground">Escolha uma opção para continuar.</p></div>{selectedItem ? <Badge variant="secondary"><CheckCircle2 className="mr-1 size-3.5" />Escolhido</Badge> : <Badge variant="destructive">Obrigatório</Badge>}</header>
                {availableItems.length === 0 ? <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">Nenhuma opção disponível nesta etapa agora.</div> : <div className="grid gap-2 sm:grid-cols-2">{availableItems.map((item) => { const current = selected?.option_item_id === item.id; return <button type="button" key={item.id} onClick={() => chooseCombo(group, item.id)} className={`flex min-h-16 items-center justify-between gap-3 rounded-2xl border p-3 text-left transition ${current ? "border-fuchsia-400/50 bg-fuchsia-500/10" : "border-border bg-background/25 hover:border-violet-400/30"}`}><span className="flex min-w-0 items-center gap-3">{current ? <CheckCircle2 className="size-5 shrink-0 text-fuchsia-300" /> : <span className="size-5 shrink-0 rounded-full border border-border" />}<span className="min-w-0"><span className="block truncate text-sm font-semibold">{item.name}</span><span className="mt-0.5 block text-xs text-muted-foreground">{item.additional_price > 0 ? `+ ${brl(item.additional_price)}` : "Incluso no combo"}</span></span></span><ChevronRight className="size-4 shrink-0 text-muted-foreground" /></button>; })}</div>}
                <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3"><Button type="button" size="sm" variant="ghost" disabled={comboIndex === 0} onClick={() => setActiveComboStep(Math.max(0, comboIndex - 1))}><ChevronLeft className="mr-1 size-4" />Voltar</Button><Button type="button" size="sm" variant="outline" disabled={!selectedItem || comboIndex === comboGroups.length - 1} onClick={() => setActiveComboStep(Math.min(comboGroups.length - 1, comboIndex + 1))}>Próxima<ChevronRight className="ml-1 size-4" /></Button></div>
              </section>
            );
          }

          if (isPortionedFlavor && selectedFlavorParts) {
            const slots = flavorSlots[group.id] ?? slotsFromSelections(selections, group.id, selectedFlavorParts);
            const activePart = Math.min(activeFlavorPart[group.id] ?? Math.max(0, slots.findIndex((item) => !item)), selectedFlavorParts - 1);
            const safeActivePart = activePart < 0 ? 0 : activePart;
            const usedFlavorIds = new Set(slots.filter((item): item is string => Boolean(item)));
            const filled = slots.filter(Boolean).length;
            return <section key={group.id} className="space-y-4 rounded-3xl border border-violet-400/20 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,.12),transparent_42%),rgba(12,9,24,.45)] p-4"><header className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-black ${incomplete ? "bg-fuchsia-500/15 text-fuchsia-200" : "bg-emerald-500/15 text-emerald-200"}`}>{decisionNumber}</span><div><h3 className="text-sm font-bold">Monte os sabores por parte</h3><p className="mt-1 text-xs text-muted-foreground">{selectedVariant?.name}: preencha {selectedFlavorParts} parte{selectedFlavorParts > 1 ? "s" : ""}{selectedMaxFlavors ? ` usando até ${selectedMaxFlavors} sabores diferentes` : ""}.</p>{pricingRule ? <p className="mt-1 text-xs font-semibold text-violet-300">{pricingRule}</p> : null}</div></div><Badge variant={incomplete ? "destructive" : "secondary"}>{filled}/{selectedFlavorParts}</Badge></header><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{slots.map((itemId, index) => { const item = group.items.find((option) => option.id === itemId); const active = safeActivePart === index; return <button type="button" key={`${group.id}-part-${index}`} onClick={() => setActiveFlavorPart((previous) => ({ ...previous, [group.id]: index }))} className={`min-h-20 rounded-2xl border p-3 text-left transition ${active ? "border-fuchsia-400/55 bg-fuchsia-500/10 shadow-[0_0_28px_rgba(217,70,239,.10)]" : item ? "border-emerald-400/20 bg-emerald-500/[.045]" : "border-border bg-black/10"}`}><span className="text-[10px] font-black uppercase tracking-[.12em] text-muted-foreground">Parte {index + 1}</span><span className="mt-2 flex items-center gap-1.5 text-xs font-semibold leading-tight">{item ? <CheckCircle2 className="size-3.5 shrink-0 text-emerald-300" /> : <CircleDot className="size-3.5 shrink-0 text-violet-300" />}{item?.name ?? "Escolher sabor"}</span></button>; })}</div><div className="rounded-2xl border border-border/70 bg-black/10 p-3"><div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-sm font-bold">Sabor da Parte {safeActivePart + 1}</p><p className="text-xs text-muted-foreground">Toque em um sabor para preencher esta parte.</p></div>{selectedMaxFlavors ? <span className="text-[11px] font-semibold text-violet-300">{usedFlavorIds.size}/{selectedMaxFlavors} sabores</span> : null}</div><div className="grid gap-2 sm:grid-cols-2">{group.items.map((item) => { const current = slots[safeActivePart] === item.id; const alreadyUsed = usedFlavorIds.has(item.id); const blocked = Boolean(selectedMaxFlavors && !alreadyUsed && !current && usedFlavorIds.size >= selectedMaxFlavors); return <button type="button" key={item.id} disabled={blocked} onClick={() => chooseFlavorPart(group, safeActivePart, item.id)} className={`flex min-h-12 items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition ${current ? "border-fuchsia-400/50 bg-fuchsia-500/10" : "border-border bg-background/25 hover:border-violet-400/30"} disabled:cursor-not-allowed disabled:opacity-35`}><span className="flex items-center gap-2 text-sm font-medium">{current ? <CheckCircle2 className="size-4 text-fuchsia-300" /> : <span className="size-4 rounded-full border border-border" />}{item.name}</span><span className="text-xs font-semibold text-muted-foreground">{item.additional_price > 0 ? brl(item.additional_price) : "Incluso"}</span></button>; })}</div></div></section>;
          }

          return <section key={group.id} className="space-y-3 rounded-2xl border border-border/70 p-4"><header className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-black ${incomplete ? "bg-fuchsia-500/15 text-fuchsia-200" : chosen > 0 ? "bg-emerald-500/15 text-emerald-200" : "bg-violet-500/15 text-violet-200"}`}>{decisionNumber}</span><div><h3 className="text-sm font-semibold">{group.name}</h3><p className="mt-1 text-xs text-muted-foreground">{groupInstruction(group, chosen, maxSelections)}</p>{group.role === "flavor" && selectedVariant?.max_flavors ? <p className="mt-1 text-xs font-medium text-violet-300">O tamanho {selectedVariant.name} permite até {selectedVariant.max_flavors} sabor{selectedVariant.max_flavors > 1 ? "es" : ""}.</p> : null}{group.included_selections > 0 ? <p className="mt-1 text-xs font-medium text-emerald-300">Até {group.included_selections} escolha{group.included_selections > 1 ? "s" : ""} incluída{group.included_selections > 1 ? "s" : ""} no preço.</p> : null}</div></div>{incomplete ? <Badge variant="destructive">Falta escolher</Badge> : chosen > 0 ? <Badge variant="secondary"><CheckCircle2 className="mr-1 size-3.5" />{chosen}/{maxSelections}</Badge> : null}</header><div className="space-y-2">{group.items.map((item) => { const selected = selections.find((s) => s.option_group_id === group.id && s.option_item_id === item.id); const priceLabel = optionPriceLabel(group, item.additional_price); if (group.selection_type === "quantidade" || group.allow_quantity) return <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border p-3"><div className="min-w-0"><p className="truncate text-sm">{item.name}</p><p className="text-xs text-muted-foreground">{priceLabel ?? "Sem acréscimo"}</p></div><div className="flex shrink-0 items-center gap-2"><Button type="button" size="icon" variant="outline" className="size-8" disabled={!selected} onClick={() => bumpQuantity(group.id, item.id, -1, item.max_quantity, maxSelections)}><Minus className="size-4" /></Button><span className="w-5 text-center text-sm tabular-nums">{selected?.quantity ?? 0}</span><Button type="button" size="icon" variant="outline" className="size-8" disabled={atLimit || (selected?.quantity ?? 0) >= item.max_quantity} onClick={() => bumpQuantity(group.id, item.id, 1, item.max_quantity, maxSelections)}><Plus className="size-4" /></Button></div></div>; if (group.selection_type === "unica") return <label key={item.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3"><span className="flex items-center gap-3"><input type="radio" className="size-4" name={group.id} checked={Boolean(selected)} onChange={() => toggleSingle(group.id, item.id)} /><span className="text-sm">{item.name}</span></span><span className="text-xs text-muted-foreground">{priceLabel ?? "Incluso"}</span></label>; return <label key={item.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3"><span className="flex items-center gap-3"><Checkbox checked={Boolean(selected)} onCheckedChange={() => toggleMulti(group.id, item.id, maxSelections)} /><span className="text-sm">{item.name}</span></span><span className="text-xs text-muted-foreground">{priceLabel ?? "Sem acréscimo"}</span></label>; })}</div></section>;
        })}

        {isGuidedCombo && comboCompleteCount === comboGroups.length ? <section className="rounded-3xl border border-emerald-400/15 bg-emerald-500/[.035] p-4"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-300" /><div className="min-w-0"><h3 className="font-bold">Seu combo está montado</h3><p className="mt-1 text-xs text-muted-foreground">Confira antes de adicionar ao pedido.</p><div className="mt-3 space-y-2">{comboGroups.map((group, index) => { const selection = selections.find((entry) => entry.option_group_id === group.id); const item = group.items.find((entry) => entry.id === selection?.option_item_id); return <button key={group.id} type="button" onClick={() => setActiveComboStep(index)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-border/60 bg-black/10 px-3 py-2 text-left"><span><span className="block text-[10px] font-black uppercase tracking-wider text-muted-foreground">{index + 1}. {group.name}</span><span className="mt-0.5 block text-sm font-semibold">{item?.name ?? "Não escolhido"}</span></span><span className="text-xs font-semibold text-violet-300">Alterar</span></button>; })}</div></div></div></section> : null}

        <Separator />
        <section className="space-y-3"><Label htmlFor="quantidade" className="text-sm font-semibold">{measured ? `Quantidade (${unit})` : "Quantidade"}</Label><div className="flex items-center gap-3"><Button type="button" size="icon" variant="outline" onClick={() => setQuantity((q) => Math.max(minQty, Number((q - step).toFixed(3))))}><Minus className="size-4" /></Button><span id="quantidade" className="w-16 text-center text-base tabular-nums">{quantity}{measured ? ` ${unit}` : ""}</span><Button type="button" size="icon" variant="outline" onClick={() => setQuantity((q) => { const next = Number((q + step).toFixed(3)); if (product.max_quantity && next > product.max_quantity) return q; return next; })}><Plus className="size-4" /></Button></div></section>
        {product.allows_notes ? <section className="space-y-2"><Label htmlFor="observacao" className="text-sm font-semibold">Observação</Label><Textarea id="observacao" value={notes} maxLength={280} onChange={(event) => setNotes(event.target.value)} placeholder="Ex.: sem cebola" /></section> : null}
        {data.recommendations?.length > 0 && !editLineId ? <section className="space-y-3 rounded-2xl border border-violet-300/10 bg-violet-500/[.035] p-4"><header><p className="flex items-center gap-2 text-sm font-bold"><Sparkles className="size-4 text-fuchsia-300" />Combina com este item</p><p className="mt-1 text-xs text-muted-foreground">Sugestões baseadas no que costuma ser pedido junto nesta loja.</p></header><div className="flex gap-2 overflow-x-auto pb-1">{data.recommendations.map(({ product: suggested }) => <button key={suggested.id} type="button" onClick={() => openRecommendation(suggested.id)} className="w-32 shrink-0 overflow-hidden rounded-xl border border-violet-300/10 bg-black/15 text-left">{suggested.image_url ? <img src={suggested.image_url} alt="" className="aspect-square w-full object-cover" loading="lazy" /> : <div className="aspect-square w-full bg-gradient-to-br from-violet-950 to-fuchsia-950" />}<div className="p-2.5"><p className="line-clamp-2 text-xs font-bold leading-tight">{suggested.name}</p><p className="mt-1 text-xs font-semibold text-violet-200">{suggested.has_variants && suggested.from_price !== null ? `a partir de ${brl(suggested.from_price)}` : brl(suggested.base_price)}</p></div></button>)}</div></section> : null}
      </div>

      <div className="sticky bottom-0 space-y-2 border-t bg-background px-1 pb-2 pt-3">
        {!isComplete ? <p className="text-center text-xs text-muted-foreground">Falta ajustar: {pendingGroups.map((g) => g.name).join(", ")}</p> : null}
        {cartError ? <p className="text-center text-xs text-destructive">{cartError}</p> : null}
        <Button className="h-12 w-full text-base" onClick={submit} disabled={!isComplete || !storeOpen || product.is_sold_out || !price?.ok} loading={pricing} loadingLabel="Calculando preço">{pricing ? "Calculando preço…" : product.is_sold_out ? "Item esgotado" : !storeOpen ? "Loja fechada" : isComplete && price?.ok ? <>{editLineId ? "Salvar alterações" : "Adicionar"} · <span className="tabular-nums">{brl(price.total ?? 0)}</span></> : isGuidedCombo ? `Complete o combo · ${comboCompleteCount}/${comboGroups.length}` : "Complete as escolhas"}</Button>
        <p className="text-center text-[11px] text-muted-foreground">Preço final recalculado e validado no servidor da loja.</p>
      </div>
    </div>
  );
}
