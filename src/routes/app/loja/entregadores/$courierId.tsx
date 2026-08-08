import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  useCourierDetail,
  useUpdateCourier,
  useActivateCourier,
  useDeactivateCourier,
  useResetCourierAccess,
} from "@/store/couriers/hooks/useCouriers";
import { useAuth } from "@/auth/useAuth";
import type { CourierHistoryEntry } from "@/store/couriers/courier.types";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  User,
  Smartphone,
  Calendar,
  Activity,
  ShieldCheck,
  ShieldAlert,
  History,
  Lock,
  Ban,
  CheckCircle,
  Copy,
  Check,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
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

export const Route = createFileRoute("/app/loja/entregadores/$courierId")({
  component: CourierDetailPage,
});

function CourierDetailPage() {
  const { courierId } = Route.useParams();
  const { authContext } = useAuth();
  const storeId = authContext?.store_ids?.[0] ?? null;

  const { data: courier, isLoading, isError, refetch } = useCourierDetail(storeId, courierId);

  const updateCourier = useUpdateCourier();
  const activateCourier = useActivateCourier();
  const deactivateCourier = useDeactivateCourier();
  const resetAccess = useResetCourierAccess();

  const [editData, setEditData] = useState({
    fullName: "",
    phone: "",
    canAcceptDeliveries: false,
  });

  const [resetResult, setResetResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (courier) {
      setEditData({
        fullName: courier.displayName,
        phone: courier.phone || "",
        canAcceptDeliveries: courier.canAcceptDeliveries,
      });
    }
  }, [courier]);

  if (isLoading) {
    return (
      <main className="container mx-auto max-w-4xl px-4 py-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-64 md:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </main>
    );
  }

  if (isError || !courier) {
    return (
      <main className="container mx-auto max-w-4xl px-4 py-8">
        <ErrorState
          title="Entregador não encontrado"
          description="O perfil pode ter sido removido ou você não tem acesso a ele."
          onRetry={() => refetch()}
        />
      </main>
    );
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateCourier.mutateAsync({
      storeId,
      courierId,
      fullName: editData.fullName,
      phone: editData.phone,
      canAcceptDeliveries: editData.canAcceptDeliveries,
      expectedVersion: courier.version,
    });
  };

  const handleResetAccess = async () => {
    if (!confirm("Isso invalidará a senha atual e gerará uma nova temporária. Continuar?")) return;
    try {
      const res = await resetAccess.mutateAsync({
        data: {
          courier_id: courierId,
        },
      });
      setResetResult(res.temporary_password);
    } catch (err) {}
  };

  const copyPassword = () => {
    if (resetResult) {
      navigator.clipboard.writeText(resetResult);
      setCopied(true);
      toast.success("Senha copiada!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
            <Link to="/app/loja/entregadores">
              <ChevronLeft className="mr-1 h-4 w-4" />
              Voltar
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{courier.displayName}</h1>
            <Badge variant={courier.isActive ? "brand" : "secondary"}>
              {courier.isActive ? "Ativo" : "Inativo"}
            </Badge>
          </div>
          <p className="text-muted-foreground font-mono text-sm mt-1">
            ID: {courier.loginIdentifier}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {courier.isActive ? (
            <Button
              variant="outline"
              className="text-destructive border-destructive/20 hover:bg-destructive/10"
              onClick={() =>
                deactivateCourier.mutate({ storeId, courierId, expectedVersion: courier.version })
              }
              disabled={deactivateCourier.isPending}
            >
              <Ban className="mr-2 h-4 w-4" />
              Inativar Conta
            </Button>
          ) : (
            <Button
              variant="brand"
              onClick={() =>
                activateCourier.mutate({ storeId, courierId, expectedVersion: courier.version })
              }
              disabled={activateCourier.isPending}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Reativar Conta
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Coluna Principal: Edição */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informações do Perfil</CardTitle>
              <CardDescription>Dados básicos e disponibilidade operacional.</CardDescription>
            </CardHeader>
            <CardContent>
              <form id="update-form" onSubmit={handleUpdate} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nome Completo</Label>
                    <Input
                      id="fullName"
                      value={editData.fullName}
                      onChange={(e) => setEditData((p) => ({ ...p, fullName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      value={editData.phone}
                      onChange={(e) => setEditData((p) => ({ ...p, phone: e.target.value }))}
                    />
                  </div>
                </div>

                <Separator className="my-2" />

                <div className="flex items-center justify-between py-2">
                  <div className="space-y-0.5">
                    <Label className="text-base">Disponível para Entregas</Label>
                    <p className="text-sm text-muted-foreground">
                      Define se o entregador pode ser selecionado para novos pedidos.
                    </p>
                  </div>
                  <Switch
                    checked={editData.canAcceptDeliveries}
                    onCheckedChange={(val) =>
                      setEditData((p) => ({ ...p, canAcceptDeliveries: val }))
                    }
                  />
                </div>
              </form>
            </CardContent>
            <CardFooter className="border-t bg-muted/20 px-6 py-4">
              <Button form="update-form" variant="brand" disabled={updateCourier.isPending}>
                {updateCourier.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">Histórico Recente</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {courier.history.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground italic">
                  Nenhuma atividade registrada ainda.
                </div>
              ) : (
                <div className="divide-y border-t">
                  {courier.history.map((entry: CourierHistoryEntry, idx: number) => (
                    <div key={idx} className="flex items-start gap-4 p-4 text-sm">
                      <div className="min-w-[140px] text-muted-foreground">
                        {new Date(entry.occurredAt).toLocaleString("pt-BR")}
                      </div>
                      <div className="flex-1 font-medium">{entry.action}</div>
                      {entry.reasonCode && (
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {entry.reasonCode}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Coluna Lateral: Status e Acesso */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
                Status Atual
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "h-3 w-3 rounded-full animate-pulse",
                    courier.presenceStatus === "online"
                      ? "bg-emerald-500"
                      : "bg-muted-foreground/30",
                  )}
                />
                <span className="font-semibold text-lg capitalize">{courier.presenceStatus}</span>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5" /> Último sinal:
                  </span>
                  <span>
                    {courier.lastSeenAt
                      ? new Date(courier.lastSeenAt).toLocaleTimeString()
                      : "Nunca"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> Cadastrado em:
                  </span>
                  <span>{new Date(courier.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-xs uppercase opacity-60">Atribuição Atual</Label>
                {courier.currentAssignment ? (
                  <div className="rounded-lg border bg-brand/5 border-brand/20 p-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-brand">
                        Pedido #{courier.currentAssignment.orderNumber}
                      </span>
                      <Badge variant="brand" className="text-[10px]">
                        {courier.currentAssignment.deliveryStatus}
                      </Badge>
                    </div>
                    <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
                      <Link
                        to="/app/loja/pedidos"
                        search={{ open: courier.currentAssignment.deliveryId }}
                      >
                        Ver Entrega
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Nenhuma entrega em curso.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200 dark:border-amber-900 bg-amber-50/30 dark:bg-amber-950/10">
            <CardHeader>
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
                <Lock className="h-4 w-4" />
                <CardTitle className="text-sm font-bold uppercase tracking-wider">
                  Segurança e Acesso
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Login Habilitado:</span>
                  {courier.loginEnabled ? (
                    <span className="text-emerald-600 flex items-center gap-1 font-medium">
                      <ShieldCheck className="h-3 w-3" /> SIM
                    </span>
                  ) : (
                    <span className="text-destructive flex items-center gap-1 font-medium">
                      <ShieldAlert className="h-3 w-3" /> NÃO
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Troca de Senha Pendente:</span>
                  {courier.requiresPasswordChange ? (
                    <span className="text-amber-600 font-bold uppercase">Sim</span>
                  ) : (
                    <span>Não</span>
                  )}
                </div>
              </div>

              {resetResult ? (
                <div className="rounded border border-amber-300 bg-amber-100 p-3 dark:border-amber-800 dark:bg-amber-900/50">
                  <Label className="text-[10px] uppercase font-bold text-amber-800 dark:text-amber-200">
                    Nova Senha Temporária
                  </Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 font-mono text-sm font-bold bg-white dark:bg-black/50 p-1.5 rounded text-center select-all">
                      {resetResult}
                    </code>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-amber-800"
                      onClick={copyPassword}
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-[9px] mt-2 text-amber-700 dark:text-amber-300 leading-tight">
                    Exibida apenas uma vez. O entregador deverá trocá-la ao entrar.
                  </p>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={handleResetAccess}
                  disabled={resetAccess.isPending}
                >
                  Redefinir Senha de Acesso
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
