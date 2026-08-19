import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock3,
  Gauge,
  MapPin,
  RefreshCw,
  RouteIcon,
  ShieldCheck,
  ShieldOff,
  WalletCards,
} from "lucide-react";

import { ErrorState } from "@/components/feedback/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type {
  SmartDeliveryOverallStatus,
  SmartDeliveryUsageItem,
} from "@/lib/store-smart-delivery.functions";
import {
  useSetStoreSmartDeliveryPause,
  useStoreSmartDeliveryControlCenter,
} from "@/store/integrations/store-smart-delivery.queries";
import { useStoreScope } from "@/store-scope/StoreScopeProvider";

export const Route = createFileRoute("/app/loja/smart-delivery")({
  head: () => ({
    meta: [
      { title: "Smart Delivery | Comandiva" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: SmartDeliveryControlCenterPage,
});

const STATUS_COPY: Record<SmartDeliveryOverallStatus, { label: string; variant: "default" | "warning" | "destructive" | "outline" }> = {
  ready: { label: "Pronto", variant: "default" },
  partial: { label: "Parcial", variant: "warning" },
  paused: { label: "Pausado pela loja", variant: "warning" },
  blocked: { label: "Bloqueado", variant: "outline" },
};

const DIAGNOSTIC_LABEL: Record<string, string> = {
  addon_not_entitled: "O add-on Smart Delivery não está ativo para esta loja.",
  store_paused: "A loja pausou o Smart Delivery manualmente.",
  provider_global_kill_switch: "A proteção global do provider está ligada.",
  api_key_missing: "A chave de servidor do openrouteservice ainda não está disponível para o backend.",
  billing_not_confirmed: "O gate técnico do provider ainda não foi liberado pela plataforma.",
  routes_api_disabled: "O serviço de rotas ainda não foi liberado pela plataforma.",
  geocoding_api_disabled: "O serviço de geocodificação ainda não foi liberado pela plataforma.",
  provider_health_error: "O último health check do provider registrou uma falha.",
  store_coordinates_missing: "A localização da loja ainda não possui coordenadas válidas.",
  routes_usage_limit_reached: "O limite interno de rotas foi atingido.",
  geocoding_usage_limit_reached: "O limite interno de geocodificação foi atingido.",
  failed_jobs_present: "Existem jobs de Smart Delivery que terminaram com falha.",
  stale_processing_jobs: "Existem jobs em processamento com lock expirado.",
};

const JOB_LABEL: Record<string, string> = {
  geocode_address: "Geocodificar endereço",
  compute_delivery_route: "Calcular rota",
};

function formatDateTime(value: string | null) {
  if (!value) return "Sem registro";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem registro";
  return date.toLocaleString("pt-BR");
}

function formatQuantity(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function providerLabel(provider: string) {
  return provider === "openrouteservice" ? "openrouteservice / HeiGIT" : provider;
}

function usageLabel(metric: SmartDeliveryUsageItem["metric_code"]) {
  return metric === "routes.compute" ? "Rotas inteligentes" : "Endereços geocodificados";
}

function usagePercent(item: SmartDeliveryUsageItem) {
  if (!item.hard_limit_units || item.hard_limit_units <= 0) return null;
  return Math.min(100, (item.quantity / item.hard_limit_units) * 100);
}

function ReadinessRow({ label, ready, detail }: { label: string; ready: boolean; detail: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border p-3">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
      </div>
      <Badge variant={ready ? "success" : "outline"} className="shrink-0">
        {ready ? <CheckCircle2 className="mr-1 size-3" /> : <Ban className="mr-1 size-3" />}
        {ready ? "OK" : "Pendente"}
      </Badge>
    </div>
  );
}

function UsageCard({ item }: { item: SmartDeliveryUsageItem }) {
  const percent = usagePercent(item);
  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{usageLabel(item.metric_code)}</p>
          <p className="text-xs text-muted-foreground">
            {formatQuantity(item.quantity)} usado(s) no período
          </p>
        </div>
        <Badge variant={item.next_unit_allowed ? "outline" : "destructive"}>
          {item.next_unit_allowed ? "Dentro do gate" : "Limite atingido"}
        </Badge>
      </div>

      {item.hard_limit_units !== null ? (
        <>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-[width]" style={{ width: `${percent ?? 0}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Limite rígido: {formatQuantity(item.hard_limit_units)}
            {item.included_units !== null ? ` · franquia: ${formatQuantity(item.included_units)}` : ""}
          </p>
        </>
      ) : (
        <p className="mt-4 rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
          Nenhum hard limit comercial foi publicado para esta métrica. O Centro não inventa uma quota.
        </p>
      )}
    </div>
  );
}

function SmartDeliveryControlCenterPage() {
  const { storeId } = useStoreScope();
  const control = useStoreSmartDeliveryControlCenter(storeId);
  const pauseMutation = useSetStoreSmartDeliveryPause();
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState("");

  if (!storeId) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-muted-foreground">
        Nenhuma loja vinculada a esta conta.
      </div>
    );
  }

  if (control.isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6">
        <Skeleton className="h-28 w-full rounded-3xl" />
        <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-64 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div>
      </div>
    );
  }

  if (control.isError || !control.data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <ErrorState
          title="Centro de Smart Delivery indisponível"
          description="A área é restrita a proprietário/gerente e não expõe dados internos do provider. Tente atualizar se você possui essa permissão."
          onRetry={() => void control.refetch()}
        />
      </div>
    );
  }

  const data = control.data;
  const status = STATUS_COPY[data.overall_status];
  const totalPending = data.jobs.queued + data.jobs.retry + data.jobs.processing;
  const hasRecordedCost = data.cost_tracking.provider_cost_micros > 0 || data.cost_tracking.customer_charge_micros > 0;

  const resume = () => {
    pauseMutation.mutate({ storeId, paused: false });
  };

  const confirmPause = () => {
    pauseMutation.mutate(
      { storeId, paused: true, reason: pauseReason.trim() || null },
      {
        onSuccess: () => {
          setPauseDialogOpen(false);
          setPauseReason("");
        },
      },
    );
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#4B1D6D] p-6 text-white shadow-e2 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-[#FF6A4D]/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Operações Pro</Badge>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <h1 className="font-display text-3xl font-black tracking-tight">Centro Smart Delivery</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
              Readiness, consumo, limites e fila operacional. O provider atual é {providerLabel(data.provider.code)}; esta tela nunca exibe a chave e não ativa serviços pagos.
            </p>
          </div>
          <Button variant="secondary" onClick={() => void control.refetch()} disabled={control.isFetching}>
            <RefreshCw className={`size-4 ${control.isFetching ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </header>

      <Card className={data.control.is_paused ? "border-warning/40" : "border-success/20"}>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {data.control.is_paused ? <ShieldOff className="size-5 text-warning" /> : <ShieldCheck className="size-5 text-success" />}
                Kill switch da loja
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                É independente da proteção global da plataforma. Retomar nunca ignora add-on, disponibilidade do provider, localização ou limites internos.
              </p>
            </div>
            {data.control.is_paused ? (
              <Button onClick={resume} disabled={pauseMutation.isPending}>Retomar Smart Delivery</Button>
            ) : (
              <Button variant="destructive" onClick={() => setPauseDialogOpen(true)} disabled={pauseMutation.isPending}>Pausar Smart Delivery</Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {data.control.is_paused ? (
            <div className="rounded-xl bg-warning-soft p-4 text-sm">
              <p className="font-semibold text-warning-foreground">Chamadas novas bloqueadas pela loja.</p>
              <p className="mt-1 text-xs text-warning-foreground/80">
                Pausado em {formatDateTime(data.control.paused_at)}
                {data.control.pause_reason ? ` · motivo: ${data.control.pause_reason}` : ""}.
              </p>
            </div>
          ) : (
            <p className="rounded-xl bg-success-soft/50 p-4 text-sm text-muted-foreground">
              A pausa da loja está desligada. Os demais gates abaixo continuam decidindo se uma operação pode ou não chegar ao provider.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Gauge className="size-5" /> Readiness</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <ReadinessRow label="Add-on Smart Delivery" ready={data.smart_delivery_entitled} detail={data.smart_delivery_entitled ? "Entitlement ativo para a loja." : "Nenhuma assinatura/entitlement ativo."} />
            <ReadinessRow label="Coordenadas da loja" ready={data.store.coordinates_set} detail={data.store.coordinates_set ? `Origem: ${data.store.location_source}.` : "Necessárias para calcular rota loja → cliente."} />
            <ReadinessRow label="Chave openrouteservice" ready={data.provider.api_key_configured} detail="Configurada somente no backend e nunca exibida aqui." />
            <ReadinessRow label="Provider autorizado" ready={data.provider.billing_confirmed} detail="Gate técnico de compatibilidade do backend; não representa cobrança, cartão ou plano pago." />
            <ReadinessRow label="Rotas openrouteservice" ready={data.provider.routes_api_enabled} detail={data.capabilities.routes_ready ? "Rotas podem passar por todos os gates." : "A rota pelo provider permanece bloqueada."} />
            <ReadinessRow label="Geocodificação openrouteservice" ready={data.provider.geocoding_api_enabled} detail={data.capabilities.geocoding_ready ? "Geocodificação pode passar por todos os gates." : "Geocodificação pelo provider permanece bloqueada."} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="size-5" /> Saúde e proteções</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border p-4"><p className="text-xs font-bold uppercase text-muted-foreground">Proteção global</p><p className="mt-2 font-semibold">{data.provider.global_kill_switch_enabled ? "Ligada" : "Desligada"}</p></div>
              <div className="rounded-2xl border p-4"><p className="text-xs font-bold uppercase text-muted-foreground">Último health check</p><p className="mt-2 text-sm font-semibold">{formatDateTime(data.provider.last_health_at)}</p></div>
              <div className="rounded-2xl border p-4"><p className="text-xs font-bold uppercase text-muted-foreground">Rotas</p><p className="mt-2 font-semibold">{data.provider.routes_provider_ready ? "Provider pronto" : "Provider bloqueado"}</p></div>
              <div className="rounded-2xl border p-4"><p className="text-xs font-bold uppercase text-muted-foreground">Geocoding</p><p className="mt-2 font-semibold">{data.provider.geocoding_provider_ready ? "Provider pronto" : "Provider bloqueado"}</p></div>
            </div>
            {data.provider.last_error_code ? (
              <p className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-muted-foreground">Código do último health error: <strong className="text-foreground">{data.provider.last_error_code}</strong>. Detalhes internos não são expostos.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><WalletCards className="size-5" /> Uso, limites e custo técnico</CardTitle>
          <p className="text-sm text-muted-foreground">Período {new Date(`${data.usage.period_start}T12:00:00`).toLocaleDateString("pt-BR")} até {new Date(`${data.usage.period_end}T12:00:00`).toLocaleDateString("pt-BR")}.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            {data.usage.items.map((item) => <UsageCard key={item.metric_code} item={item} />)}
          </div>
          <div className="rounded-xl bg-muted/50 p-4 text-sm">
            <p className="font-semibold">Conciliação financeira</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {data.cost_tracking.reconciliation_pending
                ? "Há uso aguardando conciliação do custo do provider. Nenhum valor comercial é inventado enquanto essa reconciliação estiver pendente."
                : hasRecordedCost
                  ? `O ledger possui custos técnicos registrados em micros (provider: ${data.cost_tracking.provider_cost_micros.toLocaleString("pt-BR")} · cliente: ${data.cost_tracking.customer_charge_micros.toLocaleString("pt-BR")}).`
                  : "Nenhum custo técnico foi registrado neste período."}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Clock3 className="size-5" /> Fila e retries</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ["Fila", data.jobs.queued],
                ["Processando", data.jobs.processing],
                ["Retry", data.jobs.retry],
                ["Concluídos", data.jobs.completed],
                ["Falhas", data.jobs.failed],
                ["Cancelados", data.jobs.cancelled],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-black tabular-nums">{value}</p></div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Pendentes/processando agora: {totalPending}. Mais antigo: {formatDateTime(data.jobs.oldest_pending_at)}. Locks vencidos: {data.jobs.stale_processing}.
            </p>
            <p className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">Retries são automáticos e classificados no worker. Esta central não oferece reexecução manual que possa gerar chamada duplicada ao provider.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="size-5" /> Diagnóstico</CardTitle></CardHeader>
          <CardContent>
            {data.diagnostics.length === 0 ? (
              <p className="flex items-center gap-2 rounded-xl bg-success-soft/50 p-4 text-sm"><CheckCircle2 className="size-4 text-success" /> Nenhum bloqueio diagnosticado.</p>
            ) : (
              <ul className="space-y-2">
                {data.diagnostics.map((code) => <li key={code} className="rounded-xl border border-border p-3 text-sm"><p className="font-medium">{DIAGNOSTIC_LABEL[code] ?? "Diagnóstico operacional pendente."}</p><p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{code}</p></li>)}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {data.jobs.recent_issues.length > 0 ? (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><RouteIcon className="size-5" /> Incidentes recentes</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.jobs.recent_issues.map((issue, index) => (
              <div key={`${issue.updated_at}-${index}`} className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="text-sm font-semibold">{JOB_LABEL[issue.job_type] ?? issue.job_type}</p><p className="text-xs text-muted-foreground">{issue.status} · tentativa {issue.attempts}/{issue.max_attempts} · {formatDateTime(issue.updated_at)}</p></div>
                <Badge variant="outline" className="w-fit font-mono text-[10px]">{issue.error_code ?? "sem_codigo"}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline"><Link to="/app/loja/modulos">Voltar aos módulos</Link></Button>
        <Button asChild variant="outline"><Link to="/app/loja/configuracoes/endereco"><MapPin className="size-4" /> Configurar localização</Link></Button>
      </div>

      <Dialog open={pauseDialogOpen} onOpenChange={setPauseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pausar Smart Delivery</DialogTitle>
            <DialogDescription>
              Novos jobs de rota/geocodificação serão bloqueados e jobs ainda em fila/retry serão cancelados. Jobs que já começaram não são adulterados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="smart-delivery-pause-reason">Motivo interno (opcional)</Label>
            <Textarea id="smart-delivery-pause-reason" maxLength={240} value={pauseReason} onChange={(event) => setPauseReason(event.target.value)} placeholder="Ex.: manutenção operacional" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPauseDialogOpen(false)} disabled={pauseMutation.isPending}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmPause} disabled={pauseMutation.isPending}>Confirmar pausa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
