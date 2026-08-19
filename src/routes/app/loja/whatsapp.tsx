import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  MessageCircle,
  Pencil,
  RefreshCw,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";

import { WhatsAppMetaConnectionCard } from "@/components/store/WhatsAppMetaConnectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { StoreMessageTemplate } from "@/lib/store-whatsapp.functions";
import {
  useStoreWhatsAppConsentSummary,
  useStoreWhatsAppConsents,
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
  if (provider === "meta_whatsapp") return "Meta WhatsApp";
  if (provider === "360dialog_whatsapp") return "360dialog";
  if (provider === "twilio_whatsapp") return "Twilio";
  return "Não conectado";
}

function providerCategoryLabel(category: StoreMessageTemplate["provider_category"]) {
  if (category === "UTILITY") return "Utilidade";
  if (category === "MARKETING") return "Marketing";
  if (category === "AUTHENTICATION") return "Autenticação";
  return null;
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
  if (message.includes("TEMPLATE_VARIABLES_INVALID")) {
    return "Use variáveis sequenciais no formato {{1}}, {{2}}, sem pular números.";
  }
  if (message.includes("TEMPLATE_INACTIVE")) return "Ative o template antes de enviá-lo para a Meta.";
  if (message.includes("FORBIDDEN")) return "Sua conta não tem permissão para gerenciar os templates desta loja.";
  if (message.startsWith("META_TEMPLATE_SUBMISSION_FAILED:")) {
    return message.slice("META_TEMPLATE_SUBMISSION_FAILED:".length).trim() || "A Meta recusou a submissão do template.";
  }
  if (message.startsWith("META_TEMPLATE_SYNC_FAILED:")) {
    return message.slice("META_TEMPLATE_SYNC_FAILED:".length).trim() || "A Meta recusou a sincronização dos templates.";
  }
  if (message.includes("META_TEMPLATE_SUBMISSION_UNAVAILABLE")) {
    return "O template foi salvo, mas a integração Meta ainda não está disponível para enviá-lo.";
  }
  if (message.includes("META_TEMPLATE_SYNC_UNAVAILABLE")) {
    return "Não foi possível sincronizar os templates agora.";
  }
  return "Não foi possível concluir a operação do template com a Meta.";
}

function WhatsAppCenter() {
  const { storeId } = useStoreScope();
  const readiness = useStoreWhatsAppReadiness(storeId);
  const templates = useStoreMessageTemplates(storeId);
  const consentSummary = useStoreWhatsAppConsentSummary(storeId);
  const consents = useStoreWhatsAppConsents(storeId, 12);
  const usage = useStoreWhatsAppUsage(storeId);
  const history = useStoreWhatsAppMessageHistory(storeId, 20);
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
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-muted-foreground">
        Nenhuma loja vinculada a esta conta.
      </div>
    );
  }

  const canUseMetaTemplates = Boolean(
    readiness.data?.automatic_entitled
      && readiness.data?.provider_connected
      && readiness.data?.provider === "meta_whatsapp",
  );
  const templateBusy = actions.saveTemplate.isPending || actions.submitTemplate.isPending;

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
      setTemplateNotice(
        result.status === "approved"
          ? "Template sincronizado e aprovado pela Meta."
          : result.status === "rejected"
            ? "A Meta retornou o template como rejeitado. Veja o motivo no card."
            : "Template enviado à Meta e aguardando aprovação.",
      );
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

      if (!canUseMetaTemplates) {
        setTemplateNotice("Template salvo como rascunho local. A conexão oficial da Meta é necessária para enviá-lo para aprovação.");
        return;
      }

      try {
        const submitted = await actions.submitTemplate.mutateAsync({ storeId, templateId: saved.id });
        setTemplateNotice(
          submitted.status === "approved"
            ? "Template salvo e confirmado como aprovado pela Meta."
            : "Template salvo e enviado à Meta para aprovação.",
        );
      } catch (error) {
        setTemplateError(`O template foi salvo no Comandiva. ${templateOperationError(error)}`);
      }
    } catch {
      setTemplateError("Não foi possível salvar o template no Comandiva.");
    }
  };

  const syncTemplates = async () => {
    if (!canUseMetaTemplates || actions.syncTemplates.isPending) return;
    setTemplateNotice(null);
    setTemplateError(null);
    try {
      const result = await actions.syncTemplates.mutateAsync({ storeId });
      setTemplateNotice(
        `Sincronização concluída: ${result.remoteCount.toLocaleString("pt-BR")} template(s) na Meta e ${result.matchedCount.toLocaleString("pt-BR")} vínculo(s) atualizado(s) no Comandiva.`,
      );
    } catch (error) {
      setTemplateError(templateOperationError(error));
    }
  };

  const usedMessages = (usage.data?.items ?? []).reduce(
    (sum, item) => sum + Number(item.quantity ?? 0),
    0,
  );
  const firstHardLimit = (usage.data?.items ?? []).find((item) => item.hard_limit_units != null)?.hard_limit_units ?? null;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <Link
          to="/app/loja/modulos"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Voltar para módulos
        </Link>
      </div>

      <header className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#4B1D6D] p-6 text-white shadow-e2 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-[#25D366]/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold">
              <MessageCircle className="size-3.5" /> Central WhatsApp
            </div>
            <h1 className="font-display text-3xl font-black tracking-tight sm:text-4xl">WhatsApp no Comandiva</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
              Templates, consentimento, consumo e histórico em uma única central. O modo assistido segue gratuito; o envio automático permanece bloqueado até a integração estar homologada.
            </p>
          </div>
          <Badge className="w-fit border-white/20 bg-white/10 text-white hover:bg-white/10">
            {readiness.data?.ready_for_automatic ? "Infra pronta" : "Automático bloqueado"}
          </Badge>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard
          icon={CheckCircle2}
          label="Modo assistido"
          value="Ativo"
          detail="Sem consumo de API paga"
        />
        <StatusCard
          icon={ShieldCheck}
          label="Add-on automático"
          value={readiness.data?.automatic_entitled ? "Ativo" : "Não contratado"}
          detail={providerLabel(readiness.data?.provider)}
        />
        <StatusCard
          icon={Send}
          label="Templates aprovados"
          value={String(readiness.data?.templates_approved ?? 0)}
          detail={`${readiness.data?.templates_total ?? 0} cadastrados`}
        />
        <StatusCard
          icon={Users}
          label="Opt-ins marketing"
          value={String(consentSummary.data?.opted_in ?? 0)}
          detail={`${consentSummary.data?.not_recorded ?? 0} sem registro`}
        />
      </section>

      <WhatsAppMetaConnectionCard
        storeId={storeId}
        automaticEntitled={Boolean(readiness.data?.automatic_entitled)}
      />

      {templateNotice ? (
        <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-700 dark:text-emerald-300">
          {templateNotice}
        </p>
      ) : null}
      {templateError ? (
        <p className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {templateError}
        </p>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1fr_1.15fr]">
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Editar template" : "Novo template"}</CardTitle>
            <p className="text-sm text-muted-foreground">
              Você edita o conteúdo. Nome técnico, ID remoto, categoria e aprovação são controlados pelo backend e pela Meta.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Código interno</Label>
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ""))}
                placeholder="pedido_confirmado"
                maxLength={80}
              />
            </div>
            <div>
              <Label>Nome</Label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Pedido confirmado"
                maxLength={120}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Finalidade</Label>
                <select
                  className="mt-2 h-11 w-full rounded-xl border border-input bg-surface px-3 text-sm text-foreground"
                  value={purpose}
                  onChange={(event) => setPurpose(event.target.value as "transactional" | "marketing")}
                >
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
              <Textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Olá {{1}}, seu pedido {{2}} foi confirmado."
                rows={7}
                maxLength={4096}
              />
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Variáveis devem ser sequenciais: {"{{1}}"}, {"{{2}}"}, {"{{3}}"}. Ao alterar mensagem, finalidade ou idioma de um template homologado, ele volta para rascunho e precisa de nova aprovação.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => void saveTemplate()}
                disabled={templateBusy || !code.trim() || !name.trim() || !body.trim()}
              >
                {templateBusy
                  ? "Processando..."
                  : canUseMetaTemplates
                    ? editingId ? "Salvar e reenviar à Meta" : "Salvar e enviar à Meta"
                    : editingId ? "Salvar alterações" : "Criar rascunho"}
              </Button>
              {editingId ? (
                <Button type="button" variant="outline" onClick={resetForm} disabled={templateBusy}>
                  Cancelar edição
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Templates da loja</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Aprovação vem exclusivamente da Meta. O Comandiva sincroniza o status e bloqueia automações enquanto não estiver aprovado.
                </p>
              </div>
              {canUseMetaTemplates ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void syncTemplates()}
                  disabled={actions.syncTemplates.isPending || templateBusy}
                >
                  <RefreshCw className={`size-3.5 ${actions.syncTemplates.isPending ? "animate-spin" : ""}`} />
                  {actions.syncTemplates.isPending ? "Sincronizando..." : "Sincronizar Meta"}
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {(templates.data ?? []).map((template) => {
              const category = providerCategoryLabel(template.provider_category);
              const canSubmit = canUseMetaTemplates && (template.provider_status === "draft" || template.provider_status === "rejected");
              return (
                <div key={template.id} className="rounded-2xl border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{template.name}</p>
                        <Badge variant={templateStatusVariant(template.provider_status)}>
                          {templateStatusLabel(template.provider_status)}
                        </Badge>
                        <Badge variant="outline">{template.purpose === "marketing" ? "Marketing" : "Transacional"}</Badge>
                        {category ? <Badge variant="outline">Meta: {category}</Badge> : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{template.code} · {template.provider_language}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canSubmit ? (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void submitTemplate(template.id)}
                          disabled={actions.submitTemplate.isPending || actions.syncTemplates.isPending}
                        >
                          <Send className="size-3.5" />
                          {template.provider_status === "rejected" ? "Reenviar à Meta" : "Enviar à Meta"}
                        </Button>
                      ) : null}
                      <Button type="button" size="sm" variant="outline" onClick={() => editTemplate(template)} disabled={templateBusy}>
                        <Pencil className="size-3.5" /> Editar
                      </Button>
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{template.body}</p>

                  {template.provider_template_name ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Meta: {template.provider_template_name}
                      {template.provider_template_id ? ` · ID ${template.provider_template_id}` : ""}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">Ainda não enviado à Meta.</p>
                  )}

                  {template.provider_rejection_reason ? (
                    <p className="mt-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs leading-5 text-destructive">
                      Motivo retornado pela Meta: {template.provider_rejection_reason}
                    </p>
                  ) : null}
                  {template.provider_submission_error ? (
                    <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-5 text-amber-700 dark:text-amber-300">
                      Falha na última tentativa de envio: {template.provider_submission_error}
                    </p>
                  ) : null}

                  {template.provider_status_updated_at || template.provider_synced_at ? (
                    <p className="mt-3 text-[11px] text-muted-foreground">
                      Status atualizado: {formatDate(template.provider_status_updated_at ?? template.provider_synced_at)}
                    </p>
                  ) : null}
                </div>
              );
            })}
            {!templates.isLoading && (templates.data?.length ?? 0) === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Nenhum template cadastrado ainda.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Consentimento de marketing</CardTitle>
            <p className="text-sm text-muted-foreground">
              O Comandiva separa mensagem transacional de marketing e mantém histórico de opt-in/opt-out por cliente.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <MiniMetric label="Autorizados" value={consentSummary.data?.opted_in ?? 0} />
              <MiniMetric label="Revogados" value={consentSummary.data?.opted_out ?? 0} />
              <MiniMetric label="Sem registro" value={consentSummary.data?.not_recorded ?? 0} />
            </div>
            <div className="space-y-2">
              {(consents.data ?? []).map((entry) => (
                <div key={entry.customer_id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{entry.customer_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{entry.phone} · origem: {entry.source}</p>
                  </div>
                  <Badge variant={entry.opted_in ? "default" : "secondary"}>
                    {entry.opted_in ? "Opt-in" : "Opt-out"}
                  </Badge>
                </div>
              ))}
              {!consents.isLoading && (consents.data?.length ?? 0) === 0 ? (
                <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
                  Ainda não existem registros de consentimento para WhatsApp marketing.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Consumo do mês</CardTitle>
            <p className="text-sm text-muted-foreground">
              O medidor só registra uso real. Enquanto o provider não estiver ativo, o consumo deve permanecer zerado.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <MiniMetric label="Unidades usadas" value={usedMessages} />
              <MiniMetric label="Hard limit" value={firstHardLimit == null ? "—" : Number(firstHardLimit)} />
            </div>
            {(usage.data?.items ?? []).map((item) => (
              <div key={`${item.provider}-${item.metric_code}`} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{providerLabel(item.provider)}</p>
                  <Badge variant="outline">{item.metric_code}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {Number(item.quantity).toLocaleString("pt-BR")} usadas
                  {item.included_units != null ? ` · ${Number(item.included_units).toLocaleString("pt-BR")} incluídas` : ""}
                </p>
              </div>
            ))}
            {!usage.isLoading && (usage.data?.items.length ?? 0) === 0 ? (
              <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">Nenhum consumo de WhatsApp registrado neste mês.</p>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock3 className="size-5" /> Histórico de mensagens</CardTitle>
          <p className="text-sm text-muted-foreground">
            A fila registra envio, entrega, leitura e falha sem expor credenciais do provider.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {(history.data ?? []).map((message) => (
            <div key={message.id} className="grid gap-2 rounded-xl border border-border p-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0">
                <p className="truncate font-semibold">{message.customer_name || message.recipient_e164}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {message.purpose === "marketing" ? "Marketing" : "Transacional"} · {providerLabel(message.provider)} · {formatDate(message.queued_at)}
                </p>
                {message.error_message ? <p className="mt-1 text-xs text-destructive">{message.error_message}</p> : null}
              </div>
              <Badge variant={message.status === "failed" ? "destructive" : message.status === "read" || message.status === "delivered" ? "default" : "secondary"}>
                {message.status}
              </Badge>
            </div>
          ))}
          {!history.isLoading && (history.data?.length ?? 0) === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nenhuma mensagem automática foi enviada. Isso é esperado enquanto o provider não estiver homologado.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof MessageCircle;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">{label}</p>
            <p className="mt-2 text-xl font-black text-foreground">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
          </div>
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-muted/50 p-3 text-center">
      <p className="text-lg font-black text-foreground">{typeof value === "number" ? value.toLocaleString("pt-BR") : value}</p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
