import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bot,
  ChartNoAxesCombined,
  Crown,
  MessageCircle,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  UserRoundPlus,
  Users,
  WalletCards,
} from "lucide-react";

import { useAuth } from "@/auth/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  useStoreAutomationRules,
  useStoreCustomerInsights,
  useStoreGrowthActions,
  useStoreGrowthSummary,
  useStoreMarketingCampaigns,
  useStoreRevenueSeries,
} from "@/store/growth/store-growth.queries";
import type { GrowthSegment } from "@/lib/store-growth.functions";

export const Route = createFileRoute("/app/loja/crescimento")({
  head: () => ({ meta: [{ title: "Crescimento | Pediu Aqui" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: GrowthCenter,
});

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const SEGMENTS: Array<{ key: GrowthSegment | "todos"; label: string }> = [
  { key: "todos", label: "Todos" },
  { key: "novos", label: "Novos" },
  { key: "recorrentes", label: "Recorrentes" },
  { key: "vip", label: "VIP" },
  { key: "inativos", label: "Inativos" },
];

function GrowthCenter() {
  const { authContext } = useAuth();
  const storeId = authContext?.store_ids?.[0] ?? null;
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<GrowthSegment | "todos">("todos");
  const [campaignName, setCampaignName] = useState("");
  const [campaignMessage, setCampaignMessage] = useState("");
  const [campaignAudience, setCampaignAudience] = useState<"todos" | GrowthSegment>("todos");

  const summary = useStoreGrowthSummary(storeId);
  const customers = useStoreCustomerInsights(storeId, {
    search: search || undefined,
    segment: segment === "todos" ? undefined : segment,
  });
  const revenue = useStoreRevenueSeries(storeId, 30);
  const campaigns = useStoreMarketingCampaigns(storeId);
  const automations = useStoreAutomationRules(storeId);
  const actions = useStoreGrowthActions();

  const maxRevenue = useMemo(
    () => Math.max(1, ...(revenue.data ?? []).map((point) => Number(point.revenue) || 0)),
    [revenue.data],
  );

  if (!storeId) {
    return <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-muted-foreground">Nenhuma loja vinculada a esta conta.</div>;
  }

  const saveCampaign = () => {
    if (!campaignName.trim() || !campaignMessage.trim()) return;
    actions.saveCampaign.mutate({
      storeId,
      name: campaignName,
      audience: campaignAudience,
      message: campaignMessage,
      status: "rascunho",
    }, {
      onSuccess: () => {
        setCampaignName("");
        setCampaignMessage("");
      },
    });
  };

  const createAutomation = (eventCode: "novo_cliente" | "pedido_concluido" | "cliente_inativo_30d" | "cliente_vip", name: string) => {
    actions.saveRule.mutate({ storeId, eventCode, name, enabled: true, config: {} });
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <header className="overflow-hidden rounded-[28px] border border-violet-400/15 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,.2),transparent_40%),linear-gradient(145deg,rgba(18,11,35,.98),rgba(7,4,15,.98))] p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-xs font-bold text-violet-200">
              <Sparkles className="size-3.5" /> Growth OS
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Crescimento da loja</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">Clientes, receita, retenção, campanhas e automações usando dados reais dos pedidos.</p>
          </div>
          <Button variant="outline" onClick={() => { void summary.refetch(); void customers.refetch(); void revenue.refetch(); }}>
            <RefreshCw className="size-4" /> Atualizar dados
          </Button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Users} label="Clientes" value={String(summary.data?.customers ?? 0)} detail={`${summary.data?.repeatCustomers ?? 0} recorrentes`} />
        <Metric icon={WalletCards} label="Receita · 30 dias" value={brl.format(Number(summary.data?.revenue30d ?? 0))} detail={`${summary.data?.orders30d ?? 0} pedidos válidos`} />
        <Metric icon={TrendingUp} label="Ticket médio" value={brl.format(Number(summary.data?.avgTicket30d ?? 0))} detail="Pedidos concluídos" />
        <Metric icon={Crown} label="Clientes VIP" value={String(summary.data?.vipCustomers ?? 0)} detail={`${summary.data?.inactiveCustomers ?? 0} para reativar`} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.45fr_.75fr]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-white/[.06]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><CardTitle>CRM de clientes</CardTitle><p className="mt-1 text-sm text-muted-foreground">Segmentação automática pelo histórico real de compras.</p></div>
              <Badge variant="secondary">{customers.data?.total ?? 0} encontrados</Badge>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar nome ou telefone" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
              <div className="flex gap-2 overflow-x-auto pb-1">{SEGMENTS.map((item) => <Button key={item.key} size="sm" variant={segment === item.key ? "default" : "outline"} onClick={() => setSegment(item.key)}>{item.label}</Button>)}</div>
            </div>
          </CardHeader>
          <CardContent className="divide-y divide-white/[.06] p-0">
            {(customers.data?.items ?? []).map((customer) => {
              const phone = customer.phone.replace(/\D/g, "");
              return <div key={customer.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate font-semibold">{customer.first_name}</p><Badge variant="outline" className="text-[10px] uppercase">{customer.segment}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{customer.orders_count} pedidos · {brl.format(Number(customer.lifetime_value ?? 0))} em compras</p></div>
                <a className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 text-sm font-semibold text-emerald-300" href={`https://wa.me/55${phone}`} target="_blank" rel="noreferrer"><MessageCircle className="size-4" /> WhatsApp</a>
              </div>;
            })}
            {!customers.isLoading && (customers.data?.items.length ?? 0) === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">Nenhum cliente neste segmento.</div> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Receita real · 30 dias</CardTitle><p className="text-sm text-muted-foreground">Série diária dos pedidos concluídos.</p></CardHeader>
          <CardContent>
            <div className="flex h-48 items-end gap-1.5" aria-label="Gráfico de receita diária">
              {(revenue.data ?? []).map((point) => <div key={point.day} className="group relative flex h-full flex-1 items-end"><div className="w-full rounded-t-md bg-gradient-to-t from-violet-700 to-fuchsia-400 transition-opacity group-hover:opacity-80" style={{ height: `${Math.max(4, (Number(point.revenue) / maxRevenue) * 100)}%` }} title={`${point.day}: ${brl.format(Number(point.revenue))}`} /></div>)}
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground"><span>30 dias atrás</span><span>Hoje</span></div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><MessageCircle className="size-5 text-violet-300" /> Campanhas</CardTitle><p className="text-sm text-muted-foreground">Prepare mensagens segmentadas. O sistema não dispara sem ação humana.</p></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2"><div><Label>Nome</Label><Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Ex.: Volta dos clientes inativos" /></div><div><Label>Público</Label><select className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm" value={campaignAudience} onChange={(e) => setCampaignAudience(e.target.value as "todos" | GrowthSegment)}>{SEGMENTS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></div></div>
            <div><Label>Mensagem</Label><Textarea value={campaignMessage} onChange={(e) => setCampaignMessage(e.target.value)} placeholder="Escreva a mensagem da campanha…" rows={4} /></div>
            <Button onClick={saveCampaign} disabled={actions.saveCampaign.isPending || !campaignName.trim() || !campaignMessage.trim()}>Salvar rascunho</Button>
            <div className="space-y-2 pt-2">{(campaigns.data ?? []).slice(0,5).map((campaign) => <div key={campaign.id} className="rounded-xl border border-white/[.06] bg-white/[.025] p-3"><div className="flex items-center justify-between gap-2"><p className="font-semibold">{campaign.name}</p><Badge variant="outline">{campaign.audience}</Badge></div><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{campaign.message}</p></div>)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Bot className="size-5 text-violet-300" /> Automações operacionais</CardTitle><p className="text-sm text-muted-foreground">Regras persistidas e auditáveis; nada de condicionais escondidas no frontend.</p></CardHeader>
          <CardContent className="space-y-3">
            {(automations.data ?? []).map((rule) => <div key={rule.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[.06] bg-white/[.025] p-4"><div><p className="font-semibold">{rule.name}</p><p className="mt-1 text-xs text-muted-foreground">{rule.event_code.replaceAll("_", " ")}</p></div><Badge variant={rule.is_enabled ? "default" : "secondary"}>{rule.is_enabled ? "Ativa" : "Pausada"}</Badge></div>)}
            {(automations.data?.length ?? 0) === 0 ? <div className="grid gap-2"><AutomationPreset icon={UserRoundPlus} label="Boas-vindas ao novo cliente" onClick={() => createAutomation("novo_cliente", "Boas-vindas ao novo cliente")} /><AutomationPreset icon={Crown} label="Reconhecer cliente VIP" onClick={() => createAutomation("cliente_vip", "Reconhecer cliente VIP")} /><AutomationPreset icon={RefreshCw} label="Reativar cliente após 30 dias" onClick={() => createAutomation("cliente_inativo_30d", "Reativar cliente após 30 dias")} /></div> : null}
          </CardContent>
        </Card>
      </section>

      <div className="rounded-2xl border border-violet-400/10 bg-violet-500/[.05] p-4 text-sm text-white/55"><ChartNoAxesCombined className="mr-2 inline size-4 text-violet-300" /> Os segmentos são inferidos de pedidos reais: VIP = 5+ pedidos; recorrente = 2+; inativo = sem comprar há mais de 30 dias. Esses critérios podem virar configuração por loja numa evolução futura.</div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Users; label: string; value: string; detail: string }) {
  return <Card><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-black tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div><div className="grid size-10 place-items-center rounded-xl border border-violet-400/15 bg-violet-500/10"><Icon className="size-5 text-violet-300" /></div></div></CardContent></Card>;
}

function AutomationPreset({ icon: Icon, label, onClick }: { icon: typeof Bot; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/[.08] bg-white/[.025] p-4 text-left transition hover:border-violet-400/20 hover:bg-violet-500/[.06]"><span className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-violet-500/10"><Icon className="size-4 text-violet-300" /></span><span className="font-semibold">{label}</span></span><span className="text-xs text-violet-300">Ativar</span></button>;
}
