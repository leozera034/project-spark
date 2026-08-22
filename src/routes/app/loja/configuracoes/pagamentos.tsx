import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { reorderPaymentMethods, updatePaymentMethod } from "@/store-config/api";
import { useStoreConfig } from "@/store-config/StoreConfigProvider";
import type { StoreConfigPaymentMethod } from "@/store-config/types";

export const Route = createFileRoute("/app/loja/configuracoes/pagamentos")({ component: PagamentosSection });

function PagamentosSection() {
  const { configuration, storeId, save, isSaving } = useStoreConfig();
  const canEdit = configuration?.can.manage_payment_methods ?? false;
  const methods = configuration?.payment_methods ?? [];
  const anyActive = methods.some((m) => m.is_active);

  const move = (index: number, direction: -1 | 1) => {
    if (!storeId) return;
    const next = [...methods];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    void save(() => reorderPaymentMethods(storeId, next.map((m) => m.id)), "Ordem atualizada.");
  };

  return (
    <div className="space-y-6">
      {!anyActive ? <Alert><AlertDescription>Ative pelo menos uma forma de pagamento para o cliente conseguir finalizar o pedido.</AlertDescription></Alert> : null}
      <Card>
        <CardHeader>
          <CardTitle>Pagamentos aceitos no pedido</CardTitle>
          <CardDescription>Escolha o que o cliente pode selecionar na entrega ou na retirada e adicione instruções quando necessário.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {methods.map((method, index) => <MethodRow key={method.id} method={method} canEdit={canEdit} saving={isSaving} isFirst={index === 0} isLast={index === methods.length - 1} onMove={(direction) => move(index, direction)} />)}
        </CardContent>
      </Card>
    </div>
  );
}

function MethodRow({ method, canEdit, saving, isFirst, isLast, onMove }: { method: StoreConfigPaymentMethod; canEdit: boolean; saving: boolean; isFirst: boolean; isLast: boolean; onMove: (direction: -1 | 1) => void }) {
  const { storeId, save } = useStoreConfig();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(method.label);
  const [instructions, setInstructions] = useState(method.instructions ?? "");
  const [needsChange, setNeedsChange] = useState(method.needs_change);
  const [delivery, setDelivery] = useState(method.available_for_delivery);
  const [pickup, setPickup] = useState(method.available_for_pickup);

  const persist = (overrides?: Partial<Parameters<typeof updatePaymentMethod>[0]>) => {
    if (!storeId) return;
    void save(() => updatePaymentMethod({ storeId, id: method.id, label, instructions, needsChange, isActive: method.is_active, availableForDelivery: delivery, availableForPickup: pickup, ...overrides }), "Forma de pagamento atualizada.");
  };

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{method.label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{[method.available_for_delivery ? "Entrega" : null, method.available_for_pickup ? "Retirada" : null].filter(Boolean).join(" · ") || "Sem disponibilidade definida"}</p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit ? <>
            <Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label={`Mover ${method.label} para cima`} disabled={isFirst || saving} onClick={() => onMove(-1)}>↑</Button>
            <Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label={`Mover ${method.label} para baixo`} disabled={isLast || saving} onClick={() => onMove(1)}>↓</Button>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setOpen((v) => !v)}>{open ? "Fechar" : "Editar"}</Button>
          </> : null}
          <Switch checked={method.is_active} disabled={!canEdit || saving} aria-label={`${method.label} ativo`} onCheckedChange={(checked) => persist({ isActive: checked })} />
        </div>
      </div>

      {open && canEdit ? (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          <div className="space-y-1.5"><Label htmlFor={`pm-label-${method.id}`}>Nome exibido ao cliente</Label><Input id={`pm-label-${method.id}`} value={label} maxLength={60} className="h-12 text-base" onChange={(e) => setLabel(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor={`pm-inst-${method.id}`}>Instruções</Label><Textarea id={`pm-inst-${method.id}`} value={instructions} maxLength={200} className="text-base" onChange={(e) => setInstructions(e.target.value)} /></div>
          <div className="flex items-center justify-between rounded-lg border border-border p-4"><Label htmlFor={`pm-change-${method.id}`} className="text-sm">Perguntar troco ao cliente</Label><Switch id={`pm-change-${method.id}`} checked={needsChange} onCheckedChange={setNeedsChange} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border border-border p-4"><Label htmlFor={`pm-del-${method.id}`} className="text-sm">Disponível na entrega</Label><Switch id={`pm-del-${method.id}`} checked={delivery} onCheckedChange={setDelivery} /></div>
            <div className="flex items-center justify-between rounded-lg border border-border p-4"><Label htmlFor={`pm-pick-${method.id}`} className="text-sm">Disponível na retirada</Label><Switch id={`pm-pick-${method.id}`} checked={pickup} onCheckedChange={setPickup} /></div>
          </div>
          <div className="flex justify-end"><Button type="button" className="min-h-13" loading={saving} loadingLabel="Salvando" onClick={() => persist()}>{saving ? "Salvando…" : "Salvar"}</Button></div>
        </div>
      ) : null}
    </div>
  );
}
