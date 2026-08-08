import { createFileRoute } from "@tanstack/react-router";
import {
  Users,
  Store,
  Activity,
  ShieldAlert,
  Search,
  Filter,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { useState } from "react";
import {
  usePlatformHealth,
  usePlatformStores,
  useAdminActions,
} from "@/store/platform/platform-admin.queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const [search, setSearch] = useState("");
  const { data: health, isLoading: healthLoading } = usePlatformHealth();
  const { data: stores, isLoading: storesLoading } = usePlatformStores({ search });
  const { suspend, reactivate } = useAdminActions();

  const [suspendingStore, setSuspendingStore] = useState<{ id: string; name: string } | null>(null);
  const [suspendReason, setSuspendReason] = useState("");

  const handleSuspend = async () => {
    if (!suspendingStore || !suspendReason) return;

    try {
      await suspend.mutateAsync({ storeId: suspendingStore.id, reason: suspendReason });
      toast.success(`Loja ${suspendingStore.name} suspensa com sucesso.`);
      setSuspendingStore(null);
      setSuspendReason("");
    } catch (error) {
      toast.error("Erro ao suspender loja.");
    }
  };

  const handleReactivate = async (id: string, name: string) => {
    try {
      await reactivate.mutateAsync({ storeId: id });
      toast.success(`Loja ${name} reativada com sucesso.`);
    } catch (error) {
      toast.error("Erro ao reativar loja.");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ativa":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20">
            Ativa
          </Badge>
        );
      case "suspensa_manual":
        return (
          <Badge variant="destructive" className="bg-red-500/10 text-red-500 border-red-500/20">
            Suspensa
          </Badge>
        );
      case "em_implantacao":
        return <Badge variant="secondary">Implantação</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <main className="container mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Painel Administrativo</h1>
        <p className="text-muted-foreground mt-1">Gestão global do SaaS e saúde da plataforma.</p>
      </div>

      {/* Indicadores de Saúde */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <HealthCard
          title="Total de Lojas"
          value={health?.totalStores}
          subValue={`${health?.activeStores} ativas`}
          icon={<Store className="h-4 w-4 text-muted-foreground" />}
          loading={healthLoading}
        />
        <HealthCard
          title="Pedidos (24h)"
          value={health?.ordersLast24h}
          icon={<Activity className="h-4 w-4 text-muted-foreground" />}
          loading={healthLoading}
        />
        <HealthCard
          title="Entregadores Online"
          value={health?.activeCouriers}
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
          loading={healthLoading}
        />
        <HealthCard
          title="Lojas Suspensas"
          value={health?.suspendedStores}
          icon={<ShieldAlert className="h-4 w-4 text-red-500" />}
          loading={healthLoading}
          colorClass={health?.suspendedStores && health.suspendedStores > 0 ? "text-red-500" : ""}
        />
      </div>

      {/* Diretório de Lojas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
          <div className="space-y-1">
            <CardTitle>Diretório de Lojas</CardTitle>
            <CardDescription>
              Gerencie o ciclo de vida e status das lojas na plataforma.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou slug..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loja</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Volume (Pedidos)</TableHead>
                  <TableHead>Criada em</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {storesLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Skeleton className="h-5 w-32" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-20" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-16" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-8 w-8 rounded-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  : stores?.items.map((store) => (
                      <TableRow key={store.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{store.name}</span>
                            <span className="text-xs text-muted-foreground">/{store.slug}</span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(store.status)}</TableCell>
                        <TableCell>{store.total_orders}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(store.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Ações</DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() =>
                                  toast.info("Funcionalidade de logs na próxima etapa")
                                }
                              >
                                <FileText className="mr-2 h-4 w-4" /> Logs da Loja
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {store.status === "ativa" ? (
                                <DropdownMenuItem
                                  className="text-red-500 focus:text-red-500"
                                  onClick={() =>
                                    setSuspendingStore({ id: store.id, name: store.name })
                                  }
                                >
                                  <PauseCircle className="mr-2 h-4 w-4" /> Suspender Loja
                                </DropdownMenuItem>
                              ) : store.status === "suspensa_manual" ? (
                                <DropdownMenuItem
                                  className="text-emerald-500 focus:text-emerald-500"
                                  onClick={() => handleReactivate(store.id, store.name)}
                                >
                                  <PlayCircle className="mr-2 h-4 w-4" /> Reativar Loja
                                </DropdownMenuItem>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                {!storesLoading && stores?.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      Nenhuma loja encontrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Diálogo de Suspensão */}
      <Dialog open={!!suspendingStore} onOpenChange={() => setSuspendingStore(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-5 w-5" />
              Suspender Loja: {suspendingStore?.name}
            </DialogTitle>
            <DialogDescription>
              A suspensão impedirá novos pedidos, mas manterá todos os dados e o acompanhamento de
              pedidos ativos.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Motivo da Suspensão</label>
              <Input
                placeholder="Ex: Pendência administrativa, violação de termos..."
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendingStore(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleSuspend}
              disabled={!suspendReason || suspend.isPending}
            >
              {suspend.isPending ? "Suspendendo..." : "Confirmar Suspensão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function HealthCard({
  title,
  value,
  subValue,
  icon,
  loading,
  colorClass = "",
}: {
  title: string;
  value?: number;
  subValue?: string;
  icon: React.ReactNode;
  loading: boolean;
  colorClass?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className={`text-2xl font-bold ${colorClass}`}>{value ?? 0}</div>
        )}
        {subValue && !loading && <p className="text-xs text-muted-foreground">{subValue}</p>}
      </CardContent>
    </Card>
  );
}
