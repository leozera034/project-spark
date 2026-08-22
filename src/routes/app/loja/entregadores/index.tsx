import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useCourierList, useCourierCounts } from "@/store/couriers/hooks/useCouriers";
import type { CourierListItem } from "@/store/couriers/courier.types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, ArrowLeft, ChevronRight, Clock, Plus, Search, TriangleAlert, UserCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  COURIER_VEHICLE_LABEL,
  availabilityLabel,
  derivePresence,
} from "@/store/couriers/courier.formatters";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useStoreScope } from "@/store-scope/StoreScopeProvider";

export const Route = createFileRoute("/app/loja/entregadores/")({
  component: CourierListPage,
});

function CourierListPage() {
  const { storeId, selectedStore } = useStoreScope();
  const [search, setSearch] = useState("");
  const { data: counts } = useCourierCounts(storeId);
  const { data: payload, isLoading } = useCourierList(storeId);

  const filteredCouriers = payload?.couriers.filter((c: CourierListItem) =>
    c.displayName.toLowerCase().includes(search.toLowerCase()),
  ) || [];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-9">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3">
          <Link to="/app/loja/entregas"><ArrowLeft className="size-4" /> Voltar para entregas</Link>
        </Button>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-black uppercase tracking-[.14em] text-brand">Entregas</p>
              {selectedStore ? <Badge variant="outline">{selectedStore.name}</Badge> : null}
            </div>
            <h1 className="mt-1 font-display text-3xl font-black tracking-tight">Entregadores</h1>
            <p className="mt-2 text-sm text-muted-foreground">Gerencie equipe, veículo e disponibilidade operacional.</p>
          </div>
          <Button asChild>
            <Link to="/app/loja/entregadores/novo"><Plus className="size-4" /> Novo entregador</Link>
          </Button>
        </div>
      </div>

      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Resumo dos entregadores">
        <Metric title="Ativos" value={counts?.active ?? 0} />
        <Metric title="Online" value={counts?.online ?? 0} className="text-success" />
        <Metric title="Em entrega" value={counts?.busy ?? 0} className="text-warning" />
        <Metric title="Aguardando" value={counts?.unassignedDeliveries ?? 0} className="text-brand" />
      </section>

      <div className="mb-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar entregador por nome" className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 w-full animate-pulse rounded-xl border border-border bg-surface/50" />)
        ) : filteredCouriers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-12 text-center">
            <UserCircle className="mb-4 size-12 text-muted-foreground/30" />
            <h3 className="text-lg font-bold">Nenhum entregador encontrado</h3>
            <p className="text-sm text-muted-foreground">Tente outra busca ou adicione uma pessoa à equipe.</p>
          </div>
        ) : (
          filteredCouriers.map((courier: CourierListItem) => {
            const presence = derivePresence(courier.presenceStatus === "online", courier.lastSeenAt, payload?.serverNow);
            const availability = availabilityLabel(courier);
            return (
              <Link
                key={courier.courierId}
                to="/app/loja/entregadores/$courierId"
                params={{ courierId: courier.courierId }}
                className="group flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-brand/25 hover:bg-brand-soft/20"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <div className="relative shrink-0">
                    <div className="flex size-12 items-center justify-center rounded-full bg-muted"><UserCircle className="size-8 text-muted-foreground" /></div>
                    <div className={`absolute bottom-0 right-0 size-3 rounded-full border-2 border-card ${presence === "online" ? "bg-success" : presence === "sem_sinal" ? "bg-warning animate-pulse motion-reduce:animate-none" : "bg-muted-foreground/30"}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-bold">{courier.displayName}</span>
                      {!courier.isActive ? <Badge variant="outline" className="text-[10px] uppercase">Inativo</Badge> : null}
                      <Badge variant={courier.vehicle === "nao_informado" ? "destructive" : "secondary"} className="text-[10px]">
                        {COURIER_VEHICLE_LABEL[courier.vehicle]}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="size-3" />{courier.lastSeenAt ? `Ativo ${formatDistanceToNow(new Date(courier.lastSeenAt), { addSuffix: true, locale: ptBR })}` : "Sem atividade registrada"}</span>
                      {courier.currentAssignment ? <span className="flex items-center gap-1 text-warning"><AlertCircle className="size-3" /> Em entrega #{courier.currentAssignment.orderNumber}</span> : null}
                      {courier.vehicle === "nao_informado" ? <span className="flex items-center gap-1 text-destructive"><TriangleAlert className="size-3" /> Defina o veículo</span> : null}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <div className="hidden text-right sm:block"><Badge variant={availability === "Disponível" ? "brand" : "secondary"}>{availability}</Badge></div>
                  <ChevronRight className="size-5 text-muted-foreground transition group-hover:translate-x-0.5" />
                </div>
              </Link>
            );
          })
        )}
      </div>
    </main>
  );
}

function Metric({ title, value, className = "" }: { title: string; value: number; className?: string }) {
  return (
    <Card>
      <CardHeader className="p-4 pb-2"><CardTitle className="text-xs font-black uppercase tracking-[.1em] text-muted-foreground">{title}</CardTitle></CardHeader>
      <CardContent className="p-4 pt-0"><div className={`font-display text-3xl font-black tabular-nums ${className}`}>{value}</div></CardContent>
    </Card>
  );
}
