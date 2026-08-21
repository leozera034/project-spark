import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Clock3, MessageCircle, Pencil, RefreshCw, Send, Users } from "lucide-react";

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
  head: () => ({
    meta: [
      { title: "WhatsApp | Comandiva" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: WhatsAppCenter,
});

function templateStatusLabel(status: StoreMessageTemplate["provider_status"]) {
  if (status === "approved") return "Aprovado";
  if (status === "pending") return "Em aprovação";
  if (status === "rejected") return "Rejeitado";
  return "Rascunho";
}

function templateStatusVariant(status: StoreMessageTemplate["provider_status"]) {
  return status === "approved" ? "default" : status === "rejected" ? "destructive" : "secondary";
}

function providerLabel(provider: string | null | undefined) {
  if (provider === "evolution_api") return "Evolution API";
  if (provider === "meta_whatsapp") return "Meta WhatsApp";
  return "WhatsApp";
}

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

function templateOperationError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("TEMPLATE_VARIABLES_INVALID")) return "Use variáveis sequenciais: {{1}}, {{2}}, {{3}}.";
  if (message.includes("FORBIDDEN")) return "Sua conta não tem permissão para alterar templates desta loja.";
  if (message.startsWith("META_TEMPLATE_SUBMISSION_FAILED:")) return "A Meta recusou o envio do template.";
  if (message.startsWith("META_TEMPLATE_SYNC_FAILED:")) return "Não foi possível sincronizar os templates com a Meta.";
  return "Não foi possível concluir a operação do template.";
}

function WhatsAppCenter() {
  const { storeId } = useStoreScope();
  const readiness = useStoreWhatsAppReadiness(storeId);
  const templates = useStoreMessageTemplates(storeId);
  const consentSummary = useStoreWhatsAppConsentSummary(storeId);
  const usage = useStoreWhatsAppUsage(storeId);
  const history = useStoreWhatsAppMessageHistory(storeId, 8);
  const actions = useStoreWhatsAppActions();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState<"transactional" | "marketing">("transactional");
  const [body, setBody] = useState("");
  const [language, setLanguage] = useState("pt_BR");
  const [templateNotice, setTemplateNotice] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);

  if (!storeId) {
    return <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-muted-foreground">Nenhuma loja vinculada a esta conta.</div>;
  }

  const isEvolution = readiness.data?.provider === "evolution_api";
  const canUseMetaTemplates = Boolean(
    readiness.data?.automatic_entitled
      && readiness.data?.provider_connected
      && readiness.data?.provider === "meta_whatsapp",
  );
  const templateBusy = actions.saveTemplate.isPending || actions.submitTemplate.isPending;
  const usedMessages = (usage.data?.items ?? []).reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);

  const resetForm = () => {
    setEditingId(null);
    setCode("");
    setName("");
    setPurpose("transactional");
    setBody("");
    setLanguage("pt_BR");
  };

  const editTemplate = (template: StoreMessageTemplate) => {
    setTemplateNotice(null);
    setTemplateError(null);
    setEditingId(template.id);
    setCode(template.code);
    setName(template.name);
    setPurpose(template.purpose);
    setBody(template.body);
    setLanguage(template.provider_language);
  };

  const submitTemplate = async (templateId: string) => {
    setTemplateNotice(null);
    setTemplateError(null);
    try {
      const result = await actions.submitTemplate.mutateAsync({ storeId, templateId });
      setTemplateNotice(result.status === "approved" ? "Template aprovado." : "Template enviado para aprovação.");
    } catch (error) {
      setTemplateError(templateOperationError(error));
    }
  };

  const saveTemplate = async () => {
    if (!code.trim() || !name.trim() || !body.trim() || templateBusy) return;
    setTemplateNotice(null);
    setTemplateError(null);
    try {
      const saved = await actions.saveTemplate.mutateAsync({
        storeId,
        id: editingId,
        code: code.trim(),
        name: name.trim(),
        purpose,
        body: body.trim(),
        providerLanguage: language.trim() || "pt_BR",
        isActive: true,
      });
      resetForm();

      if (isEvolution) {
        setTemplateNotice("Template salvo.");
        return;
      }
      if (!canUseMetaTemplates) {
        setTemplateNotice("Template salvo como rascunho.");
        return;
      }
      try {
        await actions.submitTemplate.mutateAsync({ storeId, templateId: saved.id });
        setTemplateNotice("Template salvo e enviado à Meta.");
      } catch (error) {
        setTemplateError(`Template salvo. ${templateOperationError(error)}`);
      }
    } catch {
      setTemplateError("Não foi possível salvar o template.");
    }
  };

  const syncTemplates = async () => {
    if (!canUseMetaTemplates || actions.syncTemplates.isPending) return;
    setTemplateNotice(null);
    setTemplateError(null);
    try {
      await actions.syncTemplates.mutateAsync({ storeId });
      setTemplateNotice("Templates sincronizados.");
    } catch (error) {
      setTemplateError(templateOperationError(error));
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
      <Link to="/app/loja/modulos" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Voltar para módulos
      </Link>

      <header className="rounded-[24px] bg-[#4B1D6D] p-5 text-white shadow-e2 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 text-xs font-bold text-white/70">
              <MessageCircle className="size-3.5" /> WhatsApp
            </div>
            <h1 className="font-display text-2xl font-black tracking-tight sm:text-3xl">WhatsApp da loja</h1>
            <p className="mt-1 max-w-xl text-sm leading-6 text-white/70">Conecte o número, teste o envio e configure automações quando precisar.</p>
          </div>
          <Badge className="shrink-0 border-white/15 bg-white/10 text-white hover:bg-white/10">
            {readiness.data?.provider_connected ? "Conectado" : "Configurar"}
          </Badge>
        </div>
      </header>

      <WhatsAppEvolutionConnectionCard storeId={storeId} />

      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-3 gap-2">
            <MiniMetric label="Templates" value={templates.data?.length ?? 0} />
            <MiniMetric label="Opt-ins" value={consentSummary.data?.opted_in ?? 0} />
            <MiniMetric label="Mensagens" value={usedMessages} />
          </div>
        </CardContent>
      </Card>

      {templateNotice ? <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-300">{templateNotice}</p> : null}
      {templateError ? <p className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{templateError}</p> : null}

      <details className="overflow-hidden rounded-2xl border border-border bg-card">
        <summary className="cursor-pointer list-none px-5 py-4 font-semibold">Templates e automações</summary>
        <div className="space-y-5 border-t border-border p-5">
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-4">
              <div>
                <p className="font-semibold">{editingId ? "Editar template" : "Novo template"}</p>
                <p className="mt-1 text-sm text-muted-foreground">Crie mensagens que podem ser reutilizadas nas automações.</p>
              </div>
              <div>
                <Label>Código interno</Label>
                <Input value={code} onChange={(event) => setCode(event.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ""))} placeholder="pedido_confirmado" maxLength={80} />
              </div>
              <div>
                <Label>Nome</Label>
                <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Pedido confirmado" maxLength={120} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Finalidade</Label>
                  <select className="mt-2 h-11 w-full rounded-xl border border-input bg-surface px-3 text-sm" value={purpose} onChange={(event) => setPurpose(event.target.value as "transactional" | "marketing")}>
                    <option value="transactional">Transacional</option>
                    <option value="marketing">Marketing</option>
                  </select>
                </div>
                <div>
                  <Label>Idioma</Label>
                  <Input value={language} onChange={(event) => setLanguage(event.target.value)} maxLength={20} />
                </div>
              </div>
              <div>
                <Label>Mensagem</Label>
                <Textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Olá {{1}}, seu pedido {{2}} foi confirmado." rows={5} maxLength={4096} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void saveTemplate()} disabled={templateBusy || !code.trim() || !name.trim() || !body.trim()}>
                  {templateBusy ? "Salvando..." : editingId ? "Salvar" : "Criar template"}
                </Button>
                {editingId ? <Button variant="outline" onClick={resetForm} disabled={templateBusy}>Cancelar</Button> : null}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">Templates salvos</p>
                  <p className="text-sm text-muted-foreground">{templates.data?.length ?? 0} cadastrado(s)</p>
                </div>
                {canUseMetaTemplates ? (
                  <Button size="sm" variant="outline" onClick={() => void syncTemplates()} disabled={actions.syncTemplates.isPending || templateBusy}>
                    <RefreshCw className={`size-3.5 ${actions.syncTemplates.isPending ? "animate-spin" : ""}`} /> Sincronizar
                  </Button>
                ) : null}
              </div>

              {(templates.data ?? []).map((template) => {
                const canSubmit = canUseMetaTemplates && (template.provider_status === "draft" || template.provider_status === "rejected");
                return (
                  <div key={template.id} className="rounded-xl border border-border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{template.name}</p>
                          <Badge variant={isEvolution ? "secondary" : templateStatusVariant(template.provider_status)}>
                            {isEvolution ? "Local" : templateStatusLabel(template.provider_status)}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{template.code}</p>
                      </div>
                      <div className="flex gap-2">
                        {canSubmit ? (
                          <Button size="sm" onClick={() => void submitTemplate(template.id)} disabled={actions.submitTemplate.isPending}>
                            <Send className="size-3.5" /> Enviar
                          </Button>
                        ) : null}
                        <Button size="sm" variant="outline" onClick={() => editTemplate(template)} disabled={templateBusy}>
                          <Pencil className="size-3.5" /> Editar
                        </Button>
                      </div>
                    </div>
                    <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{template.body}</p>
                  </div>
                );
              })}

              {!templates.isLoading && (templates.data?.length ?? 0) === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">Nenhum template ainda.</p>
              ) : null}
            </div>
          </div>
        </div>
      </details>

      <details className="overflow-hidden rounded-2xl border border-border bg-card">
        <summary className="cursor-pointer list-none px-5 py-4 font-semibold">Atividade e histórico</summary>
        <div className="space-y-5 border-t border-border p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <CompactInfo icon={Users} label="Opt-ins de marketing" value={String(consentSummary.data?.opted_in ?? 0)} />
            <CompactInfo icon={Send} label="Uso no mês" value={String(usedMessages)} />
            <CompactInfo icon={Clock3} label="Mensagens recentes" value={String(history.data?.length ?? 0)} />
          </div>

          <div className="space-y-2">
            {(history.data ?? []).slice(0, 5).map((message) => (
              <div key={message.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{message.customer_name || message.recipient_e164}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{providerLabel(message.provider)} · {formatDate(message.queued_at)}</p>
                </div>
                <Badge variant={message.status === "failed" ? "destructive" : message.status === "read" || message.status === "delivered" ? "default" : "secondary"}>{message.status}</Badge>
              </div>
            ))}
            {!history.isLoading && (history.data?.length ?? 0) === 0 ? <p className="text-sm text-muted-foreground">Nenhuma mensagem enviada ainda.</p> : null}
          </div>
        </div>
      </details>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-muted/45 px-3 py-3 text-center">
      <p className="text-lg font-black">{typeof value === "number" ? value.toLocaleString("pt-BR") : value}</p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function CompactInfo({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border p-3">
      <div className="flex size-9 items-center justify-center rounded-xl bg-muted"><Icon className="size-4" /></div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-semibold">{value}</p>
      </div>
    </div>
  );
}
