import { useMemo, useState } from "react";
import { BellRing, CheckCircle2, ChevronDown, Loader2, PauseCircle, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import type { AutomationEventCode, AutomationRule } from "@/lib/store-growth.functions";
import { useStoreAutomationRules, useStoreGrowthActions } from "@/store/growth/store-growth.queries";

const EVENT_LABELS: Partial<Record<AutomationEventCode, string>> = {
  pedido_criado: "Pedido recebido",
  pedido_aceito: "Pedido confirmado",
  pedido_em_preparo: "Em preparo",
  pedido_pronto: "Pedido pronto",
  pedido_aguardando_entregador: "Aguardando entregador",
  pedido_saiu_para_entrega: "Saiu para entrega",
  pedido_aguardando_retirada: "Pronto para retirada",
  pedido_entregue: "Pedido entregue",
  pedido_retirado: "Pedido retirado",
  pedido_recusado: "Pedido recusado",
  pedido_cancelado: "Pedido cancelado",
  pedido_concluido: "Pedido concluído",
};

function isOrderAutomation(rule: AutomationRule) {
  return rule.event_code.startsWith("pedido_") && rule.action_code === "send_whatsapp_template";
}

export function WhatsAppAutomationControlCard({
  storeId,
  automaticEntitled,
}: {
  storeId: string;
  automaticEntitled: boolean;
}) {
  const rules = useStoreAutomationRules(storeId);
  const actions = useStoreGrowthActions();
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orderRules = useMemo(
    () => (rules.data ?? []).filter(isOrderAutomation),
    [rules.data],
  );
  const enabledCount = orderRules.filter((rule) => rule.is_enabled).length;
  const allEnabled = orderRules.length > 0 && enabledCount === orderRules.length;
  const anyEnabled = enabledCount > 0;
  const busy = bulkBusy || actions.saveRule.isPending;

  async function saveEnabled(rule: AutomationRule, enabled: boolean) {
    await actions.saveRule.mutateAsync({
      storeId,
      id: rule.id,
      eventCode: rule.event_code,
      name: rule.name,
      enabled,
      config: rule.config,
    });
  }

  async function setAll(enabled: boolean) {
    if (busy || orderRules.length === 0) return;
    setBulkBusy(true);
    setError(null);
    try {
      for (const rule of orderRules) {
        if (rule.is_enabled !== enabled) await saveEnabled(rule, enabled);
      }
    } catch {
      setError("Não foi possível atualizar todas as mensagens automáticas. Tente novamente.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function setOne(rule: AutomationRule, enabled: boolean) {
    if (busy) return;
    setError(null);
    try {
      await saveEnabled(rule, enabled);
    } catch {
      setError("Não foi possível alterar este aviso automático.");
    }
  }

  if (!automaticEntitled) return null;

  return (
    <Card className="overflow-hidden border-brand/15 shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
              <Zap className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-lg font-black tracking-tight">Mensagens automáticas</h2>
                <Badge variant={anyEnabled ? "success" : "secondary"}>
                  {anyEnabled ? "Ligadas" : "Pausadas"}
                </Badge>
              </div>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                Escolha quais atualizações do pedido o cliente recebe. O envio manual continua disponível mesmo com os avisos pausados.
              </p>
            </div>
          </div>
          {rules.isLoading ? (
            <Loader2 className="mt-1 size-5 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <Switch
              checked={anyEnabled}
              onCheckedChange={(checked) => void setAll(checked)}
              disabled={busy || orderRules.length === 0}
              aria-label="Ligar ou pausar todas as mensagens automáticas de pedido"
              className="mt-1"
            />
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="rounded-2xl bg-muted/45 px-3 py-3">
            <p className="text-xs font-semibold text-muted-foreground">Ativas</p>
            <p className="mt-1 text-lg font-black tabular-nums">{enabledCount}</p>
          </div>
          <div className="rounded-2xl bg-muted/45 px-3 py-3">
            <p className="text-xs font-semibold text-muted-foreground">Configuradas</p>
            <p className="mt-1 text-lg font-black tabular-nums">{orderRules.length}</p>
          </div>
          <div className="col-span-2 rounded-2xl bg-muted/45 px-3 py-3 sm:col-span-1">
            <p className="text-xs font-semibold text-muted-foreground">Cobertura</p>
            <p className="mt-1 text-sm font-bold">{allEnabled ? "Todos os momentos" : anyEnabled ? "Parcial" : "Pausada"}</p>
          </div>
        </div>

        {error ? (
          <p className="mt-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>
        ) : null}

        <details className="group mt-4 rounded-2xl border border-border bg-background">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5">
            <div className="flex min-w-0 items-center gap-2">
              {anyEnabled ? <BellRing className="size-4 text-brand" /> : <PauseCircle className="size-4 text-muted-foreground" />}
              <span className="truncate text-sm font-bold">Escolher quais avisos enviar</span>
            </div>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-1 border-t border-border p-2">
            {orderRules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/35">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{EVENT_LABELS[rule.event_code] ?? rule.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {rule.is_enabled ? "Cliente recebe uma mensagem neste momento" : "Aviso pausado"}
                  </p>
                </div>
                <Switch
                  checked={rule.is_enabled}
                  onCheckedChange={(checked) => void setOne(rule, checked)}
                  disabled={busy}
                  aria-label={`${rule.is_enabled ? "Pausar" : "Ativar"} ${EVENT_LABELS[rule.event_code] ?? rule.name}`}
                />
              </div>
            ))}
            {!rules.isLoading && orderRules.length === 0 ? (
              <div className="flex items-start gap-2 rounded-xl p-3 text-sm text-muted-foreground">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                Os avisos automáticos aparecerão aqui assim que a configuração estiver pronta.
              </div>
            ) : null}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
