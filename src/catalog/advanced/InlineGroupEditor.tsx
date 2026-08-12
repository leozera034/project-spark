import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Pencil, Plus, Save, Sparkles, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import {
  archiveOptionItem,
  createOptionItem,
  updateOptionGroup,
  updateOptionItem,
} from "../advanced-api";
import type { LinkedOptionGroup, OptionItem } from "../advanced-types";
import { useCatalog } from "../CatalogProvider";
import { publishSharkOptionGroup, updateOptionGroupEngine } from "../shark-groups.api";

function moneyInputToNumber(value: string) {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function formatMoneyInput(value: number) {
  return value.toFixed(2).replace(".", ",");
}

function EditableOptionRow({ item, onSaved }: { item: OptionItem; onSaved: () => void }) {
  const { storeId, run, isBusy } = useCatalog();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(formatMoneyInput(item.additional_price));

  async function save() {
    if (!storeId || !name.trim()) return;
    const parsedPrice = moneyInputToNumber(price);
    if (parsedPrice === null) return;
    const done = await run(
      () => updateOptionItem({
        storeId,
        id: item.id,
        name: name.trim(),
        additionalPrice: parsedPrice,
        description: item.description ?? "",
        maxQuantity: item.max_quantity,
        expectedUpdatedAt: item.updated_at,
      }),
      "Opção atualizada.",
    );
    if (done) {
      setEditing(false);
      onSaved();
    }
  }

  async function remove() {
    if (!storeId) return;
    const done = await run(
      () => archiveOptionItem(storeId, item.id, true, item.updated_at),
      "Opção removida.",
    );
    if (done) onSaved();
  }

  if (editing) {
    return (
      <div className="grid gap-2 rounded-xl border border-violet-400/20 bg-violet-500/[.035] p-2.5 sm:grid-cols-[1fr_130px_auto]">
        <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} aria-label="Nome da opção" />
        <Input value={price} onChange={(event) => setPrice(event.target.value)} inputMode="decimal" aria-label="Acréscimo de preço" />
        <div className="flex gap-1">
          <Button type="button" size="icon" variant="ghost" disabled={isBusy || !name.trim()} aria-label="Salvar opção" onClick={() => void save()}>
            <Save className="size-4" />
          </Button>
          <Button type="button" size="icon" variant="ghost" disabled={isBusy} aria-label="Cancelar edição" onClick={() => { setName(item.name); setPrice(formatMoneyInput(item.additional_price)); setEditing(false); }}>
            <X className="size-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/30 px-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{item.name}</p>
        <p className="text-xs text-muted-foreground">{item.additional_price > 0 ? `+ R$ ${formatMoneyInput(item.additional_price)}` : "Sem acréscimo"}</p>
      </div>
      <div className="flex gap-1">
        <Button type="button" size="icon" variant="ghost" aria-label={`Editar ${item.name}`} disabled={isBusy} onClick={() => setEditing(true)}>
          <Pencil className="size-4" />
        </Button>
        <Button type="button" size="icon" variant="ghost" aria-label={`Remover ${item.name}`} disabled={isBusy} onClick={() => void remove()}>
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export function InlineGroupEditor({
  group,
  onSaved,
}: {
  group: LinkedOptionGroup;
  onSaved: () => void;
}) {
  const { storeId, run, isBusy } = useCatalog();
  const [open, setOpen] = useState(Boolean(group.configuration?.shark_draft));
  const [name, setName] = useState(group.name);
  const [required, setRequired] = useState(group.is_required);
  const [min, setMin] = useState(String(group.min_selections));
  const [max, setMax] = useState(String(group.max_selections));
  const [included, setIncluded] = useState(String(group.included_selections ?? 0));
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("0,00");

  const activeItems = useMemo(
    () => group.items.filter((item) => item.is_active && !item.is_archived),
    [group.items],
  );

  const parsedMin = Math.max(0, Number.parseInt(min || "0", 10) || 0);
  const parsedMax = Math.max(1, Number.parseInt(max || "1", 10) || 1);
  const parsedIncluded = Math.max(0, Number.parseInt(included || "0", 10) || 0);
  const effectiveMin = required ? Math.max(1, parsedMin) : parsedMin;
  const limitsValid = effectiveMin <= parsedMax && parsedIncluded <= parsedMax;
  const canPublish = limitsValid && activeItems.length >= effectiveMin && activeItems.length > 0;

  async function persistRules() {
    if (!storeId || !limitsValid || !name.trim()) return null;
    const base = await updateOptionGroup(
      storeId,
      group.id,
      {
        name: name.trim(),
        description: group.description ?? "",
        selectionType: group.selection_type,
        isRequired: required,
        minSelections: effectiveMin,
        maxSelections: parsedMax,
        pricingStrategy: group.pricing_strategy,
        priceEffect: group.price_effect,
        portionCount: group.portion_count,
      },
      group.updated_at,
    );
    await updateOptionGroupEngine({
      storeId,
      id: group.id,
      role: group.role,
      includedSelections: parsedIncluded,
      configuration: group.configuration ?? {},
    });
    return base;
  }

  async function saveRules() {
    const result = await run(() => persistRules(), "Regras salvas.");
    if (result) onSaved();
  }

  async function addItem() {
    if (!storeId || !newItemName.trim()) return;
    const price = moneyInputToNumber(newItemPrice);
    if (price === null) return;
    const created = await run(
      () => createOptionItem({
        storeId,
        groupId: group.id,
        name: newItemName.trim(),
        additionalPrice: price,
        description: "",
        maxQuantity: 1,
      }),
      "Opção adicionada.",
    );
    if (created) {
      setNewItemName("");
      setNewItemPrice("0,00");
      onSaved();
    }
  }

  async function publish() {
    if (!storeId || !canPublish) return;
    const done = await run(async () => {
      await persistRules();
      return publishSharkOptionGroup(storeId, group.id);
    }, "Grupo publicado no produto.");
    if (done) {
      setOpen(false);
      onSaved();
    }
  }

  return (
    <div className="rounded-2xl border border-violet-400/18 bg-black/10">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{group.name}</span>
            {group.configuration?.shark_draft ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/12 px-2 py-0.5 text-[11px] font-semibold text-violet-200">
                <Sparkles className="size-3" /> Rascunho Shark
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{activeItems.length} opção{activeItems.length === 1 ? "" : "ões"} · mín {group.min_selections} · máx {group.max_selections}</p>
        </div>
        {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </button>

      {open ? (
        <div className="space-y-5 border-t border-border/70 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nome que o cliente verá</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
            </div>
            <div className="space-y-1.5"><Label>Mínimo</Label><Input type="number" min={0} max={99} value={min} onChange={(event) => setMin(event.target.value)} /></div>
            <div className="space-y-1.5"><Label>Máximo</Label><Input type="number" min={1} max={99} value={max} onChange={(event) => setMax(event.target.value)} /></div>
            <div className="space-y-1.5"><Label>Incluídos grátis</Label><Input type="number" min={0} max={99} value={included} onChange={(event) => setIncluded(event.target.value)} /></div>
            <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border px-3">
              <span className="text-sm font-medium">Escolha obrigatória</span>
              <Switch checked={required} onCheckedChange={(checked) => setRequired(Boolean(checked))} />
            </label>
          </div>

          {!limitsValid ? <p className="text-xs font-medium text-destructive">Confira mínimo, máximo e quantidade incluída.</p> : null}

          <div className="space-y-2">
            <div>
              <p className="text-sm font-semibold">Opções</p>
              <p className="text-xs text-muted-foreground">Adicione o que o cliente poderá escolher. O preço informado é somente o acréscimo.</p>
            </div>

            {activeItems.length > 0 ? (
              <div className="space-y-2">{activeItems.map((item) => <EditableOptionRow key={item.id} item={item} onSaved={onSaved} />)}</div>
            ) : (
              <div className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">Nenhuma opção ainda. Comece adicionando abaixo.</div>
            )}

            <div className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
              <Input value={newItemName} onChange={(event) => setNewItemName(event.target.value)} placeholder="Ex.: Calabresa" maxLength={80} />
              <Input value={newItemPrice} onChange={(event) => setNewItemPrice(event.target.value)} inputMode="decimal" placeholder="0,00" />
              <Button type="button" variant="outline" disabled={isBusy || !newItemName.trim()} onClick={() => void addItem()}>
                <Plus className="mr-1.5 size-4" /> Adicionar
              </Button>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={isBusy || !limitsValid || !name.trim()} onClick={() => void saveRules()}>Salvar rascunho</Button>
            <Button type="button" disabled={isBusy || !canPublish || !name.trim()} onClick={() => void publish()}>
              <Check className="mr-1.5 size-4" /> Publicar grupo
            </Button>
          </div>
          {!canPublish ? <p className="text-right text-[11px] text-muted-foreground">Para publicar, adicione opções suficientes para cumprir o mínimo configurado.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
