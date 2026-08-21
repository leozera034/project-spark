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

function connectionError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "WHATSAPP_PAYMENT_REQUIRED") return "O módulo ainda não está liberado para esta loja.";
  if (code === "EVOLUTION_RUNTIME_NOT_CONFIGURED") return "A conexão do WhatsApp está temporariamente indisponível.";
  if (code === "EVOLUTION_INSTANCE_CREATE_FAILED") return "Não foi possível preparar a conexão agora.";
  if (code === "EVOLUTION_QR_FAILED") return "Não foi possível gerar o QR Code. Tente novamente.";
  if (code === "EVOLUTION_STATUS_FAILED") return "Não foi possível consultar o estado da conexão.";
  if (code === "EVOLUTION_DISCONNECT_FAILED") return "Não foi possível desconectar o aparelho.";
  if (code === "EVOLUTION_SEND_FAILED") return "O WhatsApp recusou o envio da mensagem.";
  if (code === "EVOLUTION_SEND_AMBIGUOUS") return "O envio não retornou confirmação segura.";
  if (code === "EVOLUTION_MANUAL_SEND_NOT_READY") return "Conecte o WhatsApp antes de enviar mensagens.";
  if (code === "EVOLUTION_UNREACHABLE") return "O serviço de WhatsApp está temporariamente indisponível.";
  if (code === "FORBIDDEN") return "Sua conta não tem permissão para gerenciar o WhatsApp desta loja.";
  return "Não foi possível concluir a operação do WhatsApp.";
}

export function WhatsAppEvolutionConnectionCard({ storeId }: { storeId: string }) {
  const connection = useStoreEvolutionWhatsAppConnection(storeId);
  const addons = useStoreAddons(storeId);
  const actions = useStoreEvolutionWhatsAppActions();
  const statusMutateAsyncRef = useRef(actions.status.mutateAsync);
  const reconciledStoreRef = useRef<string | null>(null);
  const [qr, setQr] = useState<QrState>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [uiError, setUiError] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  statusMutateAsyncRef.current = actions.status.mutateAsync;

  const whatsappAddon = useMemo(
    () => addons.data?.items.find((addon) => addon.code === "whatsapp_automation") ?? null,
    [addons.data],
  );

  const addonStatus = whatsappAddon?.subscription?.status;
  const addonAllowsProvision = Boolean(
    (addonStatus === "active" || addonStatus === "complimentary")
      && whatsappAddon?.features.includes("whatsapp_automation"),
  );
  const resolving = !connection.data && (connection.isLoading || connection.isFetching);
  const connected = Boolean(connection.data?.connected);
  const canProvision = Boolean(connection.data?.can_provision || addonAllowsProvision);
  const pending = connection.data?.status === "pending" || Boolean(qr);
  const busy = actions.start.isPending
    || actions.refreshQr.isPending
    || actions.disconnect.isPending
    || actions.status.isPending;

  useEffect(() => {
    if (!connection.isSuccess || reconciledStoreRef.current === storeId) return;
    reconciledStoreRef.current = storeId;
    void statusMutateAsyncRef.current(storeId).catch(() => undefined);
  }, [connection.isSuccess, storeId]);

  useEffect(() => {
    if (!pending || connected) return;
    const timer = window.setInterval(() => {
      void statusMutateAsyncRef.current(storeId).catch(() => undefined);
    }, 4_000);
    return () => window.clearInterval(timer);
  }, [connected, pending, storeId]);

  useEffect(() => {
    if (!connected) return;
    setQr(null);
    setUiError(null);
    setNotice("WhatsApp conectado e pronto para uso.");
  }, [connected]);

  async function startConnection() {
    if (busy) return;
    setUiError(null);
    setNotice("Gerando seu QR Code...");
    try {
      const result = await actions.start.mutateAsync(storeId);
      if (result.connected) {
        setQr(null);
        setNotice("WhatsApp conectado.");
        return;
      }
      setQr(result);
      setNotice(null);
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
      setNotice(result.connected ? "WhatsApp conectado." : "Escaneie o novo QR Code para concluir a reconexão.");
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

  return (
    <Card className="overflow-hidden border-[#25D366]/25 shadow-sm">
      <CardContent className="p-5 sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#128C7E]">
              <MessageCircle className="size-5" />
            </div>
            <div>
              <h2 className="font-display text-xl font-black tracking-tight">Seu WhatsApp</h2>
              <p className="mt-1 text-sm text-muted-foreground">Conecte o número da loja e use tudo pelo Comandiva.</p>
            </div>
          </div>
          <Badge variant={connected ? "default" : "secondary"} className="shrink-0">
            {resolving ? "Verificando…" : connected ? "Conectado" : pending ? "Aguardando" : "Desconectado"}
          </Badge>
        </div>

        {resolving ? (
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Confirmando a conexão atual…
          </div>
        ) : null}

        {!resolving && !connected && !canProvision ? (
          <div className="space-y-3">
            <p className="rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              O WhatsApp automático ainda não está liberado para esta loja.
            </p>
            {whatsappAddon ? (
              <AddonPurchaseReadiness
                storeId={storeId}
                addon={whatsappAddon}
                canViewBilling={Boolean(addons.data?.can_view_billing)}
              />
            ) : null}
          </div>
        ) : null}

        {!resolving && canProvision && !connected && !qr ? (
          <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-[#25D366]/40 bg-[#25D366]/5 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Pronto para conectar</p>
              <p className="mt-1 text-sm text-muted-foreground">Gere o QR Code e leia em Aparelhos conectados no WhatsApp.</p>
            </div>
            <Button onClick={() => void startConnection()} disabled={busy} className="shrink-0 bg-[#FF681F] hover:bg-[#E95612]">
              {actions.start.isPending ? <Loader2 className="size-4 animate-spin" /> : <QrCode className="size-4" />}
              Gerar QR Code
            </Button>
          </div>
        ) : null}

        {qr && !connected ? (
          <div className="grid gap-5 lg:grid-cols-[280px_1fr] lg:items-center">
            <div className="flex min-h-64 items-center justify-center rounded-3xl border border-border bg-white p-4 shadow-sm">
              {qr.qrCodeDataUrl ? (
                <img src={qr.qrCodeDataUrl} alt="QR Code para conectar o WhatsApp" className="aspect-square w-full max-w-[240px] object-contain" />
              ) : qr.pairingCode ? (
                <div className="text-center">
                  <Smartphone className="mx-auto mb-3 size-8 text-primary" />
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Código de vinculação</p>
                  <p className="mt-3 font-mono text-2xl font-black tracking-[0.18em]">{qr.pairingCode}</p>
                </div>
              ) : (
                <Loader2 className="size-7 animate-spin text-muted-foreground" />
              )}
            </div>
            <div>
              <h3 className="font-display text-2xl font-black tracking-tight">Escaneie no WhatsApp</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                WhatsApp → Aparelhos conectados → Conectar aparelho. A tela confirma a conexão automaticamente.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void refreshQr()} disabled={busy}>
                  <RefreshCw className="size-4" /> Novo QR
                </Button>
                <Button variant="ghost" onClick={() => void statusMutateAsyncRef.current(storeId)} disabled={actions.status.isPending}>
                  {actions.status.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  Verificar
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {connected ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <ConnectionMetric label="Status" value="Conectado" />
              <ConnectionMetric label="Número" value={connection.data?.display_phone_number || "WhatsApp vinculado"} />
              <ConnectionMetric label="Desde" value={formatDate(connection.data?.connected_at)} />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void reconnect()} disabled={busy || actions.sendManual.isPending}>
                {actions.disconnect.isPending || actions.start.isPending ? <Loader2 className="size-4 animate-spin" /> : <QrCode className="size-4" />}
                Reconectar / novo QR
              </Button>
            </div>

            <details className="rounded-2xl border border-border">
              <summary className="cursor-pointer list-none px-4 py-3 font-semibold">Enviar mensagem de teste</summary>
              <div className="border-t border-border p-4">
                <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                  <div>
                    <Label htmlFor="evolution-manual-phone">WhatsApp do cliente</Label>
                    <Input id="evolution-manual-phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(11) 99999-9999" inputMode="tel" maxLength={32} />
                  </div>
                  <div>
                    <Label htmlFor="evolution-manual-message">Mensagem</Label>
                    <Textarea id="evolution-manual-message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Olá! Seu pedido já está pronto." rows={3} maxLength={4096} />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap justify-between gap-2">
                  <Button variant="outline" onClick={() => void disconnect()} disabled={busy || actions.sendManual.isPending}>
                    <Power className="size-4" /> Desconectar
                  </Button>
                  <Button onClick={() => void sendManual()} disabled={!phone.trim() || !message.trim() || actions.sendManual.isPending} className="bg-[#FF681F] hover:bg-[#E95612]">
                    {actions.sendManual.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    Enviar
                  </Button>
                </div>
              </div>
            </details>
          </div>
        ) : null}

        {notice ? (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> {notice}
          </p>
        ) : null}
        {uiError ? <p className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{uiError}</p> : null}
      </CardContent>
    </Card>
  );
}

function ConnectionMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-semibold" title={value}>{value}</p>
    </div>
  );
}
