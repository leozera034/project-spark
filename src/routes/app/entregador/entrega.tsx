import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useAuth } from "@/auth/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Bike,
  MapPin,
  Clock,
  CheckCircle2,
  Phone,
  Navigation,
  ChevronLeft,
  AlertTriangle,
  Package,
  CreditCard,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useMyCourierOperationalContext,
  useConfirmArrivalAtStore,
  useConfirmOrderPickup,
  useStartDelivery,
  useCompleteDelivery,
  useReportDeliveryOccurrence,
} from "@/store/couriers/hooks/useCouriers";
import { DELIVERY_STATUS_LABEL, OCCURRENCE_LABEL } from "@/store/couriers/courier.formatters";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/feedback/ErrorState";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

export const Route = createFileRoute("/app/entregador/entrega")({
  component: DeliveryDetail,
});

function DeliveryDetail() {
  const navigate = useNavigate();
  const { data: context, isLoading, isError, refetch } = useMyCourierOperationalContext();

  const arriveAtStore = useConfirmArrivalAtStore();
  const pickupOrder = useConfirmOrderPickup();
  const startDelivery = useStartDelivery();
  const completeDelivery = useCompleteDelivery();
  const reportOccurrence = useReportDeliveryOccurrence();

  const [occurrenceCode, setOccurrenceCode] = useState("other");
  const [occurrenceNote, setOccurrenceNote] = useState("");
  const [isOccurrenceOpen, setIsOccurrenceOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 space-y-4">
        <Skeleton className="h-12 w-32" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const delivery = context?.activeDelivery;

  if (isError || !delivery) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4">
        <ErrorState
          title="Nenhuma entrega ativa"
          description="Você não possui uma entrega em curso neste momento."
          onRetry={() => navigate({ to: "/app/entregador" })}
        />
      </div>
    );
  }

  const handleAction = async (mutation: any) => {
    try {
      await mutation.mutateAsync({
        deliveryId: delivery.deliveryId,
        expectedVersion: delivery.version,
        idempotencyKey: crypto.randomUUID(),
      });
      // O hook invalida a query, o que recarrega os dados
    } catch (e) {}
  };

  const handleReportOccurrence = async () => {
    try {
      await reportOccurrence.mutateAsync({
        deliveryId: delivery.deliveryId,
        code: occurrenceCode,
        note: occurrenceNote,
        expectedVersion: delivery.version,
        idempotencyKey: crypto.randomUUID(),
      });
      setIsOccurrenceOpen(false);
      setOccurrenceNote("");
    } catch (e) {}
  };

  const status = delivery.status;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
      {/* Top Bar Fixa */}
      <header className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center gap-4 shadow-sm">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/app/entregador">
            <ChevronLeft className="h-6 w-6" />
          </Link>
        </Button>
        <div>
          <h1 className="font-black text-lg text-brand">Entrega #{delivery.orderNumber}</h1>
          <Badge
            variant="outline"
            className="text-[10px] font-bold uppercase py-0 h-4 bg-brand/5 border-brand/20 text-brand"
          >
            {DELIVERY_STATUS_LABEL[status] || status}
          </Badge>
        </div>
      </header>

      <main className="p-4 space-y-4 max-w-lg mx-auto">
        {/* Card de Coleta (Loja) */}
        <Card
          className={cn(
            "border-2",
            ["atribuida", "aceita", "chegou_na_loja"].includes(status as string)
              ? "border-brand shadow-md"
              : "opacity-60 border-slate-200",
          )}
        >
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5" /> Ponto de Coleta
            </CardTitle>
            {["coletada", "em_rota", "concluida"].includes(status) && (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            )}
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            <div>
              <p className="font-black text-lg leading-tight">{context?.storeName}</p>
              <p className="text-sm text-muted-foreground mt-1">{context?.storePublicAddress}</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="h-9 px-3 gap-2 flex-1 font-bold text-xs"
                asChild
              >
                <a href={`tel:${context?.storePhone}`}>
                  <Phone className="h-3.5 w-3.5" /> LIGAR
                </a>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="h-9 px-3 gap-2 flex-1 font-bold text-xs"
                asChild
              >
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(context?.storePublicAddress)}`}
                  target="_blank"
                >
                  <Navigation className="h-3.5 w-3.5" /> MAPA
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Card de Entrega (Cliente) */}
        <Card
          className={cn(
            "border-2",
            ["em_rota"].includes(status as string) ? "border-brand shadow-md" : "border-slate-200",
            ["atribuida", "aceita", "chegou_na_loja"].includes(status as string) && "opacity-40",
          )}
        >
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Bike className="h-3.5 w-3.5" /> Destino Final
            </CardTitle>
            {status === "concluida" && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-4">
            {delivery.customer && (
              <>
                <div>
                  <p className="font-black text-lg leading-tight">{delivery.customer.firstName}</p>
                  <div className="mt-2 space-y-1">
                    <p className="text-sm font-bold leading-tight">
                      {delivery.customer.street}, {delivery.customer.number}
                    </p>
                    {delivery.customer.complement && (
                      <p className="text-sm text-muted-foreground italic">
                        {delivery.customer.complement}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {delivery.customer.neighborhood}
                    </p>
                    {delivery.customer.reference && (
                      <div className="flex items-start gap-1.5 mt-2 bg-amber-50 dark:bg-amber-950/20 p-2 rounded text-xs">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <span className="text-amber-800 dark:text-amber-400 font-medium">
                          {delivery.customer.reference}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-9 px-3 gap-2 flex-1 font-bold text-xs"
                    asChild
                  >
                    <a href={`tel:${delivery.customer.phone}`}>
                      <Phone className="h-3.5 w-3.5" /> LIGAR
                    </a>
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-9 px-3 gap-2 flex-1 font-bold text-xs"
                    asChild
                  >
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${delivery.customer.street}, ${delivery.customer.number}, ${delivery.customer.neighborhood}`)}`}
                      target="_blank"
                    >
                      <Navigation className="h-3.5 w-3.5" /> MAPA
                    </a>
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Card de Pagamento e Itens */}
        <Card className="border-slate-200">
          <CardContent className="p-4 grid grid-cols-2 gap-4 divide-x">
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                <CreditCard className="h-3 w-3" /> Pagamento
              </p>
              <p className="text-sm font-black">{delivery.payment?.method || "Não informado"}</p>
              <p className="text-[10px] font-bold text-emerald-600">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                  delivery.payment?.orderAmount || 0,
                )}
              </p>
            </div>
            <div className="pl-4 space-y-1">
              <p className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                <Package className="h-3 w-3" /> Troco
              </p>
              <p className="text-sm font-medium">
                {delivery.payment?.needsChange
                  ? `Para ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(delivery.payment.changeFor || 0)}`
                  : "Não precisa"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Botão de Ocorrência */}
        <Dialog open={isOccurrenceOpen} onOpenChange={setIsOccurrenceOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              className="w-full h-12 text-destructive font-bold gap-2 hover:bg-destructive/5"
            >
              <AlertTriangle className="h-4 w-4" /> INFORMAR PROBLEMA
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[90vw] rounded-xl">
            <DialogHeader>
              <DialogTitle>Relatar Ocorrência</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <RadioGroup value={occurrenceCode} onValueChange={setOccurrenceCode}>
                {Object.entries(OCCURRENCE_LABEL).map(([code, label]) => (
                  <div key={code} className="flex items-center space-x-2 border p-3 rounded-lg">
                    <RadioGroupItem value={code} id={code} />
                    <Label htmlFor={code} className="flex-1 font-bold text-sm cursor-pointer">
                      {label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              <div className="space-y-2">
                <Label htmlFor="note" className="text-xs font-bold uppercase opacity-60">
                  Detalhes (Opcional)
                </Label>
                <Textarea
                  id="note"
                  placeholder="Descreva o que aconteceu..."
                  value={occurrenceNote}
                  onChange={(e) => setOccurrenceNote(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsOccurrenceOpen(false)}>
                CANCELAR
              </Button>
              <Button
                variant="brand"
                onClick={handleReportOccurrence}
                disabled={reportOccurrence.isPending}
              >
                ENVIAR RELATO
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>

      {/* Action Bar Flutuante Fixa na Base */}
      <footer className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t shadow-2xl z-20">
        <div className="max-w-lg mx-auto">
          {status === "aceita" && (
            <Button
              className="w-full h-16 text-xl font-black shadow-lg animate-in fade-in zoom-in"
              variant="brand"
              onClick={() => handleAction(arriveAtStore)}
              disabled={arriveAtStore.isPending}
            >
              <MapPin className="mr-2 h-6 w-6" /> CHEGUEI NA LOJA
            </Button>
          )}

          {(status as string) === "chegou_na_loja" && (
            <Button
              className="w-full h-16 text-xl font-black shadow-lg animate-in fade-in zoom-in bg-emerald-600 hover:bg-emerald-700"
              onClick={() => handleAction(pickupOrder)}
              disabled={pickupOrder.isPending}
            >
              <Package className="mr-2 h-6 w-6" /> COLETEI O PEDIDO
            </Button>
          )}

          {status === "coletada" && (
            <Button
              className="w-full h-16 text-xl font-black shadow-lg animate-in fade-in zoom-in"
              variant="brand"
              onClick={() => handleAction(startDelivery)}
              disabled={startDelivery.isPending}
            >
              <Bike className="mr-2 h-6 w-6" /> INICIAR ENTREGA
            </Button>
          )}

          {status === "em_rota" && (
            <Button
              className="w-full h-16 text-xl font-black shadow-lg animate-in fade-in zoom-in bg-emerald-600 hover:bg-emerald-700"
              onClick={() => handleAction(completeDelivery)}
              disabled={completeDelivery.isPending}
            >
              <CheckCircle2 className="mr-2 h-6 w-6" /> ENTREGA CONCLUÍDA
            </Button>
          )}

          {status === "concluida" && (
            <Button className="w-full h-14 text-lg font-bold shadow-md" variant="outline" asChild>
              <Link to="/app/entregador">VOLTAR AO INÍCIO</Link>
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
