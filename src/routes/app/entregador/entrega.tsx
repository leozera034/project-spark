import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Bike,
  MapPin,
  CheckCircle2,
  Phone,
  Navigation,
  ChevronLeft,
  AlertTriangle,
  Package,
  CreditCard,
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
import type { UseMutationResult } from "@tanstack/react-query";

export const Route = createFileRoute("/app/entregador/entrega")({
  component: DeliveryDetail,
});

function DeliveryDetail() {
  const navigate = useNavigate();
  const {
    data: context,
    isLoading,
    isError,
  } = useMyCourierOperationalContext();

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
      <div className="min-h-dvh bg-background p-4 space-y-4">
        <Skeleton className="h-12 w-32" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const delivery = context?.activeDelivery;

  if (isError || !delivery) {
    return (
      <div className="min-h-dvh bg-background p-4">
        <ErrorState
          title="Nenhuma entrega ativa"
          description="Você não possui uma entrega em curso neste momento."
          onRetry={() => navigate({ to: "/app/entregador" })}
        />
      </div>
    );
  }

  const handleAction = async (
    mutation: UseMutationResult<unknown, unknown, { deliveryId: string; expectedVersion: number; idempotencyKey: string }>,
  ) => {
    try {
      await mutation.mutateAsync({
        deliveryId: delivery.deliveryId,
        expectedVersion: delivery.version,
        idempotencyKey: crypto.randomUUID(),
      });
      // O hook invalida a query, o que recarrega os dados
    } catch {
      // erro tratado pelo hook
    }
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
    } catch {
      // erro tratado pelo hook
    }
  };

  const status = delivery.status;

  return (
    <div className="min-h-dvh bg-background pb-28">
      <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-border bg-surface px-4 py-3 shadow-sm">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/app/entregador">
            <ChevronLeft className="h-6 w-6" />
          </Link>
        </Button>
        <div>
          <h1 className="font-display text-lg font-black text-brand">Entrega #{delivery.orderNumber}</h1>
          <Badge variant="outline" className="h-4 border-brand/30 bg-brand-soft py-0 text-[10px] font-bold uppercase text-brand">
            {DELIVERY_STATUS_LABEL[status] || status}
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">
        {/* Card de Coleta (Loja) */}
        <Card
          className={cn(
            "border-2",
            ["atribuida", "aceita", "chegou_na_loja"].includes(status as string)
              ? "border-brand shadow-md"
              : "border-border opacity-60",
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> Ponto de coleta
            </CardTitle>
            {["coletada", "em_rota", "concluida"].includes(status) && (
              <CheckCircle2 className="h-5 w-5 text-success" />
            )}
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0">
            <div>
              <p className="text-lg font-black leading-tight">{context?.storeName}</p>
              <p className="mt-1 text-sm text-muted-foreground">{context?.storePublicAddress}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" className="h-11 flex-1 gap-2 px-3 text-xs font-bold" asChild>
                <a href={`tel:${context?.storePhone}`}>
                  <Phone className="h-3.5 w-3.5" /> LIGAR
                </a>
              </Button>
              <Button variant="secondary" size="sm" className="h-11 flex-1 gap-2 px-3 text-xs font-bold" asChild>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(context?.storePublicAddress ?? "")}`}
                  target="_blank"
                  rel="noreferrer"
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
            status === "em_rota" ? "border-brand shadow-md" : "border-border",
            ["atribuida", "aceita", "chegou_na_loja"].includes(status as string) && "opacity-40",
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Bike className="h-3.5 w-3.5" /> Destino final
            </CardTitle>
            {status === "concluida" && <CheckCircle2 className="h-5 w-5 text-success" />}
          </CardHeader>
          <CardContent className="space-y-4 p-4 pt-0">
            {delivery.customer && (
              <>
                <div>
                  <p className="text-lg font-black leading-tight">{delivery.customer.firstName}</p>
                  <div className="mt-2 space-y-1">
                    <p className="text-sm font-bold leading-tight">
                      {delivery.customer.street}, {delivery.customer.number}
                    </p>
                    {delivery.customer.complement && (
                      <p className="text-sm italic text-muted-foreground">{delivery.customer.complement}</p>
                    )}
                    <p className="text-sm text-muted-foreground">{delivery.customer.neighborhood}</p>
                    {delivery.customer.reference && (
                      <div className="mt-2 flex items-start gap-1.5 rounded bg-warning-soft p-2 text-xs">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                        <span className="font-medium text-warning-foreground">{delivery.customer.reference}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" className="h-11 flex-1 gap-2 px-3 text-xs font-bold" asChild>
                    <a href={`tel:${delivery.customer.phone}`}>
                      <Phone className="h-3.5 w-3.5" /> LIGAR
                    </a>
                  </Button>
                  <Button variant="secondary" size="sm" className="h-11 flex-1 gap-2 px-3 text-xs font-bold" asChild>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${delivery.customer.street}, ${delivery.customer.number}, ${delivery.customer.neighborhood}`)}`}
                      target="_blank"
                      rel="noreferrer"
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
        <Card>
          <CardContent className="grid grid-cols-2 gap-4 divide-x divide-border p-4">
            <div className="space-y-1">
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase text-muted-foreground">
                <CreditCard className="h-3 w-3" /> Pagamento
              </p>
              <p className="text-sm font-black">{delivery.payment?.method || "Não informado"}</p>
              <p className="text-[10px] font-bold text-success">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                  delivery.payment?.orderAmount || 0,
                )}
              </p>
            </div>
            <div className="space-y-1 pl-4">
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase text-muted-foreground">
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
            <Button variant="ghost" className="h-12 w-full gap-2 font-bold text-destructive hover:bg-destructive/10">
              <AlertTriangle className="h-4 w-4" /> INFORMAR PROBLEMA
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[90vw] rounded-xl">
            <DialogHeader>
              <DialogTitle>Relatar ocorrência</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <RadioGroup value={occurrenceCode} onValueChange={setOccurrenceCode}>
                {Object.entries(OCCURRENCE_LABEL).map(([code, label]) => (
                  <div key={code} className="flex items-center space-x-2 rounded-lg border border-border p-3">
                    <RadioGroupItem value={code} id={code} />
                    <Label htmlFor={code} className="flex-1 cursor-pointer text-sm font-bold">
                      {label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              <div className="space-y-2">
                <Label htmlFor="note" className="text-xs font-bold uppercase text-muted-foreground">
                  Detalhes (opcional)
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
              <Button variant="brand" onClick={handleReportOccurrence} disabled={reportOccurrence.isPending}>
                ENVIAR RELATO
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>

      {/* Barra de ação fixa */}
      <footer
        className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-surface/90 p-4 shadow-2xl backdrop-blur-md"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto max-w-lg">
          {status === "aceita" && (
            <Button
              className="h-16 w-full animate-in fade-in zoom-in text-xl font-black shadow-lg motion-reduce:animate-none"
              variant="brand"
              onClick={() => handleAction(arriveAtStore)}
              disabled={arriveAtStore.isPending}
            >
              <MapPin className="mr-2 h-6 w-6" /> CHEGUEI NA LOJA
            </Button>
          )}

          {(status as string) === "chegou_na_loja" && (
            <Button
              className="h-16 w-full animate-in fade-in zoom-in bg-success text-xl font-black text-success-foreground shadow-lg hover:bg-success/90 motion-reduce:animate-none"
              onClick={() => handleAction(pickupOrder)}
              disabled={pickupOrder.isPending}
            >
              <Package className="mr-2 h-6 w-6" /> COLETEI O PEDIDO
            </Button>
          )}

          {status === "coletada" && (
            <Button
              className="h-16 w-full animate-in fade-in zoom-in text-xl font-black shadow-lg motion-reduce:animate-none"
              variant="brand"
              onClick={() => handleAction(startDelivery)}
              disabled={startDelivery.isPending}
            >
              <Bike className="mr-2 h-6 w-6" /> INICIAR ENTREGA
            </Button>
          )}

          {status === "em_rota" && (
            <Button
              className="h-16 w-full animate-in fade-in zoom-in bg-success text-xl font-black text-success-foreground shadow-lg hover:bg-success/90 motion-reduce:animate-none"
              onClick={() => handleAction(completeDelivery)}
              disabled={completeDelivery.isPending}
            >
              <CheckCircle2 className="mr-2 h-6 w-6" /> ENTREGA CONCLUÍDA
            </Button>
          )}

          {status === "concluida" && (
            <Button className="h-14 w-full text-lg font-bold shadow-md" variant="outline" asChild>
              <Link to="/app/entregador">VOLTAR AO INÍCIO</Link>
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
