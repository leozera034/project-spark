import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Bot, PauseCircle, Pencil, PlayCircle, Save, Workflow } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AutomationEventCode, AutomationRule, AutomationVariableDefinition } from "@/lib/store-growth.functions";
import {
  useStoreAutomationBuilderCatalog,
  useStoreAutomationRules,
  useStoreGrowthActions,
} from "@/store/growth/store-growth.queries";
import { useStoreWhatsAppReadiness } from "@/store/growth/store-whatsapp.queries";

const PREFERRED_VARIABLES = [
  "cliente.nome",
  "pedido.numero",
  "pedido.valor_total",
  "pedido.tempo_estimado",
  "loja.nome",
  "pedido.status",
  "pedido.taxa_entrega",
  "pedido.data",
  "cliente.total_pedidos",
  "cliente.valor_total_compras",
  "cliente.dias_sem_pedir",
  "cliente.telefone",
  "cliente.ultimo_pedido_em",
];

function suggestedBindings(count: number, variables: AutomationVariableDefinition[]) {
  const allowed = new Set(variables.map((variable) => variable.code));
  const ordered = [
    ...PREFERRED_VARIABLES.filter((code) => allowed.has(code)),
    ...variables.map((variable) => variable.code).filter((code) => !PREFERRED_VARIABLES.includes(code)),
  ];
  const result: Record<string, string> = {};
  for (let index = 1; index <= count; index += 1) result[String(index)] = ordered[index - 1] ?? "";
  return result;
}

function automaticConfig(rule: AutomationRule) {
  const mode = typeof rule.config.mode === "string" ? rule.config.mode : "assisted";
  const templateId = typeof rule.config.template_id === "string" ? rule.config.template_id : "";
  const rawBindings = rule.config.variable_bindings;
  const bindings = rawBindings && typeof rawBindings === "object" && !Array.isArray(rawBindings)
    ? Object.fromEntries(Object.entries(rawBindings).filter(([, value]) => typeof value === "string")) as Record<string, string>
    : {};
  return { mode, templateId, bindings };
}

function automationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("WHATSAPP_PROVIDER_NOT_CONNECTED")) return "Conecte um provedor de WhatsApp automático antes de ativar esta automação.";
  if (message.includes("MESSAGE_TEMPLATE_NOT_PROVIDER_APPROVED")) return "O provedor conectado exige aprovação prévia deste template.";
  if (message.includes("VARIABLE_BINDING_COUNT_MISMATCH")) return "Mapeie todas as variáveis exigidas pelo template.";
  if (message.includes("VARIABLE_BINDING_NOT_ALLOWED")) return "Uma das variáveis escolhidas não é permitida para esse evento.";
  if (message.includes("BILLING_RESTRICTED")) return "O plano atual não permite alterar automações.";
  return "Não foi possível salvar a automação. Confira a integração, o template e os campos escolhidos.";
}

export function WhatsAppAutomationBuilder({ storeId }: { storeId: string }) {
  const catalog = useStoreAutomationBuilderCatalog(storeId);
  const rules = useStoreAutomationRules(storeId);
  const readiness = useStoreWhatsAppReadiness(storeId);
  const actions = useStoreGrowthActions();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [eventCode, setEventCode] = useState<AutomationEventCode | "">("");
  const [templateId, setTemplateId] = useState("");
  const [bindings, setBindings] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const events = catalog.data?.events ?? [];
  const templates = catalog.data?.templates ?? [];
  const effectiveEventCode = eventCode || events[0]?.code || "";
  const selectedEvent = events.find((event) => event.code === effectiveEventCode) ?? null;
  const selectedTemplate = templates.find((template) => template.id === templateId) ?? null;
  const providerReady = Boolean(readiness.data?.automatic_entitled && readiness.data?.provider_connected);
  const automaticReady = Boolean(readiness.data?.ready_for_automatic);
  const isEvolution = readiness.data?.provider === "evolution_api";
  const requiresApproval = readiness.data?.requires_provider_template_approval ?? true;

  const templateById = useMemo(
    () => new Map(templates.map((template) => [template.id, template])),
    [templates],
  );
  const eventByCode = useMemo(
    () => new Map(events.map((event) => [event.code, event])),
    [events],
  );

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setEventCode("");
    setTemplateId("");
    setBindings({});
  };

  const changeEvent = (nextEvent: AutomationEventCode) => {
    setEventCode(nextEvent);
    const next = eventByCode.get(nextEvent);
    if (selectedTemplate && next) setBindings(suggestedBindings(selectedTemplate.parameter_count, next.variables));
  };

  const changeTemplate = (nextTemplateId: string) => {
    setTemplateId(nextTemplateId);
    const nextTemplate = templateById.get(nextTemplateId);
    if (nextTemplate && selectedEvent) setBindings(suggestedBindings(nextTemplate.parameter_count, selectedEvent.variables));
    else setBindings({});
  };

  const editRule = (rule: AutomationRule) => {
    const config = automaticConfig(rule);
    setNotice(null);
    setError(null);
    setEditingId(rule.id);
    setName(rule.name);
    setEventCode(rule.event_code);
    setTemplateId(config.templateId);
    setBindings(config.bindings);
  };

  const saveRule = async () => {
    if (!name.trim() || !effectiveEventCode || !selectedTemplate || !selectedEvent || actions.saveRule.isPending) return;
    const required = selectedTemplate.parameter_count;
    const complete = Array.from({ length: required }, (_, index) => bindings[String(index + 1)]).every(Boolean);
    if (!complete) {
      setError("Mapeie todos os parâmetros do template antes de salvar.");
      return;
    }

    setError(null);
    setNotice(null);
    try {
      await actions.saveRule.mutateAsync({
        storeId,
        id: editingId,
        eventCode: effectiveEventCode,
        name: name.trim(),
        enabled: true,
        config: {
          mode: "automatic",
          template_id: selectedTemplate.id,
          variable_bindings: bindings,
        },
      });
      resetForm();
      setNotice(editingId ? "Automação atualizada e revalidada pelo backend." : "Automação criada e pronta para disparar quando o evento acontecer.");
    } catch (cause) {
      setError(automationError(cause));
    }
  };

  const toggleRule = async (rule: AutomationRule) => {
    setError(null);
    setNotice(null);
    try {
      await actions.saveRule.mutateAsync({
        storeId,
        id: rule.id,
        eventCode: rule.event_code,
        name: rule.name,
        enabled: !rule.is_enabled,
        config: rule.config,
      });
      setNotice(rule.is_enabled ? "Automação pausada." : "Automação reativada e revalidada.");
    } catch (cause) {
      setError(automationError(cause));
    }
  };

  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bot className="size-5 text-brand" /> Automações WhatsApp
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Evento → template validado → variáveis validadas → fila de envio. Valores do pedido e do cliente são resolvidos no backend.
            </p>
            {isEvolution ? (
              <p className="mt-1 text-xs text-muted-foreground">Integração automática powered by Evolution API · self-hosted.</p>
            ) : null}
          </div>
          <Badge variant={automaticReady ? "default" : "secondary"} className="w-fit">
            {automaticReady ? "Automático disponível" : "Configuração pendente"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {notice ? <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p> : null}
        {error ? <p className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}

        {!providerReady ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface-muted/40 p-5">
            <p className="font-semibold">Conclua o WhatsApp Automático</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              O construtor fica disponível quando o add-on estiver ativo e um provedor WhatsApp estiver conectado.
            </p>
            <Button asChild className="mt-3" size="sm">
              <Link to="/app/loja/whatsapp">Abrir Central WhatsApp</Link>
            </Button>
          </div>
        ) : templates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface-muted/40 p-5">
            <p className="font-semibold">Falta um template disponível</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {requiresApproval
                ? "Crie o template na Central WhatsApp e aguarde a aprovação do provedor. Assim que aprovado, ele aparecerá aqui."
                : "Crie um template ativo na Central WhatsApp. No Evolution API ele pode ser usado localmente sem aprovação da Meta."}
            </p>
            <Button asChild className="mt-3" size="sm" variant="outline">
              <Link to="/app/loja/whatsapp">Gerenciar templates</Link>
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-surface-muted/30 p-4 sm:p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Nome da automação</Label>
                <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Avisar quando sair para entrega" maxLength={120} />
              </div>
              <div>
                <Label>Quando acontecer</Label>
                <select
                  className="mt-2 h-11 w-full rounded-xl border border-input bg-surface px-3 text-sm text-foreground"
                  value={effectiveEventCode}
                  onChange={(event) => changeEvent(event.target.value as AutomationEventCode)}
                >
                  {events.map((event) => <option key={event.code} value={event.code}>{event.label}</option>)}
                </select>
              </div>
            </div>

            {selectedEvent ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{selectedEvent.description}</p> : null}

            <div className="mt-4">
              <Label>{requiresApproval ? "Template aprovado pelo provedor" : "Template local da automação"}</Label>
              <select
                className="mt-2 h-11 w-full rounded-xl border border-input bg-surface px-3 text-sm text-foreground"
                value={templateId}
                onChange={(event) => changeTemplate(event.target.value)}
              >
                <option value="">Selecione um template</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} · {template.parameter_count} parâmetro(s)
                  </option>
                ))}
              </select>
            </div>

            {selectedTemplate && selectedEvent ? (
              <div className="mt-5 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{selectedTemplate.purpose === "marketing" ? "Marketing" : "Transacional"}</Badge>
                  <Badge variant="outline">{selectedTemplate.provider_language}</Badge>
                  <Badge variant="outline">{selectedTemplate.parameter_count} variável(is)</Badge>
                </div>

                {selectedTemplate.parameter_count === 0 ? (
                  <p className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">Esse template não possui parâmetros dinâmicos.</p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {Array.from({ length: selectedTemplate.parameter_count }, (_, index) => {
                      const position = String(index + 1);
                      return (
                        <div key={position} className="rounded-xl border border-border bg-surface p-3">
                          <Label>{`{{${position}}}`} recebe</Label>
                          <select
                            className="mt-2 h-10 w-full rounded-lg border border-input bg-surface px-3 text-sm text-foreground"
                            value={bindings[position] ?? ""}
                            onChange={(event) => setBindings((current) => ({ ...current, [position]: event.target.value }))}
                          >
                            <option value="">Selecione o dado</option>
                            {selectedEvent.variables.map((variable) => (
                              <option key={variable.code} value={variable.code}>{variable.label}</option>
                            ))}
                          </select>
                          {bindings[position] ? <p className="mt-1 truncate text-[11px] text-muted-foreground">{bindings[position]}</p> : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                onClick={() => void saveRule()}
                disabled={actions.saveRule.isPending || !name.trim() || !effectiveEventCode || !selectedTemplate}
              >
                <Save className="size-4" /> {actions.saveRule.isPending ? "Salvando..." : editingId ? "Salvar automação" : "Criar automação"}
              </Button>
              {editingId ? <Button variant="outline" onClick={resetForm} disabled={actions.saveRule.isPending}>Cancelar edição</Button> : null}
            </div>
          </div>
        )}

        <div className="space-y-2 border-t border-border pt-4">
          <div className="flex items-center gap-2">
            <Workflow className="size-4 text-brand" />
            <p className="text-sm font-bold">Regras configuradas</p>
          </div>
          {(rules.data ?? []).map((rule) => {
            const config = automaticConfig(rule);
            const event = eventByCode.get(rule.event_code);
            const template = config.templateId ? templateById.get(config.templateId) : null;
            return (
              <div key={rule.id} className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{rule.name}</p>
                    <Badge variant={rule.is_enabled ? "default" : "secondary"}>{rule.is_enabled ? "Ativa" : "Pausada"}</Badge>
                    <Badge variant="outline">{config.mode === "automatic" ? "Automática" : "Assistida"}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {event?.label ?? rule.event_code.replaceAll("_", " ")}{template ? ` · ${template.name}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {config.mode === "automatic" ? (
                    <Button size="sm" variant="outline" onClick={() => editRule(rule)} disabled={actions.saveRule.isPending}>
                      <Pencil className="size-3.5" /> Editar
                    </Button>
                  ) : null}
                  <Button size="sm" variant="outline" onClick={() => void toggleRule(rule)} disabled={actions.saveRule.isPending}>
                    {rule.is_enabled ? <PauseCircle className="size-3.5" /> : <PlayCircle className="size-3.5" />}
                    {rule.is_enabled ? "Pausar" : "Ativar"}
                  </Button>
                </div>
              </div>
            );
          })}
          {!rules.isLoading && (rules.data?.length ?? 0) === 0 ? (
            <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">Nenhuma automação configurada ainda.</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
