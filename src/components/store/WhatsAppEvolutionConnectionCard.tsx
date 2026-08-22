import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  MessageCircle,
  Power,
  QrCode,
  RefreshCw,
  Send,
  Smartphone,
} from "lucide-react";

import { AddonPurchaseReadiness } from "@/components/store/AddonPurchaseReadiness";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EvolutionWhatsAppActionResult } from "@/lib/store-evolution-whatsapp.functions";
import { useStoreAddons } from "@/store/addons/store-addons.queries";
import {
  useStoreEvolutionWhatsAppActions,
  useStoreEvolutionWhatsAppConnection,
} from "@/store/growth/store-evolution-whatsapp.queries";

type QrState = Pick<EvolutionWhatsAppActionResult, "qrCodeDataUrl" | "pairingCode" | "qrCode" | "instanceName"> | null;

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function formatPrice(amountCents: number | null | undefined, fallback: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((amountCents ?? fallback) / 100);
}

function subscriptionActive(status: string | null | undefined) {
  return status === "active" || status === "trial" || status === "grace_period" || status === "complimentary";
}

function subscriptionLabel(status: string | null | undefined) {
  if (status === "complimentary") return "Cortesia";
  if (status === "trial") return "Teste ativo";
  if (status === "grace_period") return "Ativo · regularizar cobrança";
  return "Ativo";
}

function connectionError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "WHATSAPP_PAYMENT_REQUIRED") return "Escolha um modo de WhatsApp para conectar este número.";
  if (code === "EVOLUTION_RUNTIME_NOT_CONFIGURED") return "A conexão do WhatsApp está temporariamente indisponível.";
  if (code === "EVOLUTION_INSTANCE_CREATE_FAILED") return "Não foi possível preparar a conexão agora.";
  if (code === "EVOLUTION_QR_FAILED") return "Não foi possível gerar o QR Code. Tente novamente.";
  if (code === "EVOLUTION_STATUS_FAILED") return "Não foi possível confirmar o estado atual da conexão.";
  if (code === "EVOLUTION_DISCONNECT_FAILED") return "Não foi possível desconectar o aparelho.";
  if (code === "EVOLUTION_SEND_FAILED") return "O WhatsApp recusou o envio da mensagem.";
  if (code === "EVOLUTION_SEND_AMBIGUOUS") return "O envio não retornou uma confirmação segura.";
  if (code === "EVOLUTION_MANUAL_SEND_NOT_READY") return "Conecte o WhatsApp antes de enviar mensagens.";
  if (code === "EVOLUTION_UNREACHABLE") return "O WhatsApp está temporariamente indisponível. Tente novamente em instantes.";
  if (code === "FORBIDDEN") return "Sua conta não tem permissão para gerenciar o WhatsApp desta loja.";
  return "Não foi possível concluir esta operação do WhatsApp.";
}

export function WhatsAppEvolutionConnectionCard({ storeId }: { storeId: string }) {
  const connection = useStoreEvolutionWhatsAppConnection(storeId);
  const addons = useStoreAddons(storeId);
  const actions = useStoreEvolutionWhatsAppActions();
  const statusMutateAsyncRef = useRef(actions.status.mutateAsync);
  const refreshQrMutateAsyncRef = useRef(actions.refreshQr.mutateAsync);
  const statusCheckInFlightRef = useRef(false);
  const reconcileLiveStatusRef = useRef<() => Promise<void>>(async () => undefined);
  const reconciledStoreRef = useRef<string | null>(null);
  const [qr, setQr] = useState<QrState>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [uiError, setUiError] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  statusMutateAsyncRef.current = actions.status.mutateAsync;
  refreshQrMutateAsyncRef.current = actions.refreshQr.mutateAsync;
  reconcileLiveStatusRef.current = async () => {
    if (statusCheckInFlightRef.current) return;
    statusCheckInFlightRef.current = true;
    try {
      const result = await statusMutateAsyncRef.current(storeId);
      if (result.connected) {
        setQr(null);
        setUiError(null);
        setNotice("WhatsApp conectado e pronto para usar.");
        return;
      }
      if (result.repairRequired) {
        const repaired = await refreshQrMutateAsyncRef.current(storeId);
        setQr(repaired);
        setUiError(null);
        setNotice("A conexão anterior encerrou. Escaneie o novo QR Code para reconectar.");
      }
    } catch {
      // A consulta principal mantém o último estado conhecido. Ações explícitas exibem o erro.
    } finally {
      statusCheckInFlightRef.current = false;
    }
  };

  const manualAddon = useMemo(
    () => addons.data?.items.find((addon) => addon.code === "whatsapp_manual") ?? null,
    [addons.data],
  );
  const automaticAddon = useMemo(
    () => addons.data?.items.find((addon) => addon.code === "whatsapp_automation") ?? null,
    [addons.data],
  );

  const automaticActive = Boolean(
    automaticAddon
      && subscriptionActive(automaticAddon.subscription?.status)
      && automaticAddon.features.includes("whatsapp_automation"),
  );
  const manualDirectActive = Boolean(
    manualAddon
      && subscriptionActive(manualAddon.subscription?.status)
      && manualAddon.features.includes("whatsapp_manual"),
  );
  const manualActive = manualDirectActive || automaticActive;
  const addonAllowsProvision = manualActive || automaticActive;
  const resolving = !connection.data && (connection.isLoading || connection.isFetching);
  const connected = Boolean(connection.data?.connected);
  const canProvision = Boolean(connection.data?.can_provision || addonAllowsProvision);
  const pending = connection.data?.status === "pending" || Boolean(qr);
  const busy = actions.start.isPending
    || actions.refreshQr.isPending
    || actions.disconnect.isPending
    || actions.status.isPending;
  const activeMode = automaticActive ? "Automático" : manualDirectActive ? "Manual" : null;
  const activeAddon = automaticActive ? automaticAddon : manualDirectActive ? manualAddon : null;
  const activePrice = automaticActive
    ? formatPrice(automaticAddon?.monthly_price?.amount_cents, 3990)
    : formatPrice(manualAddon?.monthly_price?.amount_cents, 1490);

  useEffect(() => {
    if (!connection.isSuccess || reconciledStoreRef.current === storeId) return;
    reconciledStoreRef.current = storeId;
    void reconcileLiveStatusRef.current();
  }, [connection.isSuccess, storeId]);

  useEffect(() => {
    if (!pending || connected) return;
    const timer = window.setInterval(() => void reconcileLiveStatusRef.current(), 3_000);
    return () => window.clearInterval(timer);
  }, [connected, pending, storeId]);

  useEffect(() => {
    if (!connected) return;
    setQr(null);
    setUiError(null);
  }, [connected]);

  async function startConnection() {
    if (busy) return;
    setUiError(null);
    setNotice("Gerando seu QR Code...");
    try {
      const result = await actions.start.mutateAsync(storeId);
      if (result.connected) {
        setQr(null);
        setNotice("WhatsApp conectado e pronto para usar.");
        return;
      }
      setQr(result);
      setNotice(result.recovered ? "Conexão renovada. Escaneie este novo QR Code." : null);
    } catch (error) {
      setNotice(null);
      setUiError(connectionError(error));
    }
  }

  async function refreshQr() {
    if (busy) return;
    setUiError(null);
    try {
      const result = await actions.refreshQr.mutateAsync(storeId);
      setQr(result);
      setNotice(result.recovered ? "Conexão renovada. Escaneie este novo QR Code." : null);
    } catch (error) {
      setUiError(connectionError(error));
    }
  }

  async function disconnect() {
    if (busy) return;
    setUiError(null);
    setNotice(null);
    try {
      await actions.disconnect.mutateAsync(storeId);
      setQr(null);
      setNotice("WhatsApp desconectado.");
    } catch (error) {
      setUiError(connectionError(error));
    }
  }

  async function reconnect() {
    if (busy) return;
    setUiError(null);
    setNotice("Preparando um novo QR Code...");
    try {
      await actions.disconnect.mutateAsync(storeId);
      const result = await actions.start.mutateAsync(storeId);
      setQr(result.connected ? null : result);
      setNotice(result.connected ? "WhatsApp conectado e pronto para usar." : "Escaneie o novo QR Code para concluir a reconexão.");
    } catch (error) {
      setNotice(null);
      setUiError(connectionError(error));
    }
  }

  async function sendManual() {
    if (!phone.trim() || !message.trim() || actions.sendManual.isPending) return;
    setUiError(null);
    setNotice(null);
    try {
      await actions.sendManual.mutateAsync({ storeId, phone: phone.trim(), message: message.trim() });
      setMessage("");
      setNotice("Mensagem enviada.");
    } catch (error) {
      setUiError(connectionError(error));
    }
  }

  const statusLabel = resolving
    ? "Verificando"
    : connected
      ? "Conectado"
      : pending
        ? "Aguardando conexão"
        : "Desconectado";

  return (
    <Card className={`overflow-hidden shadow-sm ${connected ? "border-success/25" : "border-brand/15"}`}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className={`grid size-11 shrink-0 place-items-center rounded-2xl ${connected ? "bg-success-soft text-success" : "bg-brand-soft text-brand"}`}>
              <MessageCircle className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-xl font-black tracking-tight">Seu WhatsApp</h2>
                <Badge variant={connected ? "success" : pending ? "warning" : "outline"}>{statusLabel}</Badge>
              </div>
              <p className="mt-1 max-w-xl text-sm leading-5 text-muted-foreground">
                A Comandiva verifica a conexão automaticamente enquanto esta tela está aberta.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void reconcileLiveStatusRef.current()}
            disabled={busy || resolving}
            className="w-full shrink-0 sm:w-auto"
          >
            {actions.status.isPending || connection.isFetching ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Atualizar
          </Button>
        </div>

        {activeMode ? (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-border bg-muted/25 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-bold">WhatsApp {activeMode}</p>
                <Badge variant="secondary">{subscriptionLabel(activeAddon?.subscription?.status)}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {automaticActive
                  ? "Mensagens manuais e avisos automáticos dos pedidos estão incluídos."
                  : "Envio manual pelo painel, sem avisos automáticos dos pedidos."}
              </p>
            </div>
            <p className="shrink-0 text-sm font-bold text-muted-foreground">{activePrice}/mês</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3 rounded-2xl border border-border bg-muted/20 p-4">
            <div>
              <p className="font-bold">Escolha como usar o WhatsApp</p>
              <p className="mt-1 text-sm text-muted-foreground">Ative apenas um modo. O Automático já inclui o envio manual.</p>
            </div>
            {manualAddon ? (
              <AddonPurchaseReadiness storeId={storeId} addon={manualAddon} canViewBilling={Boolean(addons.data?.can_view_billing)} />
            ) : null}
            {automaticAddon ? (
              <AddonPurchaseReadiness storeId={storeId} addon={automaticAddon} canViewBilling={Boolean(addons.data?.can_view_billing)} />
            ) : null}
          </div>
        )}

        {resolving ? (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin" /> Conferindo sua conexão…
          </div>
        ) : null}

        {!resolving && connected ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-success/25 bg-success-soft/45 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-foreground">WhatsApp conectado e pronto</p>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">
                    {connection.data?.display_phone_number || "Número vinculado"} · verificado em {formatDate(connection.data?.last_health_at)}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <ConnectionMetric label="Número" value={connection.data?.display_phone_number || "Vinculado"} />
              <ConnectionMetric label="Modo" value={activeMode ?? "Ativo"} />
              <ConnectionMetric label="Conectado desde" value={formatDate(connection.data?.connected_at)} />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => void reconnect()} disabled={busy || actions.sendManual.isPending} className="sm:w-auto">
                {actions.disconnect.isPending || actions.start.isPending ? <Loader2 className="size-4 animate-spin" /> : <QrCode className="size-4" />}
                Trocar ou reconectar número
              </Button>
            </div>

            {manualActive ? (
              <details className="rounded-2xl border border-border">
                <summary className="cursor-pointer list-none px-4 py-3.5 font-semibold">Enviar uma mensagem agora</summary>
                <div className="border-t border-border p-4">
                  <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                    <div>
                      <Label htmlFor="evolution-manual-phone">WhatsApp do cliente</Label>
                      <Input id="evolution-manual-phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(34) 99999-9999" inputMode="tel" maxLength={32} />
                    </div>
                    <div>
                      <Label htmlFor="evolution-manual-message">Mensagem</Label>
                      <Textarea id="evolution-manual-message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Olá! Seu pedido já está pronto." rows={3} maxLength={4096} />
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                    <Button variant="ghost" onClick={() => void disconnect()} disabled={busy || actions.sendManual.isPending} className="text-destructive hover:text-destructive">
                      <Power className="size-4" /> Desconectar
                    </Button>
                    <Button onClick={() => void sendManual()} disabled={!phone.trim() || !message.trim() || actions.sendManual.isPending}>
                      {actions.sendManual.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                      Enviar mensagem
                    </Button>
                  </div>
                </div>
              </details>
            ) : null}
          </div>
        ) : null}

        {!resolving && !connected && !canProvision ? (
          <p className="mt-4 rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            Ative um modo de WhatsApp para liberar a conexão desta loja.
          </p>
        ) : null}

        {!resolving && canProvision && !connected && !qr ? (
          <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-dashed border-success/30 bg-success-soft/25 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold">Pronto para conectar</p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">Gere o QR Code e escaneie pelo WhatsApp da loja. Ele desaparece assim que a conexão for confirmada.</p>
            </div>
            <Button onClick={() => void startConnection()} disabled={busy} className="w-full shrink-0 sm:w-auto">
              {actions.start.isPending ? <Loader2 className="size-4 animate-spin" /> : <QrCode className="size-4" />}
              Gerar QR Code
            </Button>
          </div>
        ) : null}

        {qr && !connected ? (
          <div className="mt-4 grid gap-4 rounded-2xl border border-border p-4 lg:grid-cols-[250px_1fr] lg:items-center">
            <div className="flex min-h-56 items-center justify-center rounded-2xl bg-white p-3">
              {qr.qrCodeDataUrl ? (
                <img src={qr.qrCodeDataUrl} alt="QR Code para conectar o WhatsApp" className="aspect-square w-full max-w-[220px] object-contain" />
              ) : qr.pairingCode ? (
                <div className="text-center text-[#1c1c1e]">
                  <Smartphone className="mx-auto mb-3 size-8 text-brand" />
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#6f6376]">Código de vinculação</p>
                  <p className="mt-3 font-mono text-2xl font-black tracking-[0.18em]">{qr.pairingCode}</p>
                </div>
              ) : (
                <Loader2 className="size-7 animate-spin text-muted-foreground" />
              )}
            </div>
            <div>
              <h3 className="font-display text-xl font-black tracking-tight">Escaneie no WhatsApp</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                No WhatsApp da loja, abra Aparelhos conectados → Conectar aparelho. A confirmação acontece automaticamente.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" onClick={() => void refreshQr()} disabled={busy}>
                  <RefreshCw className="size-4" /> Gerar outro QR
                </Button>
                <Button variant="ghost" onClick={() => void reconcileLiveStatusRef.current()} disabled={actions.status.isPending || actions.refreshQr.isPending}>
                  {actions.status.isPending || actions.refreshQr.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  Verificar agora
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {notice && !(notice.toLowerCase().includes("conectado e pronto") && !connected) ? (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-success/20 bg-success-soft/35 p-3 text-sm text-success" aria-live="polite">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> {notice}
          </p>
        ) : null}
        {uiError ? <p className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive" role="alert">{uiError}</p> : null}
      </CardContent>
    </Card>
  );
}

function ConnectionMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-background p-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-bold" title={value}>{value}</p>
    </div>
  );
}
