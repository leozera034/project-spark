import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  archiveOptionItem,
  detachOptionGroup,
  updateOptionGroup,
  updateOptionItem,
} from "../advanced-api";
import type { AdvancedBuilder, LinkedOptionGroup, OptionItem } from "../advanced-types";
import { useCatalog } from "../CatalogProvider";
import {
  createComboChoice,
  createProductOptionGroupFromTemplate,
  listComboCatalogCandidates,
} from "../shark-groups.api";
import { formatPriceBRL, parsePriceInput } from "../types";

const STEP_SUGGESTIONS = [
  "Escolha o item principal",
  "Escolha o acompanhamento",
  "Escolha a bebida",
  "Escolha o tamanho da bebida",
  "Escolha os adicionais",
];

type ChoiceDraft = {
  productId: string;
  variantId: string;
  label: string;
  price: string;
};

type EditChoiceDraft = { label: string; price: string };

const EMPTY_CHOICE: ChoiceDraft = { productId: "", variantId: "", label: "", price: "0,00" };

export function ComboBuilderCard({ builder, onSaved }: { builder: AdvancedBuilder; onSaved: () => void }) {
  const { storeId, run, isBusy } = useCatalog();
  const isCombo = builder.product.product_type === "combo" || Boolean(builder.product.capabilities?.combo_steps);
  const [stepName, setStepName] = useState("");
  const [openStep, setOpenStep] = useState<string | null>(null);
  const [renamingStep, setRenamingStep] = useState<string | null>(null);
  const [stepRename, setStepRename] = useState("");
  const [choiceDrafts, setChoiceDrafts] = useState<Record<string, ChoiceDraft>>({});
  const [editingChoice, setEditingChoice] = useState<string | null>(null);
  const [choiceEdit, setChoiceEdit] = useState<EditChoiceDraft>({ label: "", price: "0,00" });

  const candidates = useQuery({
    queryKey: ["catalog", "combo-candidates", storeId, builder.product.id],
    queryFn: () => listComboCatalogCandidates(storeId!, builder.product.id),
    enabled: Boolean(storeId) && isCombo,
  });

  const steps = useMemo(
    () => builder.groups.filter((group) => group.role === "combo_step"),
    [builder.groups],
  );

  if (!isCombo || !builder.can.update || builder.product.is_archived) return null;

  const createStep = async () => {
    if (!storeId || stepName.trim().length < 2) return;
    const result = await run(
      () => createProductOptionGroupFromTemplate({
        storeId,
        productId: builder.product.id,
        name: stepName.trim(),
        role: "combo_step",
        required: true,
        min: 1,
        max: 1,
        included: 0,
        selectionType: "unica",
        configuration: { combo_step: true },
      }),
      "Etapa do combo criada.",
    );
    if (result) {
      setStepName("");
      setOpenStep(result.group_id);
      onSaved();
    }
  };

  const draftFor = (groupId: string) => choiceDrafts[groupId] ?? EMPTY_CHOICE;

  const addChoice = async (groupId: string) => {
    if (!storeId) return;
    const draft = draftFor(groupId);
    const candidate = candidates.data?.find((item) => item.id === draft.productId);
    if (!candidate) return;
    const variant = draft.variantId ? candidate.variants.find((item) => item.id === draft.variantId) : null;
    const price = parsePriceInput(draft.price);
    if (price === null || price < 0) return;
    const label = draft.label.trim() || `${candidate.name}${variant ? ` · ${variant.name}` : ""}`;
    const result = await run(
      () => createComboChoice({
        storeId,
        groupId,
        name: label,
        linkedProductId: candidate.id,
        linkedVariantId: variant?.id ?? null,
        priceDifference: price,
      }),
      "Opção adicionada ao combo.",
    );
    if (result) {
      setChoiceDrafts((prev) => ({ ...prev, [groupId]: EMPTY_CHOICE }));
      onSaved();
    }
  };

  const beginRenameStep = (step: LinkedOptionGroup) => {
    setRenamingStep(step.id);
    setStepRename(step.name);
  };

  const saveStepName = async (step: LinkedOptionGroup) => {
    if (!storeId || stepRename.trim().length < 2) return;
    const done = await run(
      () => updateOptionGroup(storeId, step.id, {
        name: stepRename.trim(),
        description: step.description ?? "",
        selectionType: step.selection_type,
        isRequired: step.is_required,
        minSelections: step.min_selections,
        maxSelections: step.max_selections,
        pricingStrategy: step.pricing_strategy,
        priceEffect: step.price_effect,
        portionCount: step.portion_count,
      }, step.updated_at),
      "Nome da etapa atualizado.",
    );
    if (done) {
      setRenamingStep(null);
      onSaved();
    }
  };

  const removeStep = async (step: LinkedOptionGroup) => {
    if (!storeId) return;
    const done = await run(
      () => detachOptionGroup(storeId, builder.product.id, step.id),
      "Etapa removida do combo.",
    );
    if (done) onSaved();
  };

  const beginChoiceEdit = (item: OptionItem) => {
    setEditingChoice(item.id);
    setChoiceEdit({ label: item.name, price: String(item.additional_price).replace(".", ",") });
  };

  const saveChoice = async (item: OptionItem) => {
    if (!storeId || !choiceEdit.label.trim()) return;
    const price = parsePriceInput(choiceEdit.price);
    if (price === null || price < 0) return;
    const done = await run(
      () => updateOptionItem({
        storeId,
        id: item.id,
        name: choiceEdit.label.trim(),
        additionalPrice: price,
        description: item.description ?? "",
        maxQuantity: item.max_quantity,
        expectedUpdatedAt: item.updated_at,
      }),
      "Opção do combo atualizada.",
    );
    if (done) {
      setEditingChoice(null);
      onSaved();
    }
  };

  const removeChoice = async (item: OptionItem) => {
    if (!storeId) return;
    const done = await run(
      () => archiveOptionItem(storeId, item.id, true, item.updated_at),
      "Opção removida da etapa.",
    );
    if (done) onSaved();
  };

  const completedSteps = steps.filter((step) => step.items.some((item) => item.is_active && !item.is_archived)).length;

  return (
    <Card className="overflow-hidden border-violet-400/20 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,.1),transparent_45%),var(--card)]">
      <CardHeader>
        <div className="mb-2 flex items-center gap-2">
          <Boxes className="size-4 text-violet-400" />
          <Badge variant="outline">Combo guiado</Badge>
        </div>
        <CardTitle className="text-base">Monte o combo em etapas</CardTitle>
        <CardDescription>
          Pense como o cliente compra: primeiro o item principal, depois acompanhamento, bebida e extras. O Shark cuida dos vínculos técnicos por trás.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-background/25 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Etapas</p>
            <p className="mt-1 text-xl font-black">{steps.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-background/25 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Prontas</p>
            <p className="mt-1 text-xl font-black text-emerald-300">{completedSteps}</p>
          </div>
          <div className="rounded-xl border border-border bg-background/25 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Faltam configurar</p>
            <p className="mt-1 text-xl font-black text-violet-300">{Math.max(0, steps.length - completedSteps)}</p>
          </div>
        </div>

        {steps.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-violet-400/10 bg-violet-500/[.035] p-3">
            {steps.map((step, index) => {
              const ready = step.items.some((item) => item.is_active && !item.is_archived);
              return (
                <div key={step.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOpenStep(step.id)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${ready ? "border-emerald-400/15 bg-emerald-500/[.04]" : "border-violet-400/15 bg-violet-500/[.04]"}`}
                  >
                    <span className={`grid size-6 place-items-center rounded-full text-[11px] font-black ${ready ? "bg-emerald-500/15 text-emerald-200" : "bg-violet-500/15 text-violet-200"}`}>{index + 1}</span>
                    <span className="max-w-36 truncate">{step.name}</span>
                    {ready ? <CheckCircle2 className="size-3.5 text-emerald-300" /> : null}
                  </button>
                  {index < steps.length - 1 ? <ArrowRight className="size-4 text-muted-foreground/50" /> : null}
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="rounded-2xl border border-dashed border-violet-400/20 p-4">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-500/12 text-violet-200"><Sparkles className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Qual é a próxima escolha do cliente?</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Escolha uma sugestão ou escreva do seu jeito. Nada é criado até você confirmar.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {STEP_SUGGESTIONS.map((suggestion) => (
                  <button key={suggestion} type="button" onClick={() => setStepName(suggestion)} className="rounded-full border border-border bg-background/30 px-3 py-1.5 text-xs font-medium hover:border-violet-400/30 hover:bg-violet-500/[.05]">
                    {suggestion.replace("Escolha ", "")}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label>Nome da etapa</Label>
              <Input value={stepName} onChange={(e) => setStepName(e.target.value)} placeholder="Ex.: Escolha sua bebida" />
            </div>
            <Button disabled={isBusy || stepName.trim().length < 2} onClick={() => void createStep()}>
              <Plus className="mr-1.5 size-4" />Adicionar etapa
            </Button>
          </div>
        </div>

        {steps.length === 0 ? (
          <div className="rounded-2xl border border-border p-5 text-center">
            <Boxes className="mx-auto size-7 text-violet-300" />
            <p className="mt-3 font-semibold">Comece pela primeira decisão</p>
            <p className="mt-1 text-sm text-muted-foreground">Exemplo: “Escolha seu lanche”. Depois você adiciona as opções permitidas.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {steps.map((step, index) => {
              const draft = draftFor(step.id);
              const selectedProduct = candidates.data?.find((item) => item.id === draft.productId) ?? null;
              const activeItems = step.items.filter((item) => item.is_active && !item.is_archived);
              const opened = openStep === step.id || (!openStep && index === 0);
              const ready = activeItems.length > 0;

              return (
                <section key={step.id} className={`overflow-hidden rounded-2xl border ${ready ? "border-emerald-400/10" : "border-violet-400/15"}`}>
                  <button type="button" onClick={() => setOpenStep(opened ? null : step.id)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={`grid size-9 shrink-0 place-items-center rounded-xl text-sm font-black ${ready ? "bg-emerald-500/12 text-emerald-200" : "bg-violet-500/12 text-violet-200"}`}>{index + 1}</span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-bold">{step.name}</p>
                          {ready ? <Badge variant="secondary"><CheckCircle2 className="mr-1 size-3.5" />Pronta</Badge> : <Badge variant="outline">Falta opções</Badge>}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">O cliente escolhe 1 · {activeItems.length} opção{activeItems.length === 1 ? "" : "ões"}</p>
                      </div>
                    </div>
                    {opened ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  </button>

                  {opened ? (
                    <div className="space-y-5 border-t border-border/70 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        {renamingStep === step.id ? (
                          <div className="flex flex-1 gap-2">
                            <Input value={stepRename} onChange={(event) => setStepRename(event.target.value)} maxLength={80} />
                            <Button size="sm" disabled={isBusy || stepRename.trim().length < 2} onClick={() => void saveStepName(step)}>Salvar</Button>
                            <Button size="sm" variant="ghost" onClick={() => setRenamingStep(null)}>Cancelar</Button>
                          </div>
                        ) : (
                          <div>
                            <p className="text-sm font-semibold">Opções que o cliente pode escolher</p>
                            <p className="text-xs text-muted-foreground">Cada opção aponta para um produto real, então estoque e disponibilidade continuam funcionando.</p>
                          </div>
                        )}
                        {renamingStep !== step.id ? (
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => beginRenameStep(step)}><Pencil className="mr-1.5 size-3.5" />Renomear</Button>
                            <Button size="sm" variant="ghost" disabled={isBusy} onClick={() => void removeStep(step)}><Trash2 className="mr-1.5 size-3.5" />Remover etapa</Button>
                          </div>
                        ) : null}
                      </div>

                      {activeItems.length > 0 ? (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {activeItems.map((item) => {
                            const product = candidates.data?.find((candidate) => candidate.id === item.linked_product_id);
                            const variant = product?.variants.find((candidate) => candidate.id === item.linked_variant_id);
                            const editing = editingChoice === item.id;

                            return (
                              <div key={item.id} className="rounded-xl border border-border bg-background/25 p-3">
                                {editing ? (
                                  <div className="space-y-2">
                                    <div className="space-y-1"><Label>Nome exibido</Label><Input value={choiceEdit.label} onChange={(event) => setChoiceEdit({ ...choiceEdit, label: event.target.value })} /></div>
                                    <div className="space-y-1"><Label>Acréscimo</Label><Input inputMode="decimal" value={choiceEdit.price} onChange={(event) => setChoiceEdit({ ...choiceEdit, price: event.target.value })} /></div>
                                    <div className="flex gap-2"><Button size="sm" disabled={isBusy || !choiceEdit.label.trim() || parsePriceInput(choiceEdit.price) === null} onClick={() => void saveChoice(item)}>Salvar</Button><Button size="sm" variant="ghost" onClick={() => setEditingChoice(null)}>Cancelar</Button></div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0"><p className="truncate text-sm font-bold">{item.name}</p><p className="mt-1 text-xs text-muted-foreground">{product ? product.name : "Produto não vinculado"}{variant ? ` · ${variant.name}` : ""}</p></div>
                                      <div className="flex shrink-0 gap-1"><Button size="icon" variant="ghost" className="size-8" aria-label={`Editar ${item.name}`} onClick={() => beginChoiceEdit(item)}><Pencil className="size-3.5" /></Button><Button size="icon" variant="ghost" className="size-8" aria-label={`Remover ${item.name}`} disabled={isBusy} onClick={() => void removeChoice(item)}><Trash2 className="size-3.5" /></Button></div>
                                    </div>
                                    <p className={`mt-2 text-xs font-bold ${item.additional_price > 0 ? "text-violet-200" : "text-emerald-300"}`}>{item.additional_price > 0 ? `+ ${formatPriceBRL(item.additional_price)}` : "Incluso no combo"}</p>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Nenhuma opção ainda. Adicione abaixo o que o cliente poderá escolher nesta etapa.</div>
                      )}

                      <div className="rounded-2xl bg-muted/20 p-4">
                        <div className="mb-3"><p className="text-sm font-semibold">Adicionar opção</p><p className="text-xs text-muted-foreground">Escolha o produto real. Se quiser uma versão específica, selecione também o tamanho/variação.</p></div>
                        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_150px_auto] lg:items-end">
                          <div className="space-y-1.5">
                            <Label>Produto</Label>
                            <Select value={draft.productId} onValueChange={(value) => setChoiceDrafts((prev) => ({ ...prev, [step.id]: { ...draft, productId: value, variantId: "" } }))}>
                              <SelectTrigger><SelectValue placeholder="Escolha o produto" /></SelectTrigger>
                              <SelectContent>{(candidates.data ?? []).map((item) => <SelectItem key={item.id} value={item.id}>{item.name}{!item.is_available || item.is_sold_out ? " (indisponível)" : ""}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label>Tamanho / variação</Label>
                            <Select value={draft.variantId || "__default"} disabled={!selectedProduct || selectedProduct.variants.length === 0} onValueChange={(value) => setChoiceDrafts((prev) => ({ ...prev, [step.id]: { ...draft, variantId: value === "__default" ? "" : value } }))}>
                              <SelectTrigger><SelectValue placeholder="Padrão" /></SelectTrigger>
                              <SelectContent><SelectItem value="__default">Padrão do produto</SelectItem>{selectedProduct?.variants.map((variant) => <SelectItem key={variant.id} value={variant.id}>{variant.name}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5"><Label>Como aparece para o cliente</Label><Input value={draft.label} onChange={(event) => setChoiceDrafts((prev) => ({ ...prev, [step.id]: { ...draft, label: event.target.value } }))} placeholder={selectedProduct?.name ?? "Preenchido automaticamente"} /></div>
                          <div className="space-y-1.5"><Label>Acréscimo</Label><Input inputMode="decimal" value={draft.price} onChange={(event) => setChoiceDrafts((prev) => ({ ...prev, [step.id]: { ...draft, price: event.target.value } }))} placeholder="0,00" /></div>
                          <Button disabled={isBusy || !draft.productId || parsePriceInput(draft.price) === null} onClick={() => void addChoice(step.id)}><Plus className="mr-1.5 size-4" />Adicionar</Button>
                        </div>
                        <p className="mt-2 text-[11px] text-muted-foreground">Use R$ 0,00 quando a opção já estiver incluída no preço do combo. Ex.: Coca lata incluso; Coca 600 ml + R$ 3,00.</p>
                      </div>
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
