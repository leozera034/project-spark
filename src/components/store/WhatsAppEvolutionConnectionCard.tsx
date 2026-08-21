import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  MessageCircle,
  Power,
  QrCode,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

import { AddonPurchaseReadiness } from "@/components/store/AddonPurchaseReadiness";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  if (code === "WHATSAPP_PAYMENT_REQUIRED") return "Ative o módulo WhatsApp antes de gerar a conexão.";
  if (code === "EVOLUTION_RUNTIME_NOT_CONFIGURED") return "A infraestrutura de conexão ainda não foi ativada pelo Comandiva.";
  if (code === "EVOLUTION_INSTANCE_CREATE_FAILED") return "Não foi possível preparar sua conexão agora.";
  if (code === "EVOLUTION_QR_FAILED") return "Não foi possível gerar um novo QR Code. Tente novamente em instantes.";
  if (code === "EVOLUTION_STATUS_FAILED") return "Não foi possível consultar o estado da conexão agora.";
  if (code === "EVOLUTION_DISCONNECT_FAILED") return "Não foi possível desconectar o aparelho agora.";
  if (code === "EVOLUTION_SEND_FAILED") return "O WhatsApp recusou o envio da mensagem.";
  if (code === "EVOLUTION_SEND_AMBIGUOUS") return "O envio não retornou confirmação segura. Verifique a conversa antes de tentar novamente.";
  if (code === "EVOLUTION_MANUAL_SEND_NOT_READY") return "Conecte o WhatsApp antes de enviar mensagens.";
  if (code === "EVOLUTION_UNREACHABLE") return "O serviço de conexão do WhatsApp está temporariamente indisponível.";
  if (code === "FORBIDDEN") return "Sua conta não tem permissão para gerenciar o WhatsApp desta loja.";
  return "Não foi possível concluir a operação do WhatsApp.";
}

export function WhatsAppEvolutionConnectionCard({
  storeId,
}: {
  storeId: string;
}) {
  const connection = useStoreEvolutionWhatsAppConnection(storeId);
  const addons = useStoreAddons(storeId);
  const actions = useStoreEvolutionWhatsAppActions();
  const [qr, setQr] = useState<QrState>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [uiError, setUiError] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  const whatsappAddon = useMemo(
    () => addons.data?.addons.find((addon) => addon.code === "whatsapp_automation") ?? null,
    [addons.data],
  );

  const connected = Boolean(connection.data?.connected);
  const canProvision = Boolean(connection.data?.can_provision);
  const pending = connection.data?.status === "pending" || Boolean(qr);
  const busy = actions.start.isPending
    || actions.refreshQr.isPending
    || actions.disconnect.isPending
    || actions.status.isPending;

  useEffect(() => {
    if (!pending || connected) return;
    const check = () => {
      void actions.status.mutateAsync(storeId).catch(() => undefined);
    };
    check();
    const timer = window.setInterval(check, 4_000);
    return () => window.clearInterval(timer);
  }, [connected, pending, storeId, actions.status]);

  useEffect(() => {
    if (!connected) return;
    setQr(null);
    setUiError(null);
    setNotice("WhatsApp conectado. O número já pode ser usado dentro do Comandiva.");
  }, [connected]);

  async function startConnection() {
    if (busy) return;
    setUiError(null);
    setNotice("Preparando uma conexão exclusiva para sua loja...");
    try {
      const result = await actions.start.mutateAsync(storeId);
      if (result.connected) {
        setQr(null);
        setNotice("WhatsApp conectado.");
        return;
      }
      setQr(result);
      setNotice("QR Code pronto. Escaneie pelo WhatsApp do celular.");
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
      setNotice("Novo QR Code gerado.");
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
      setNotice("WhatsApp desconectado desta loja.");
    } catch (error) {
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
      setNotice("Mensagem enviada e registrada no histórico do Comandiva.");
    } catch (error) {
      setUiError(connectionError(error));
    }
  }

  return (
    <Card className="overflow-hidden border-[#25D366]/25 shadow-sm">
      <CardHeader className="border-b border-border bg-gradient-to-br from-[#25D366]/10 via-background to-[#FF681F]/5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <MessageCircle className="size-5 text-[#128C7E]" />
              <CardTitle>Conectar WhatsApp</CardTitle>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              A conexão acontece aqui. Você não precisa criar conta em outra plataforma nem copiar chaves: o Comandiva prepara o canal e mostra o QR Code para vincular seu WhatsApp.
            </p>
          </div>
          <Badge variant={connected ? "default" : "secondary"} className="w-fit">
            {connected ? "Conectado" : pending ? "Aguardando leitura" : "Não conectado"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {!canProvision && !connected ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-muted/30 p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
                <div>
                  <p className="font-semibold">Ativação protegida por pagamento</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    A infraestrutura só cria uma sessão de WhatsApp depois que a contratação da loja estiver confirmada pelo billing do Comandiva.
                  </p>
                </div>
              </div>
            </div>
            {whatsappAddon ? (
              <AddonPurchaseReadiness
                storeId={storeId}
                addon={whatsappAddon}
                canViewBilling={Boolean(addons.data?.can_view_billing)}
              />
            ) : (
              <p className="rounded-xl border border-amber-500/20 bg-amber-500/[.05] p-3 text-sm text-muted-foreground">
                O módulo WhatsApp ainda não está publicado no catálogo comercial desta loja.
              </p>
            )}
          </div>
        ) : null}

        {canProvision && !connected && !qr ? (
          <div className="rounded-2xl border border-dashed border-[#25D366]/40 bg-[#25D366]/5 p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <QrCode className="mt-0.5 size-6 shrink-0 text-[#128C7E]" />
                <div>
                  <p className="font-semibold">Pronto para conectar</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Gere o QR Code e escaneie no celular em WhatsApp → Aparelhos conectados → Conectar aparelho.
                  </p>
                </div>
              </div>
              <Button onClick={() => void startConnection()} disabled={busy} className="shrink-0 bg-[#FF681F] hover:bg-[#E95612]">
                {actions.start.isPending ? <Loader2 className="size-4 animate-spin" /> : <QrCode className="size-4" />}
                Gerar QR Code
              </Button>
            </div>
          </div>
        ) : null}

        {qr && !connected ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,320px)_1fr] lg:items-center">
            <div className="flex min-h-72 items-center justify-center rounded-3xl border border-border bg-white p-5 shadow-sm">
              {qr.qrCodeDataUrl ? (
                <img
                  src={qr.qrCodeDataUrl}
                  alt="QR Code para conectar o WhatsApp"
                  className="aspect-square w-full max-w-[260px] object-contain"
                />
              ) : qr.pairingCode ? (
                <div className="text-center">
                  <Smartphone className="mx-auto mb-3 size-8 text-primary" />
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Código de vinculação</p>
                  <p className="mt-3 font-mono text-2xl font-black tracking-[0.18em] text-foreground">{qr.pairingCode}</p>
                </div>
              ) : (
                <div className="text-center text-sm text-muted-foreground">
                  <Loader2 className="mx-auto mb-3 size-7 animate-spin" />
                  Aguardando um QR Code válido...
                </div>
              )}
            </div>
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#25D366]/10 px-3 py-1 text-xs font-bold text-[#128C7E]">
                <Loader2 className="size-3.5 animate-spin" /> Aguardando seu celular
              </div>
              <h3 className="font-display text-2xl font-black tracking-tight">Escaneie e pronto</h3>
              <ol className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
                <li><strong className="text-foreground">1.</strong> Abra o WhatsApp no celular da loja.</li>
                <li><strong className="text-foreground">2.</strong> Entre em <strong>Aparelhos conectados</strong>.</li>
                <li><strong className="text-foreground">3.</strong> Toque em <strong>Conectar aparelho</strong> e leia este código.</li>
              </ol>
              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                Esta tela verifica automaticamente a conexão. Não feche até aparecer “Conectado”.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => void refreshQr()} disabled={busy}>
                  {actions.refreshQr.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  Gerar outro código
                </Button>
                <Button variant="ghost" onClick={() => void actions.status.mutateAsync(storeId)} disabled={actions.status.isPending}>
                  {actions.status.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  Verificar agora
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
              <ConnectionMetric label="Conectado em" value={formatDate(connection.data?.connected_at)} />
            </div>

            <div className="rounded-2xl border border-[#25D366]/25 bg-[#25D366]/5 p-4">
              <p className="flex items-center gap-2 font-semibold text-[#128C7E]">
                <CheckCircle2 className="size-5" /> Canal pronto
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                O Comandiva pode usar este número para mensagens manuais e, conforme as automações habilitadas, notificações da operação.
              </p>
            </div>

            <div className="rounded-2xl border border-border p-5">
              <div className="mb-4">
                <h3 className="font-semibold">Enviar mensagem manual</h3>
                <p className="mt-1 text-sm text-muted-foreground">Teste a conexão ou fale com um cliente sem sair do painel.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-[240px_1fr]">
                <div>
                  <Label htmlFor="evolution-manual-phone">WhatsApp do cliente</Label>
                  <Input
                    id="evolution-manual-phone"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="(11) 99999-9999"
                    inputMode="tel"
                    maxLength={32}
                  />
                </div>
                <div>
                  <Label htmlFor="evolution-manual-message">Mensagem</Label>
                  <Textarea
                    id="evolution-manual-message"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Olá! Seu pedido já está pronto."
                    rows={3}
                    maxLength={4096}
                  />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <Button variant="outline" onClick={() => void disconnect()} disabled={busy || actions.sendManual.isPending}>
                  <Power className="size-4" /> Desconectar
                </Button>
                <Button
                  onClick={() => void sendManual()}
                  disabled={!phone.trim() || !message.trim() || actions.sendManual.isPending}
                  className="bg-[#FF681F] hover:bg-[#E95612]"
                >
                  {actions.sendManual.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  Enviar mensagem
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {notice ? (
          <p className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> {notice}
          </p>
        ) : null}
        {uiError ? (
          <p className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{uiError}</p>
        ) : null}

        <p className="text-xs leading-5 text-muted-foreground">
          A conexão usa uma sessão dedicada por loja. Nenhuma chave da infraestrutura é enviada ao navegador ou mostrada ao lojista.
        </p>
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
