import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useCourierDetail,
  useUpdateCourier,
  useActivateCourier,
  useDeactivateCourier,
  useResetCourierAccess,
} from "@/store/couriers/hooks/useCouriers";
import { useAuth } from "@/auth/useAuth";
import type { CourierHistoryEntry } from "@/store/couriers/courier.types";
import { COURIER_VEHICLE_LABEL, formatRouteDistance, formatRouteDuration } from "@/store/couriers/courier.formatters";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Ban,
  Bike,
  Calendar,
  Car,
  Check,
  CheckCircle,
  ChevronLeft,
  Copy,
  History,
  Lock,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ErrorState } from "@/components/feedback/ErrorState";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/loja/entregadores/$courierId")({ component: CourierDetailPage });

type EditData = {
  fullName: string;
  phone: string;
  vehicle: "" | "moto" | "carro";
  canAcceptDeliveries: boolean;
};

function humanize(value: string) {
  const labels: Record<string, string> = {
    created: "Cadastro criado",
    updated: "Cadastro atualizado",
    update: "Cadastro atualizado",
    activated: "Conta reativada",
    deactivated: "Conta inativada",
    reset_access: "Senha redefinida",
    password_reset: "Senha redefinida",
    assigned: "Entrega atribuída",
    unassigned: "Entrega removida",
    online: "Ficou online",
    offline: "Ficou offline",
  };
  return labels[value] ?? value.replace(/_/g, " ").replace(/^./, (char) => char.toUpperCase());
}

function CourierDetailPage() {
  const { courierId } = Route.useParams();
  const { authContext } = useAuth();
  const storeId = authContext?.store_ids?.[0] ?? null;
  const { data: courier, isLoading, isError, refetch } = useCourierDetail(storeId, courierId);
  const updateCourier = useUpdateCourier();
  const activateCourier = useActivateCourier();
  const deactivateCourier = useDeactivateCourier();
  const resetAccess = useResetCourierAccess();

  const [editData, setEditData] = useState<EditData>({ fullName: "", phone: "", vehicle: "", canAcceptDeliveries: false });
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!courier) return;
    setEditData({
      fullName: courier.displayName,
      phone: courier.phone || "",
      vehicle: courier.vehicle === "nao_informado" ? "" : courier.vehicle,
      canAcceptDeliveries: courier.canAcceptDeliveries,
    });
  }, [courier]);

  if (isLoading) {
    return <main className="container mx-auto max-w-4xl space-y-6 px-4 py-8"><Skeleton className="h-8 w-48" /><div className="grid gap-6 md:grid-cols-3"><Skeleton className="h-64 md:col-span-2" /><Skeleton className="h-64" /></div></main>;
  }

  if (isError || !courier) {
    return <main className="container mx-auto max-w-4xl px-4 py-8"><ErrorState title="Entregador não encontrado" description="O perfil pode ter sido removido ou você não tem acesso a ele." onRetry={() => refetch()} /></main>;
  }

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    const vehicle = editData.vehicle;
    if (!vehicle) {
      toast.error("Escolha Moto ou Carro antes de salvar.");
      return;
    }
    await updateCourier.mutateAsync({
      storeId,
      courierId,
      fullName: editData.fullName,
      phone: editData.phone,
      vehicle,
      canAcceptDeliveries: editData.canAcceptDeliveries,
      expectedVersion: courier.version,
    });
  };

  const handleResetAccess = async () => {
    if (!confirm("Isso invalidará a senha atual e gerará uma nova temporária. Continuar?")) return;
    try {
      const result = await resetAccess.mutateAsync({ data: { courier_id: courierId } });
      setResetResult(result.temporary_password);
    } catch {
      // tratado pelo hook
    }
  };

  const copyPassword = () => {
    if (!resetResult) return;
    navigator.clipboard.writeText(resetResult);
    setCopied(true);
    toast.success("Senha copiada!");
    setTimeout(() => setCopied(false), 2000);
  };

  const route = courier.currentAssignment?.route ?? null;

  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2"><Link to="/app/loja/entregadores"><ChevronLeft className="mr-1 h-4 w-4" /> Voltar</Link></Button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-black tracking-tight">{courier.displayName}</h1>
            <Badge variant={courier.isActive ? "success" : "secondary"}>{courier.isActive ? "Ativo" : "Inativo"}</Badge>
            <Badge variant={courier.vehicle === "nao_informado" ? "destructive" : "outline"}>{COURIER_VEHICLE_LABEL[courier.vehicle]}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Usuário de acesso: <span className="font-medium text-foreground">{courier.loginIdentifier}</span></p>
        </div>

        <div className="flex items-center gap-2">
          {courier.isActive ? (
            <Button variant="outline" className="border-destructive/20 text-destructive hover:bg-destructive/10" onClick={() => deactivateCourier.mutate({ storeId, courierId, expectedVersion: courier.version })} disabled={deactivateCourier.isPending}><Ban className="mr-2 h-4 w-4" /> Inativar conta</Button>
          ) : (
            <Button variant="brand" onClick={() => activateCourier.mutate({ storeId, courierId, expectedVersion: courier.version })} disabled={activateCourier.isPending}><CheckCircle className="mr-2 h-4 w-4" /> Reativar conta</Button>
          )}
        </div>
      </div>

      {courier.vehicle === "nao_informado" ? (
        <div className="mb-6 flex gap-3 rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm text-warning-foreground">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <div><p className="font-semibold">Escolha o veículo antes de novas entregas</p><p className="mt-1 opacity-90">Selecione Moto ou Carro abaixo e salve. Até lá, este entregador não poderá receber novas atribuições.</p></div>
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          <Card>
            <CardHeader><CardTitle className="text-lg">Perfil do entregador</CardTitle><CardDescription>Dados, veículo e disponibilidade para novas entregas.</CardDescription></CardHeader>
            <CardContent>
              <form id="update-form" onSubmit={handleUpdate} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="fullName">Nome completo</Label><Input id="fullName" value={editData.fullName} onChange={(e) => setEditData((current) => ({ ...current, fullName: e.target.value }))} /></div>
                  <div className="space-y-2"><Label htmlFor="phone">Telefone</Label><Input id="phone" value={editData.phone} onChange={(e) => setEditData((current) => ({ ...current, phone: e.target.value }))} /></div>
                </div>

                <div className="space-y-2">
                  <Label>Veículo</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" aria-pressed={editData.vehicle === "moto"} onClick={() => setEditData((current) => ({ ...current, vehicle: "moto" }))} className={cn("flex min-h-16 items-center gap-3 rounded-xl border p-3 text-left", editData.vehicle === "moto" ? "border-brand bg-brand-soft" : "hover:bg-muted/40")}><Bike className="h-5 w-5" /> <span className="font-semibold">Moto</span></button>
                    <button type="button" aria-pressed={editData.vehicle === "carro"} onClick={() => setEditData((current) => ({ ...current, vehicle: "carro" }))} className={cn("flex min-h-16 items-center gap-3 rounded-xl border p-3 text-left", editData.vehicle === "carro" ? "border-brand bg-brand-soft" : "hover:bg-muted/40")}><Car className="h-5 w-5" /> <span className="font-semibold">Carro</span></button>
                  </div>
                  <p className="text-xs text-muted-foreground">Se o veículo mudar, a próxima estimativa de entrega será recalculada.</p>
                </div>

                <Separator className="my-2" />
                <div className="flex items-center justify-between gap-4 py-2"><div className="space-y-0.5"><Label className="text-base">Disponível para entregas</Label><p className="text-sm text-muted-foreground">Permite selecionar este entregador em novos pedidos.</p></div><Switch checked={editData.canAcceptDeliveries} onCheckedChange={(value) => setEditData((current) => ({ ...current, canAcceptDeliveries: value }))} /></div>
              </form>
            </CardContent>
            <CardFooter className="border-t bg-muted/20 px-6 py-4"><Button form="update-form" variant="brand" disabled={updateCourier.isPending || !editData.vehicle}>{updateCourier.isPending ? "Salvando..." : "Salvar alterações"}</Button></CardFooter>
          </Card>

          <Card>
            <CardHeader><div className="flex items-center gap-2"><History className="h-5 w-5 text-muted-foreground" /><CardTitle className="text-lg">Histórico recente</CardTitle></div></CardHeader>
            <CardContent className="p-0">
              {courier.history.length === 0 ? <div className="p-8 text-center italic text-muted-foreground">Nenhuma atividade registrada ainda.</div> : (
                <div className="divide-y border-t">
                  {courier.history.map((entry: CourierHistoryEntry, index: number) => (
                    <div key={index} className="flex items-start justify-between gap-4 p-4 text-sm"><div className="font-medium">{humanize(entry.action)}</div><div className="shrink-0 text-xs text-muted-foreground">{new Date(entry.occurredAt).toLocaleString("pt-BR")}</div></div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Status atual</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3"><div className={cn("h-3 w-3 rounded-full", courier.presenceStatus === "online" ? "bg-success" : "bg-muted-foreground/30")} /><span className="text-lg font-semibold">{courier.presenceStatus === "online" ? "Online" : "Offline"}</span></div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-3"><span className="flex items-center gap-1.5 text-muted-foreground"><Activity className="h-3.5 w-3.5" /> Última atividade</span><span>{courier.lastSeenAt ? new Date(courier.lastSeenAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "Nunca"}</span></div>
                <div className="flex justify-between gap-3"><span className="flex items-center gap-1.5 text-muted-foreground"><Calendar className="h-3.5 w-3.5" /> Cadastrado em</span><span>{new Date(courier.createdAt).toLocaleDateString("pt-BR")}</span></div>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label className="text-xs uppercase opacity-60">Entrega atual</Label>
                {courier.currentAssignment ? (
                  <div className="rounded-lg border border-brand/20 bg-brand/5 p-3">
                    <div className="mb-1 flex items-center justify-between gap-2"><span className="font-bold text-brand">Pedido #{courier.currentAssignment.orderNumber}</span><Badge variant="brand" className="text-[10px]">{humanize(courier.currentAssignment.deliveryStatus)}</Badge></div>
                    {route ? <p className="mb-2 text-xs text-muted-foreground">{formatRouteDistance(route.distanceMeters)} · {formatRouteDuration(route.durationSeconds)}</p> : null}
                    <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs"><Link to="/app/loja/pedidos">Ver pedido</Link></Button>
                  </div>
                ) : <p className="text-sm italic text-muted-foreground">Nenhuma entrega em curso.</p>}
              </div>
            </CardContent>
          </Card>

          <Card className="border-warning/30 bg-warning-soft/40">
            <CardHeader><div className="flex items-center gap-2 text-warning-foreground"><Lock className="h-4 w-4" /><CardTitle className="text-sm font-bold uppercase tracking-wider">Acesso</CardTitle></div></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">Acesso habilitado</span>{courier.loginEnabled ? <span className="flex items-center gap-1 font-medium text-success"><ShieldCheck className="h-3 w-3" /> Sim</span> : <span className="flex items-center gap-1 text-destructive"><ShieldAlert className="h-3 w-3" /> Não</span>}</div>
                <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">Precisa trocar a senha</span><span>{courier.requiresPasswordChange ? "Sim" : "Não"}</span></div>
              </div>
              {resetResult ? (
                <div className="rounded border border-amber-300 bg-amber-100 p-3 dark:border-amber-800 dark:bg-amber-900/50">
                  <Label className="text-[10px] font-bold uppercase text-warning-foreground">Nova senha temporária</Label>
                  <div className="mt-1 flex items-center gap-2"><code className="flex-1 select-all rounded bg-white p-1.5 text-center font-mono text-sm font-bold dark:bg-black/50">{resetResult}</code><Button size="icon" variant="ghost" className="h-8 w-8 text-warning-foreground" onClick={copyPassword}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button></div>
                  <p className="mt-2 text-[10px] leading-tight text-warning-foreground">Exibida apenas uma vez. O entregador deverá trocá-la ao entrar.</p>
                </div>
              ) : <Button variant="outline" size="sm" className="w-full text-xs" onClick={handleResetAccess} disabled={resetAccess.isPending}>Redefinir senha de acesso</Button>}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
