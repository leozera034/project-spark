import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  archiveNeighborhood,
  reorderNeighborhoods,
  upsertNeighborhood,
} from "@/store-config/api";
import { formatCurrencyInput, parseCurrencyInput } from "@/store-config/form-kit";
import { useStoreConfig } from "@/store-config/StoreConfigProvider";
import { resolveEta, resolveMinOrder, type StoreConfigNeighborhood } from "@/store-config/types";

export const Route = createFileRoute("/app/loja/configuracoes/bairros")({
  component: BairrosSection,
});

interface Draft {
  id: string | null;
  name: string;
  fee: string;
  minOrder: string;
  eta: string;
  notes: string;
  isActive: boolean;
}

const EMPTY_DRAFT: Draft = {
  id: null,
  name: "",
  fee: "0,00",
  minOrder: "",
  eta: "40",
  notes: "",
  isActive: true,
};

function toDraft(item: StoreConfigNeighborhood): Draft {
  return {
    id: item.id,
    name: item.name,
    fee: formatCurrencyInput(item.delivery_fee),
    minOrder: item.min_order_amount == null ? "" : formatCurrencyInput(item.min_order_amount),
    eta: String(item.eta_minutes),
    notes: item.notes ?? "",
    isActive: item.is_active,
  };
}

function BairrosSection() {
  const { configuration, storeId, save, isSaving } = useStoreConfig();
  const canEdit = configuration?.can.manage_neighborhoods ?? false;
  const settings = configuration?.settings;
  const all = configuration?.neighborhoods ?? [];
  const active = all.filter((n) => !n.is_archived);
  const archived = all.filter((n) => n.is_archived);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const submit = () => {
    if (!storeId || !draft) return;
    const fee = parseCurrencyInput(draft.fee);
    const eta = Number(draft.eta);
    if (draft.name.trim().length < 2 || fee == null || fee < 0 || !Number.isInteger(eta)) return;
    void save(
      () =>
        upsertNeighborhood({
          storeId,
          id: draft.id,
          name: draft.name,
          deliveryFee: fee,
          minOrderAmount: parseCurrencyInput(draft.minOrder),
          etaMinutes: eta,
          notes: draft.notes,
          isActive: draft.isActive,
        }),
      draft.id ? "Bairro atualizado." : "Bairro adicionado.",
    ).then((ok) => {
      if (ok) setDraft(null);
    });
  };

  const move = (index: number, direction: -1 | 1) => {
    if (!storeId) return;
    const next = [...active];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    void save(
      () =>
        reorderNeighborhoods(
          storeId,
          next.map((n) => n.id),
        ),
      "Ordem atualizada.",
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Bairros atendidos</CardTitle>
            <CardDescription>
              Taxa, pedido mínimo e prazo por bairro. O valor do bairro tem prioridade sobre o
              padrão da loja.
            </CardDescription>
          </div>
          {canEdit ? (
            <Button type="button" className="min-h-11" onClick={() => setDraft(EMPTY_DRAFT)}>
              Adicionar
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {active.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nenhum bairro cadastrado ainda.
            </p>
          ) : (
            active.map((item, index) => (
              <div key={item.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Taxa R$ {formatCurrencyInput(item.delivery_fee)} · Mínimo R${" "}
                      {formatCurrencyInput(
                        resolveMinOrder(item, settings?.min_order_amount ?? 0),
                      )}{" "}
                      · {resolveEta(item, settings?.default_prep_minutes)} min
                    </p>
                    {item.notes ? (
                      <p className="mt-1 text-xs text-muted-foreground">{item.notes}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {!item.is_active ? <Badge variant="secondary">Pausado</Badge> : null}
                    {canEdit ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="min-h-11 min-w-11"
                          aria-label={`Mover ${item.name} para cima`}
                          disabled={index === 0 || isSaving}
                          onClick={() => move(index, -1)}
                        >
                          ↑
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="min-h-11 min-w-11"
                          aria-label={`Mover ${item.name} para baixo`}
                          disabled={index === active.length - 1 || isSaving}
                          onClick={() => move(index, 1)}
                        >
                          ↓
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11"
                          onClick={() => setDraft(toDraft(item))}
                        >
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="min-h-11"
                          onClick={() =>
                            storeId &&
                            void save(
                              () => archiveNeighborhood(storeId, item.id, true),
                              "Bairro arquivado.",
                            )
                          }
                        >
                          Arquivar
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {draft ? (
        <Card>
          <CardHeader>
            <CardTitle>{draft.id ? "Editar bairro" : "Novo bairro"}</CardTitle>
            <CardDescription>
              Deixe o pedido mínimo em branco para usar o padrão da loja.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nb-name">Nome do bairro</Label>
              <Input
                id="nb-name"
                value={draft.name}
                maxLength={80}
                className="h-12 text-base"
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="nb-fee">Taxa de entrega</Label>
                <Input
                  id="nb-fee"
                  inputMode="decimal"
                  value={draft.fee}
                  className="h-12 text-base"
                  onChange={(e) => setDraft({ ...draft, fee: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nb-min">Pedido mínimo</Label>
                <Input
                  id="nb-min"
                  inputMode="decimal"
                  placeholder="Padrão da loja"
                  value={draft.minOrder}
                  className="h-12 text-base"
                  onChange={(e) => setDraft({ ...draft, minOrder: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nb-eta">Prazo (min)</Label>
                <Input
                  id="nb-eta"
                  inputMode="numeric"
                  value={draft.eta}
                  className="h-12 text-base"
                  onChange={(e) => setDraft({ ...draft, eta: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nb-notes">Observações internas</Label>
              <Textarea
                id="nb-notes"
                value={draft.notes}
                maxLength={200}
                className="text-base"
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <Label htmlFor="nb-active" className="text-sm font-medium">
                Disponível para pedidos
              </Label>
              <Switch
                id="nb-active"
                checked={draft.isActive}
                onCheckedChange={(v) => setDraft({ ...draft, isActive: v })}
              />
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                className="min-h-13"
                onClick={() => setDraft(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="min-h-13"
                loading={isSaving}
                loadingLabel="Salvando"
                onClick={submit}
              >
                {isSaving ? "Salvando…" : "Salvar bairro"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {archived.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bairros arquivados ({archived.length})</CardTitle>
            <CardDescription>
              Arquivados não aparecem para o cliente, mas o histórico de pedidos é preservado.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setShowArchived((v) => !v)}
            >
              {showArchived ? "Ocultar" : "Mostrar"}
            </Button>
            {showArchived
              ? archived.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border border-border p-4"
                  >
                    <span className="text-sm text-muted-foreground">{item.name}</span>
                    {canEdit ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11"
                        onClick={() =>
                          storeId &&
                          void save(
                            () => archiveNeighborhood(storeId, item.id, false),
                            "Bairro restaurado.",
                          )
                        }
                      >
                        Restaurar
                      </Button>
                    ) : null}
                  </div>
                ))
              : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
