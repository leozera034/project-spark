import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/auth/useAuth";
import { useCourierList, useCourierCounts } from "@/store/couriers/hooks/useCouriers";
import type { CourierListItem } from "@/store/couriers/courier.types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Search, 
  Filter, 
  ChevronRight, 
  UserCircle,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription 
} from "@/components/ui/card";
import { derivePresence, PRESENCE_LABEL, availabilityLabel } from "@/store/couriers/courier.formatters";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/app/loja/entregadores")({
  component: CourierListPage,
});

function CourierListPage() {
  const { authContext } = useAuth();
  const storeId = authContext?.store_ids?.[0] ?? null;
  const [search, setSearch] = useState("");
  
  const { data: counts } = useCourierCounts(storeId);
  const { data: payload, isLoading } = useCourierList(storeId);

  const filteredCouriers = payload?.couriers.filter((c: CourierListItem) => 
    c.displayName.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Entregadores</h1>
          <p className="text-muted-foreground">
            Gerencie sua equipe de entrega e acompanhe a disponibilidade em tempo real.
          </p>
        </div>
        <Button asChild variant="brand">
          <Link to="/app/loja/entregadores/novo">
            <Plus className="mr-2 h-4 w-4" />
            Novo Entregador
          </Link>
        </Button>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Ativos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{counts?.active ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Online
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">
              {counts?.online ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Ocupados
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {counts?.busy ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Aguardando
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-brand">
              {counts?.unassignedDeliveries ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nome..." 
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" size="icon">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 w-full animate-pulse rounded-xl bg-surface/50 border border-border" />
          ))
        ) : filteredCouriers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
            <UserCircle className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <h3 className="text-lg font-medium">Nenhum entregador encontrado</h3>
            <p className="text-sm text-muted-foreground">Tente mudar sua busca ou adicione um novo.</p>
          </div>
        ) : (
          filteredCouriers.map((courier: CourierListItem) => (
            <Link
              key={courier.courierId}
              to="/app/loja/entregadores/$courierId"
              params={{ courierId: courier.courierId }}
              className="hover-lift flex items-center justify-between rounded-xl border border-border bg-surface p-4 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <UserCircle className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface ${
                    derivePresence(courier.presenceStatus === 'online', courier.lastSeenAt, payload?.serverNow) === 'online' ? 'bg-teal-500' : 
                    derivePresence(courier.presenceStatus === 'online', courier.lastSeenAt, payload?.serverNow) === 'sem_sinal' ? 'bg-amber-500 animate-pulse' : 'bg-muted-foreground/30'
                  }`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{courier.displayName}</span>
                    {!courier.isActive && (
                      <Badge variant="outline" className="text-[10px] uppercase">Inativo</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {courier.lastSeenAt 
                        ? `Ativo ${formatDistanceToNow(new Date(courier.lastSeenAt), { addSuffix: true, locale: ptBR })}`
                        : 'Nunca visto'}
                    </span>
                    {courier.currentAssignment && (
                      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <AlertCircle className="h-3 w-3" />
                        Em entrega #{courier.currentAssignment.orderNumber}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="hidden text-right sm:block">
                  <div className="text-sm font-medium">
                    <Badge variant={availabilityLabel(courier) === "Disponível" ? "brand" : "secondary"}>
                      {availabilityLabel(courier)}
                    </Badge>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
