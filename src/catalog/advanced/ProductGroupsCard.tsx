import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { attachOptionGroup, detachOptionGroup, reorderProductOptionGroups } from "../advanced-api";
import {
  PRICE_EFFECT_LABELS,
  PRICING_STRATEGY_LABELS,
  SELECTION_TYPE_LABELS,
  type AdvancedBuilder,
  type OptionGroup,
} from "../advanced-types";
import { useCatalog } from "../CatalogProvider";

export function ProductGroupsCard({
  builder,
  library,
  onSaved,
}: {
  builder: AdvancedBuilder;
  library: OptionGroup[];
  onSaved: () => void;
}) {
  const { storeId, run, isBusy } = useCatalog();
  const [toAttach, setToAttach] = useState("");

  const product = builder.product;
  const canUpdate = builder.can.update && !product.is_archived;
  const linked = builder.groups;
  const linkedIds = new Set(linked.map((g) => g.id));
  const available = library.filter((g) => !g.is_archived && !linkedIds.has(g.id));
  const sharkDrafts = linked.filter((group) => Boolean(group.configuration?.shark_draft));

  async function move(index: number, delta: number) {
    if (!storeId) return;
    const next = [...linked];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    const done = await run(
      () => reorderProductOptionGroups(storeId, product.id, next.map((g) => g.link_id)),
      "Ordem dos grupos atualizada.",
    );
    if (done) onSaved();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Escolhas e montagem</CardTitle>
        <CardDescription>
          Configure só o que o cliente precisa escolher. Os grupos podem ser reaproveitados em outros produtos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sharkDrafts.length > 0 ? (
          <div className="rounded-2xl border border-violet-400/20 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,.12),transparent_45%),rgba(139,92,246,.045)] p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-500/12 text-violet-300"><Sparkles className="size-4" /></span>
              <div>
                <p className="text-sm font-bold">O Shark preparou {sharkDrafts.length} {sharkDrafts.length === 1 ? "rascunho" : "rascunhos"} para este produto</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Eles ainda não aparecem para o cliente. Adicione as opções, confira as regras e ative somente quando estiver tudo pronto.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {linked.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma escolha configurada. O cliente comprará apenas o produto e a variação.
          </p>
        ) : (
          <ul className="space-y-2">
            {linked.map((group, index) => {
              const isSharkDraft = Boolean(group.configuration?.shark_draft);
              const activeItems = group.items.filter((i) => i.is_active && !i.is_archived).length;
              return (
                <li
                  key={group.link_id}
                  className={`flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center ${isSharkDraft ? "border-violet-400/20 bg-violet-500/[.035]" : "border-border"}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{group.name}</span>
                      {isSharkDraft ? <Badge className="gap-1 bg-violet-500/12 text-violet-200 hover:bg-violet-500/12"><Sparkles className="size-3" />Sugestão Shark</Badge> : null}
                      {group.is_required ? <Badge>Obrigatório</Badge> : null}
                      {group.is_active ? null : <Badge variant="secondary">Rascunho</Badge>}
                      {group.portion_count ? <Badge variant="outline">{group.portion_count} porções</Badge> : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {SELECTION_TYPE_LABELS[group.selection_type]} · mín {group.min_selections} · máx {group.max_selections} · {PRICING_STRATEGY_LABELS[group.pricing_strategy]} · {PRICE_EFFECT_LABELS[group.price_effect]}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {activeItems > 0 ? `${activeItems} opção${activeItems === 1 ? "" : "ões"} pronta${activeItems === 1 ? "" : "s"}` : "Ainda sem opções — complete antes de ativar"}
                    </p>
                  </div>

                  {canUpdate ? (
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" aria-label="Mover grupo para cima" disabled={isBusy || index === 0} onClick={() => void move(index, -1)}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" aria-label="Mover grupo para baixo" disabled={isBusy || index === linked.length - 1} onClick={() => void move(index, 1)}>
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      {builder.can.archive ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isBusy}
                          onClick={() => void run(() => detachOptionGroup(storeId!, product.id, group.id), "Grupo removido do produto.").then(onSaved)}
                        >
                          Remover
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <div className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
          Para editar nomes, opções, preços e ativação, use a{" "}
          <Link to="/app/loja/cardapio/opcoes" className="font-semibold text-foreground underline underline-offset-2">
            biblioteca de escolhas
          </Link>.
        </div>

        {canUpdate ? (
          <div className="space-y-1.5 border-t border-border pt-4">
            <Label htmlFor="attach-group">Adicionar um grupo já existente</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={toAttach} onValueChange={setToAttach}>
                <SelectTrigger id="attach-group" className="sm:max-w-sm">
                  <SelectValue placeholder="Escolha um grupo" />
                </SelectTrigger>
                <SelectContent>
                  {available.length === 0 ? (
                    <SelectItem value="__none" disabled>Nenhum grupo disponível</SelectItem>
                  ) : (
                    available.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)
                  )}
                </SelectContent>
              </Select>
              <Button
                disabled={isBusy || toAttach === "" || toAttach === "__none"}
                onClick={() => void run(() => attachOptionGroup(storeId!, product.id, toAttach), "Grupo vinculado ao produto.").then(() => { setToAttach(""); onSaved(); })}
              >
                Adicionar
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
