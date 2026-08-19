import { CheckCircle2, Clock3, MessageCircle, ShieldCheck, TriangleAlert } from "lucide-react";

import type { WhatsAppAddonProvisioning } from "@/lib/whatsapp-addon.functions";

const COPY: Record<WhatsAppAddonProvisioning["status"], { title: string; description: string; tone: string }> = {
  not_requested: { title: "Disponível como adicional", description: "A automação por WhatsApp será contratada separadamente do plano principal. Nenhum provedor é provisionado antes do pagamento.", tone: "text-muted-foreground" },
  awaiting_payment: { title: "Aguardando pagamento", description: "A contratação foi iniciada, mas nenhuma infraestrutura de WhatsApp será criada até a confirmação do pagamento.", tone: "text-warning" },
  paid: { title: "Pagamento confirmado", description: "O adicional está pago e entrou na fila segura de provisionamento.", tone: "text-success" },
  provisioning: { title: "Preparando WhatsApp", description: "O Comandiva está preparando o canal no provedor configurado.", tone: "text-brand" },
  awaiting_customer: { title: "Ação necessária", description: "O canal está pronto para a etapa de conexão/autorização da conta WhatsApp da loja.", tone: "text-warning" },
  active: { title: "WhatsApp Automático ativo", description: "Pagamento e provisionamento foram confirmados. O canal está liberado para as automações habilitadas.", tone: "text-success" },
  degraded: { title: "WhatsApp com atenção", description: "O canal permanece cadastrado, mas o provedor reportou uma condição que exige recuperação.", tone: "text-warning" },
  suspended: { title: "WhatsApp suspenso", description: "Novos envios estão bloqueados até a regularização comercial ou técnica.", tone: "text-warning" },
  cancelled: { title: "Adicional cancelado", description: "O adicional não está ativo e não gera novos provisionamentos.", tone: "text-muted-foreground" },
  failed: { title: "Falha no provisionamento", description: "O pagamento não é suficiente para liberar o recurso: o canal precisa ser provisionado com sucesso antes da ativação.", tone: "text-destructive" },
};

export function WhatsAppAddonStatus({ data, loading }: { data?: WhatsAppAddonProvisioning; loading: boolean }) {
  if (loading) return <div className="h-40 animate-pulse rounded-2xl border border-border bg-muted/45" />;
  const status = data?.status ?? "not_requested";
  const copy = COPY[status];
  const Icon = status === "active" ? CheckCircle2 : status === "failed" || status === "degraded" ? TriangleAlert : status === "not_requested" ? MessageCircle : Clock3;

  return (
    <article className="panel p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-soft-foreground"><Icon className="size-5" /></span>
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[.12em] text-muted-foreground">Adicional</p>
          <h2 className={`mt-1 font-display text-xl font-black ${copy.tone}`}>WhatsApp Automático</h2>
          <p className="mt-2 text-sm font-bold text-foreground">{copy.title}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy.description}</p>
        </div>
      </div>
      <div className="mt-4 flex items-start gap-2 rounded-xl border border-border bg-muted/35 p-3 text-xs leading-5 text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        <span>Credenciais do provedor ficam somente no backend. A loja não precisa cadastrar servidor, API key ou cartão de infraestrutura.</span>
      </div>
      {data?.onboarding_url && status === "awaiting_customer" ? (
        <a className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 text-sm font-extrabold text-brand-foreground" href={data.onboarding_url} rel="noreferrer">Conectar WhatsApp</a>
      ) : null}
    </article>
  );
}
