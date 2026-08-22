import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Clock3, MessageCircle, Pencil, RefreshCw, Send, Sparkles, Users } from "lucide-react";

import { WhatsAppAutomationControlCard } from "@/components/store/WhatsAppAutomationControlCard";
import { WhatsAppEvolutionConnectionCard } from "@/components/store/WhatsAppEvolutionConnectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { StoreMessageTemplate } from "@/lib/store-whatsapp.functions";
import {
  useStoreWhatsAppConsentSummary,
  useStoreWhatsAppMessageHistory,
  useStoreWhatsAppUsage,
} from "@/store/growth/store-whatsapp-center.queries";
import {
  useStoreMessageTemplates,
  useStoreWhatsAppActions,
  useStoreWhatsAppReadiness,
} from "@/store/growth/store-whatsapp.queries";
import { useStoreScope } from "@/store-scope/StoreScopeProvider";

export const Route = createFileRoute("/app/loja/whatsapp")({
  head: () => ({ meta: [{ title: "WhatsApp | Comandiva" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: WhatsAppCenter,
});

function templateStatusLabel(status: StoreMessageTemplate["provider_status"]) {
  if (status === "approved") return "Pronto";
  if (status === "pending") return "Em análise";
  if (status === "rejected") return "Precisa de ajuste";
  return "Rascunho";
}

function templateStatusVariant(status: StoreMessageTemplate["provider_status"]) {
  return status === "approved" ? "success" : status === "rejected" ? "destructive" : "secondary";
}

function messageStatusLabel(status: string) {
  if (status === "queued") return "Na fila";
  if (status === "sending") return "Enviando";
  if (status === "sent") return "Enviada";
  if (status === "delivered") return "Entregue";
  if (status === "read") return "Lida";
  if (status === "failed") return "Falhou";
  if (status === "cancelled") return "Cancelada";
  if (status === "blocked") return "Bloqueada";
  return status;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(date);
}

function internalCodeFromName(name: string) {
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized.slice(0, 80) || `mensagem_${Date.now()}`;
}

function templateOperationError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("TEMPLATE_VARIABLES_INVALID")) return "Confira os campos automáticos usados na mensagem.";
  if (message.includes("FORBIDDEN")) return "Sua conta não tem permissão para alterar as mensagens desta loja.";
  if (message.startsWith("META_TEMPLATE_SUBMISSION_FAILED:")) return "A mensagem não pôde ser enviada para aprovação agora.";
  if (message.startsWith("META_TEMPLATE_SYNC_FAILED:")) return "Não foi possível atualizar o estado das mensagens agora.";
  return "Não foi possível concluir esta operação.";
}

function WhatsAppCenter() {
  const { storeId } = useStoreScope();
  const readiness = useStoreWhatsAppReadiness(storeId);
  const templates = useStoreMessageTemplates(storeId);
  const consentSummary = useStoreWhatsAppConsentSummary(storeId);
  const usage = useStoreWhatsAppUsage(storeId);
  const history = useStoreWhatsAppMessageHistory(storeId, 12);
  const actions = useStoreWhatsAppActions();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCode, setEditingCode] = useState("");
  const [editingLanguage, setEditingLanguage] = useState("pt_BR");
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState<"transactional" | "marketing">("transactional");
  const [body, setBody] = useState("");
  const [templateNotice, setTemplateNotice] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);

  if (!storeId) return <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-muted-foreground">Nenhuma loja vinculada a esta conta.</div>;

  const isLocalConnection = readiness.data?.provider === "evolution_api";
  const automaticEntitled = Boolean(readiness.data?.automatic_entitled);
  const canSubmitForApproval = Boolean(readiness.data?.automatic_entitled && readiness.data?.provider_connected && readiness.data?.provider === "meta_whatsapp");
  const templateBusy = actions.saveTemplate.isPending || actions.submitTemplate.isPending;
  const usedMessages = (usage.data?.items ?? []).reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
  const recentFailed = (history.data ?? []).filter((item) => item.status === "failed").length;

  const resetForm = () => {
    setEditingId(null);
    setEditingCode("");
    setEditingLanguage("pt_BR");
    setName("");
    setPurpose("transactional");
    setBody("");
  };

  const editTemplate = (template: StoreMessageTemplate) => {
    setTemplateNotice(null);
    setTemplateError(null);
    setEditingId(template.id);
    setEditingCode(template.code);
    setEditingLanguage(template.provider_language || "pt_BR");
    setName(template.name);
    setPurpose(template.purpose);
    setBody(template.body);
  };

  const submitTemplate = async (templateId: string) => {
    setTemplateNotice(null);
    setTemplateError(null);
    try {
      const result = await actions.submitTemplate.mutateAsync({ storeId, templateId });
      setTemplateNotice(result.status === "approved" ? "Mensagem pronta para uso." : "Mensagem enviada para análise.");
    } catch (error) {
      setTemplateError(templateOperationError(error));
    }
  };

  const saveTemplate = async () => {
    if (!name.trim() || !body.trim() || templateBusy) return;
    setTemplateNotice(null);
    setTemplateError(null);
    try {
      const saved = await actions.saveTemplate.mutateAsync({
        storeId,
        id: editingId,
        code: editingId ? editingCode : internalCodeFromName(name),
        name: name.trim(),
        purpose,
        body: body.trim(),
        providerLanguage: editingLanguage || "pt_BR",
        isActive: true,
      });
      resetForm();

      if (isLocalConnection) {
        setTemplateNotice("Mensagem salva e pronta para usar nas automações da loja.");
        return;
      }
      if (!canSubmitForApproval) {
        setTemplateNotice("Mensagem salva como rascunho.");
        return;
      }
      try {
        await actions.submitTemplate.mutateAsync({ storeId, templateId: saved.id });
        setTemplateNotice("Mensagem salva e enviada para análise.");
      } catch (error) {
        setTemplateError(`Mensagem salva. ${templateOperationError(error)}`);
      }
    } catch {
      setTemplateError("Não foi possível salvar a mensagem.");
    }
  };

  const syncTemplates = async () => {
    if (!canSubmitForApproval || actions.syncTemplates.isPending) return;
    setTemplateNotice(null);
    setTemplateError(null);
    try {
      await actions.syncTemplates.mutateAsync({ storeId });
      setTemplateNotice("Mensagens atualizadas.");
    } catch (error) {
      setTemplateError(templateOperationError(error));
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.14em] text-brand">Comunicação</p>
          <h1 className="mt-1 font-display text-3xl font-black tracking-tight">WhatsApp</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Conecte o número da loja, ajuste avisos automáticos e acompanhe as mensagens enviadas.</p>
        </div>
        <Badge variant={automaticEntitled ? "success" : "outline"}>{automaticEntitled ? "Automático ativo" : "Envio manual"}</Badge>
      </header>

      <WhatsAppEvolutionConnectionCard storeId={storeId} />
      <WhatsAppAutomationControlCard storeId={storeId} automaticEntitled={automaticEntitled} />

      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniMetric label="Mensagens prontas" value={templates.data?.length ?? 0} />
            <MiniMetric label="Enviadas no mês" value={usedMessages} />
            <MiniMetric label="Aceitam marketing" value={consentSummary.data?.opted_in ?? 0} />
            <MiniMetric label="Falhas recentes" value={recentFailed} attention={recentFailed > 0} />
          </div>
        </CardContent>
      </Card>

      {templateNotice ? <p className="rounded-xl border border-success/20 bg-success-soft p-3 text-sm text-success">{templateNotice}</p> : null}
      {templateError ? <p className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{templateError}</p> : null}

      <details className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <summary className="cursor-pointer list-none px-4 py-4 sm:px-5">
          <div className="flex items-center gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Sparkles className="size-4" /></div>
            <div className="min-w-0"><p className="font-bold">Mensagens automáticas</p><p className="mt-0.5 text-xs text-muted-foreground">Edite os textos usados nos avisos da loja.</p></div>
          </div>
        </summary>
        <div className="space-y-5 border-t border-border p-4 sm:p-5">
          <div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
            <div className="space-y-4">
              <div><p className="font-semibold">{editingId ? "Editar mensagem" : "Nova mensagem"}</p><p className="mt-1 text-sm leading-5 text-muted-foreground">Escreva como você falaria com o cliente. Os dados do pedido são preenchidos pelas automações configuradas.</p></div>
              <div><Label>Nome da mensagem</Label><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Pedido confirmado" maxLength={120} /></div>
              <div><Label>Uso</Label><select className="mt-2 h-11 w-full rounded-xl border border-input bg-surface px-3 text-sm" value={purpose} onChange={(event) => setPurpose(event.target.value as "transactional" | "marketing")}><option value="transactional">Atualização de pedido</option><option value="marketing">Marketing</option></select></div>
              <div><Label>Mensagem</Label><Textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Olá! Seu pedido foi confirmado e já entrou na fila de preparo." rows={8} maxLength={4096} className="text-sm leading-6" /></div>
              <div className="flex flex-col gap-2 sm:flex-row"><Button onClick={() => void saveTemplate()} disabled={templateBusy || !name.trim() || !body.trim()}>{templateBusy ? "Salvando..." : editingId ? "Salvar alterações" : "Criar mensagem"}</Button>{editingId ? <Button variant="outline" onClick={resetForm} disabled={templateBusy}>Cancelar</Button> : null}</div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3"><div><p className="font-semibold">Mensagens salvas</p><p className="text-sm text-muted-foreground">{templates.data?.length ?? 0} cadastrada(s)</p></div>{canSubmitForApproval ? <Button size="sm" variant="outline" onClick={() => void syncTemplates()} disabled={actions.syncTemplates.isPending || templateBusy}><RefreshCw className={`size-3.5 ${actions.syncTemplates.isPending ? "animate-spin" : ""}`} /> Atualizar</Button> : null}</div>
              {(templates.data ?? []).map((template) => {
                const canSubmit = canSubmitForApproval && (template.provider_status === "draft" || template.provider_status === "rejected");
                return (
                  <div key={template.id} className="rounded-xl border border-border p-3.5 sm:p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{template.name}</p><Badge variant={isLocalConnection ? "success" : templateStatusVariant(template.provider_status)}>{isLocalConnection ? "Pronto" : templateStatusLabel(template.provider_status)}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{template.purpose === "marketing" ? "Marketing" : "Atualização de pedido"}</p></div>
                      <div className="flex gap-2">{canSubmit ? <Button size="sm" onClick={() => void submitTemplate(template.id)} disabled={actions.submitTemplate.isPending}><Send className="size-3.5" /> Enviar para análise</Button> : null}<Button size="sm" variant="outline" onClick={() => editTemplate(template)} disabled={templateBusy}><Pencil className="size-3.5" /> Editar</Button></div>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-5 text-muted-foreground">{template.body}</p>
                  </div>
                );
              })}
              {!templates.isLoading && (templates.data?.length ?? 0) === 0 ? <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">Nenhuma mensagem personalizada ainda.</p> : null}
            </div>
          </div>
        </div>
      </details>

      <details className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm" open={recentFailed > 0}>
        <summary className="cursor-pointer list-none px-4 py-4 font-bold sm:px-5">Histórico de mensagens</summary>
        <div className="space-y-5 border-t border-border p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-3"><CompactInfo icon={Users} label="Aceitam marketing" value={String(consentSummary.data?.opted_in ?? 0)} /><CompactInfo icon={Send} label="Mensagens no mês" value={String(usedMessages)} /><CompactInfo icon={Clock3} label="Mensagens recentes" value={String(history.data?.length ?? 0)} /></div>
          <div className="space-y-2">
            {(history.data ?? []).slice(0, 8).map((message) => (
              <div key={message.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                <div className="min-w-0"><p className="truncate text-sm font-semibold">{message.customer_name || message.recipient_e164}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(message.queued_at)}</p>{message.status === "failed" ? <p className="mt-1 text-xs font-medium text-destructive">Não foi possível enviar. Tente novamente ou confira a conexão.</p> : null}</div>
                <Badge variant={message.status === "failed" ? "destructive" : message.status === "read" || message.status === "delivered" ? "success" : "secondary"}>{messageStatusLabel(message.status)}</Badge>
              </div>
            ))}
            {!history.isLoading && (history.data?.length ?? 0) === 0 ? <p className="text-sm text-muted-foreground">Nenhuma mensagem enviada ainda.</p> : null}
          </div>
        </div>
      </details>
    </div>
  );
}

function MiniMetric({ label, value, attention = false }: { label: string; value: string | number; attention?: boolean }) {
  return <div className={`rounded-xl px-3 py-3 text-center ${attention ? "bg-destructive/8 text-destructive" : "bg-muted/45"}`}><p className="text-lg font-black tabular-nums">{typeof value === "number" ? value.toLocaleString("pt-BR") : value}</p><p className={`mt-1 text-[10px] font-semibold uppercase tracking-wide sm:text-[11px] ${attention ? "text-destructive" : "text-muted-foreground"}`}>{label}</p></div>;
}

function CompactInfo({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return <div className="flex items-center gap-3 rounded-xl border border-border p-3"><div className="flex size-9 items-center justify-center rounded-xl bg-muted"><Icon className="size-4" /></div><div><p className="text-xs text-muted-foreground">{label}</p><p className="font-semibold">{value}</p></div></div>;
}
