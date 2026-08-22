import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Crown, MessageCircle, RefreshCw, Search, TrendingUp, Users, WalletCards } from "lucide-react";

import { useAuth } from "@/auth/useAuth";
import { WhatsAppAutomationBuilder } from "@/components/store/WhatsAppAutomationBuilder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { GrowthSegment } from "@/lib/store-growth.functions";
import {
  useStoreCrmSegmentSummary,
  useStoreCustomerInsights,
  useStoreGrowthActions,
  useStoreGrowthSummary,
  useStoreMarketingCampaigns,
  useStoreRevenueSeries,
} from "@/store/growth/store-growth.queries";

export const Route = createFileRoute("/app/loja/crescimento")({
  head: () => ({ meta: [{ title: "Clientes | Comandiva" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: CustomersCenter,
});

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const SEGMENTS: Array<{ key: GrowthSegment | "todos"; label: string }> = [
  { key: "todos", label: "Todos" },
  { key: "novos", label: "Novos" },
  { key: "recorrentes", label: "Recorrentes" },
  { key: "vip", label: "VIP" },
  { key: "inativos", label: "Inativos" },
];

function normalizeBrazilWhatsAppPhone(rawPhone: string) {
  const digits = rawPhone.replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`;
}

function CustomersCenter() {
  const { authContext } = useAuth();
  const storeId = authContext?.store_ids?.[0] ?? null;
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<GrowthSegment | "todos">("todos");
  const [campaignName, setCampaignName] = useState("");
  const [campaignMessage, setCampaignMessage] = useState("");
  const [campaignAudience, setCampaignAudience] = useState<"todos" | GrowthSegment>("todos");

  const summary = useStoreGrowthSummary(storeId);
  const crm = useStoreCrmSegmentSummary(storeId);
  const customers = useStoreCustomerInsights(storeId, { search: search || undefined, segment: segment === "todos" ? undefined : segment });
  const revenue = useStoreRevenueSeries(storeId, 30);
  const campaigns = useStoreMarketingCampaigns(storeId);
  const actions = useStoreGrowthActions();

  const maxRevenue = useMemo(() => Math.max(1, ...(revenue.data ?? []).map((point) => Number(point.revenue) || 0)), [revenue.data]);

  if (!storeId) return <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-muted-foreground">Nenhuma loja vinculada a esta conta.</div>;

  const saveCampaign = () => {
    if (!campaignName.trim() || !campaignMessage.trim()) return;
    actions.saveCampaign.mutate(
      { storeId, name: campaignName, audience: campaignAudience, message: campaignMessage, status: "rascunho" },
      { onSuccess: () => { setCampaignName(""); setCampaignMessage(""); } },
    );
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.14em] text-brand">Relacionamento</p>
          <h1 className="mt-1 font-display text-3xl font-black tracking-tight">Clientes</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Entenda quem compra, quem voltou e quem pode ser reativado.</p>
        </div>
        <Button variant="outline" onClick={() => { void summary.refetch(); void crm.refetch(); void customers.refetch(); void revenue.refetch(); }}><RefreshCw className="size-4" /> Atualizar</Button>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Users} label="Clientes" value={String(summary.data?.customers ?? 0)} detail={`${summary.data?.repeatCustomers ?? 0} recorrentes`} />
        <Metric icon={WalletCards} label="Receita · 30 dias" value={brl.format(Number(summary.data?.revenue30d ?? 0))} detail={`${summary.data?.orders30d ?? 0} pedidos concluídos`} />
        <Metric icon={TrendingUp} label="Ticket médio" value={brl.format(Number(summary.data?.avgTicket30d ?? 0))} detail="Últimos 30 dias" />
        <Metric icon={Crown} label="Clientes VIP" value={String(summary.data?.vipCustomers ?? 0)} detail={`${summary.data?.inactiveCustomers ?? 0} para reativar`} />
      </section>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Segmentos de clientes</CardTitle>
          <p className="text-sm text-muted-foreground">A classificação é atualizada automaticamente a partir do histórico de pedidos.</p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <CrmStat label="Novos" value={crm.data?.newCustomers ?? 0} />
          <CrmStat label="Recorrentes" value={crm.data?.repeatCustomers ?? 0} />
          <CrmStat label="VIP" value={crm.data?.vipCustomers ?? 0} />
          <CrmStat label="Inativos" value={crm.data?.inactiveCustomers ?? 0} />
          <CrmStat label="Aceitam marketing" value={crm.data?.marketingOptIns ?? 0} />
        </CardContent>
      </Card>

      <section className="grid min-w-0 gap-6 xl:grid-cols-[1.45fr_.75fr]">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="border-b border-border">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
              <div><CardTitle>Lista de clientes</CardTitle><p className="mt-1 text-sm text-muted-foreground">Busque e filtre pelo relacionamento com a loja.</p></div>
              <Badge variant="secondary">{customers.data?.total ?? 0} encontrados</Badge>
            </div>
            <div className="mt-4 flex min-w-0 flex-col gap-3">
              <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar nome ou telefone" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
              <div className="rail flex gap-2 overflow-x-auto pb-1">
                {SEGMENTS.map((item) => <Button key={item.key} size="sm" className="shrink-0" variant={segment === item.key ? "default" : "outline"} onClick={() => setSegment(item.key)}>{item.label}</Button>)}
              </div>
            </div>
          </CardHeader>
          <CardContent className="divide-y divide-border p-0">
            {(customers.data?.items ?? []).map((customer) => {
              const phone = normalizeBrazilWhatsAppPhone(customer.phone);
              return (
                <div key={customer.id} className="flex min-w-0 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2"><p className="truncate font-semibold">{customer.first_name}</p><Badge variant="outline" className="shrink-0 text-[10px] uppercase">{customer.segment}</Badge></div>
                    <p className="mt-1 text-xs text-muted-foreground">{customer.orders_count} pedidos · {brl.format(Number(customer.lifetime_value ?? 0))} em compras</p>
                  </div>
                  {phone ? <a className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-success/20 bg-success-soft px-3 text-sm font-semibold text-success" href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer"><MessageCircle className="size-4" /> WhatsApp</a> : null}
                </div>
              );
            })}
            {!customers.isLoading && (customers.data?.items.length ?? 0) === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">Nenhum cliente neste segmento.</div> : null}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader><CardTitle>Receita · 30 dias</CardTitle><p className="text-sm text-muted-foreground">Pedidos concluídos por dia.</p></CardHeader>
          <CardContent>
            <div className="flex h-48 min-w-0 items-end gap-1.5" aria-label="Gráfico de receita diária">
              {(revenue.data ?? []).map((point) => <div key={point.day} className="group relative flex h-full min-w-0 flex-1 items-end"><div className="w-full rounded-t-md bg-brand transition-opacity group-hover:opacity-75" style={{ height: `${Math.max(4, (Number(point.revenue) / maxRevenue) * 100)}%` }} title={`${point.day}: ${brl.format(Number(point.revenue))}`} /></div>)}
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground"><span>30 dias atrás</span><span>Hoje</span></div>
          </CardContent>
        </Card>
      </section>

      <section className="grid min-w-0 gap-6 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader><CardTitle className="flex items-center gap-2"><MessageCircle className="size-5 text-brand" /> Rascunhos de campanha</CardTitle><p className="text-sm text-muted-foreground">Organize uma mensagem e um público. Salvar aqui não dispara mensagens automaticamente.</p></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Nome</Label><Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Ex.: Volta dos clientes inativos" /></div>
              <div><Label>Público</Label><select className="mt-2 h-11 w-full rounded-xl border border-input bg-surface px-3 text-sm text-foreground" value={campaignAudience} onChange={(e) => setCampaignAudience(e.target.value as "todos" | GrowthSegment)}>{SEGMENTS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></div>
            </div>
            <div><Label>Mensagem</Label><Textarea value={campaignMessage} onChange={(e) => setCampaignMessage(e.target.value)} placeholder="Escreva a mensagem da campanha…" rows={4} /></div>
            <Button onClick={saveCampaign} disabled={actions.saveCampaign.isPending || !campaignName.trim() || !campaignMessage.trim()}>Salvar rascunho</Button>
            <div className="space-y-2 pt-2">{(campaigns.data ?? []).slice(0, 5).map((campaign) => <div key={campaign.id} className="rounded-xl border border-border bg-surface-muted/45 p-3"><div className="flex min-w-0 items-center justify-between gap-2"><p className="min-w-0 truncate font-semibold">{campaign.name}</p><Badge variant="outline">{campaign.audience}</Badge></div><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{campaign.message}</p></div>)}</div>
          </CardContent>
        </Card>

        <WhatsAppAutomationBuilder storeId={storeId} />
      </section>
    </div>
  );
}

function CrmStat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-border bg-surface px-4 py-3"><p className="text-[11px] font-bold uppercase tracking-[.1em] text-muted-foreground">{label}</p><p className="mt-1 text-xl font-black text-foreground">{value}</p></div>;
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Users; label: string; value: string; detail: string }) {
  return <Card><CardContent className="p-5"><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">{label}</p><p className="mt-2 break-words text-2xl font-black tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div><div className="grid size-10 shrink-0 place-items-center rounded-xl border border-brand/15 bg-brand-soft"><Icon className="size-5 text-brand" /></div></div></CardContent></Card>;
}
