import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Bike, Car, MapPin, PackageCheck, RefreshCw, RotateCcw, XCircle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useTransitionReasons } from "@/store-orders/useStoreOrders";
import { useCancelReturnedDelivery, useRetryReturnedDelivery } from "@/store/couriers/hooks/useCouriers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { brl } from "@/components/storefront/format";
import { useStoreScope } from "@/store-scope/StoreScopeProvider";

export const Route = createFileRoute("/app/loja/devolucoes")({
  head: () => ({ meta: [{ title: "Pedidos retornados | Comandiva" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: ReturnedDeliveriesPage,
});

type ReturnRow = {
  orderId: string;
  orderNumber: number;
  orderVersion: number;
  customerName: string | null;
  customerPhone: string | null;
  address: Record<string, unknown> | null;
  neighborhood: string | null;
  total: number;
  paymentLabel: string | null;
  deliveryId: string;
  deliveryVersion: number;
  deliveryStatus: string;
  returnReasonCode: string | null;
  returnNote: string | null;
  returnStartedAt: string | null;
  returnedToStoreAt: string | null;
  courierName: string | null;
  courierVehicle: string | null;
  canRetry: boolean;
  canCancel: boolean;
};

type ReturnQueuePayload = { storeId: string; count: number; returns: ReturnRow[] };

const RETURN_REASON_LABEL: Record<string, string> = {
  customer_not_found: "Cliente não encontrado",
  incorrect_address: "Endereço incorreto",
  customer_refused: "Cliente recusou o pedido",
  payment_problem: "Problema no pagamento",
  unsafe_location: "Local inseguro",
  other: "Outro motivo",
};

function ReturnedDeliveriesPage() {
  const { storeId, selectedStore } = useStoreScope();

  const queue = useQuery<ReturnQueuePayload>({
    queryKey: ["returned-deliveries", storeId],
    enabled: Boolean(storeId),
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("list_my_store_returned_deliveries", { _store_id: storeId });
      if (error) throw error;
      return data as ReturnQueuePayload;
    },
    refetchInterval: 20000,
  });

  if (!storeId) return <div className="mx-auto max-w-3xl p-6"><EmptyState title="Escolha uma loja" description="Selecione a loja que você quer operar." /></div>;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild><Link to="/app/loja/entregas"><ArrowLeft className="size-4" /> Voltar para entregas</Link></Button>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-black uppercase tracking-[.14em] text-brand">Entregas</p>
            {selectedStore ? <Badge variant="outline">{selectedStore.name}</Badge> : null}
          </div>
          <h1 className="mt-1 font-display text-3xl font-black tracking-tight">Pedidos que voltaram</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Escolha o que fazer com cada pedido: corrigir e tentar novamente ou cancelar.</p>
        </div>
        <Button variant="outline" size="icon" aria-label="Atualizar" onClick={() => void queue.refetch()}><RefreshCw className="size-4" /></Button>
      </header>

      {queue.isLoading ? <Skeleton className="h-64 w-full rounded-xl" /> : queue.error ? <ErrorState title="Não foi possível carregar os pedidos retornados" description="Tente novamente." onRetry={() => void queue.refetch()} /> : (queue.data?.returns.length ?? 0) === 0 ? <EmptyState title="Nenhum pedido aguardando decisão" description="Quando uma entrega voltar para a loja, ela aparecerá aqui." /> : (
        <div className="grid gap-4">{queue.data?.returns.map((item) => <ReturnCard key={item.deliveryId} storeId={storeId} item={item} onDone={() => void queue.refetch()} />)}</div>
      )}
    </div>
  );
}

function ReturnCard({ storeId, item, onDone }: { storeId: string; item: ReturnRow; onDone: () => void }) {
  const VehicleIcon = item.courierVehicle === "carro" ? Car : Bike;
  const [retryOpen, setRetryOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const returnedAt = item.returnedToStoreAt ? new Date(item.returnedToStoreAt).toLocaleString("pt-BR") : "horário não registrado";
  const address = item.address ?? {};

  return (
    <Card className="overflow-hidden border-2 border-warning/45 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-warning-soft px-4 py-3"><div className="flex items-center gap-2"><AlertTriangle className="size-5 text-warning" /><span className="font-black">PEDIDO RETORNOU À LOJA</span></div><Badge variant="outline">#{item.orderNumber}</Badge></div>
      <CardHeader className="pb-2"><CardTitle className="flex flex-wrap items-start justify-between gap-3 text-lg"><span>{item.customerName || "Cliente"}</span><span className="tabular-nums">{brl(item.total)}</span></CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-muted/50 p-3"><p className="text-[10px] font-black uppercase text-muted-foreground">Motivo do retorno</p><p className="mt-1 font-bold">{RETURN_REASON_LABEL[item.returnReasonCode ?? ""] ?? "Não informado"}</p>{item.returnNote ? <p className="mt-1 text-xs text-muted-foreground">{item.returnNote}</p> : null}</div>
          <div className="rounded-xl bg-muted/50 p-3"><p className="text-[10px] font-black uppercase text-muted-foreground">Retornou em</p><p className="mt-1 font-bold">{returnedAt}</p><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><VehicleIcon className="size-3.5" /> {item.courierName || "Entregador"}</p></div>
        </div>

        <div className="rounded-xl border border-border p-3"><p className="flex items-center gap-2 text-xs font-black uppercase text-muted-foreground"><MapPin className="size-4" /> Endereço da tentativa</p><p className="mt-2 font-semibold">{String(address.street ?? "")}, {String(address.number ?? "")}</p><p className="text-sm text-muted-foreground">{String(address.neighborhoodName ?? item.neighborhood ?? "")}</p>{address.reference ? <p className="mt-1 text-xs text-muted-foreground">Referência: {String(address.reference)}</p> : null}</div>

        <div className="flex flex-wrap gap-2">{item.canRetry ? <Button className="gap-2" onClick={() => setRetryOpen(true)}><RotateCcw className="size-4" /> Corrigir / nova tentativa</Button> : null}{item.canCancel ? <Button variant="destructive" className="gap-2" onClick={() => setCancelOpen(true)}><XCircle className="size-4" /> Cancelar pedido</Button> : null}</div>

        <RetryDialog storeId={storeId} item={item} open={retryOpen} onOpenChange={setRetryOpen} onDone={onDone} />
        <CancelDialog storeId={storeId} item={item} open={cancelOpen} onOpenChange={setCancelOpen} onDone={onDone} />
      </CardContent>
    </Card>
  );
}

function RetryDialog({ storeId, item, open, onOpenChange, onDone }: { storeId: string; item: ReturnRow; open: boolean; onOpenChange: (value: boolean) => void; onDone: () => void }) {
  const retry = useRetryReturnedDelivery();
  const source = item.address ?? {};
  const [correctAddress, setCorrectAddress] = useState(false);
  const [street, setStreet] = useState(String(source.street ?? ""));
  const [number, setNumber] = useState(String(source.number ?? ""));
  const [neighborhood, setNeighborhood] = useState(String(source.neighborhoodName ?? item.neighborhood ?? ""));
  const [complement, setComplement] = useState(String(source.complement ?? ""));
  const [reference, setReference] = useState(String(source.reference ?? ""));
  const [note, setNote] = useState("");
  const canSubmit = !correctAddress || Boolean(street.trim() && number.trim() && neighborhood.trim());

  async function submit() {
    await retry.mutateAsync({
      storeId,
      orderId: item.orderId,
      expectedOrderVersion: item.orderVersion,
      expectedDeliveryVersion: item.deliveryVersion,
      address: correctAddress ? { street: street.trim(), number: number.trim(), neighborhoodName: neighborhood.trim(), complement: complement.trim() || null, reference: reference.trim() || null } : null,
      internalNote: note.trim() || null,
    });
    onOpenChange(false);
    onDone();
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Liberar nova tentativa</DialogTitle><DialogDescription>O pedido volta para “Aguardando entregador”. Depois escolha um entregador novamente.</DialogDescription></DialogHeader><div className="space-y-4">
    <div className="grid grid-cols-2 gap-2"><Button type="button" variant={!correctAddress ? "default" : "outline"} onClick={() => setCorrectAddress(false)}>Mesmo endereço</Button><Button type="button" variant={correctAddress ? "default" : "outline"} onClick={() => setCorrectAddress(true)}>Corrigir endereço</Button></div>
    {correctAddress ? <div className="space-y-3 rounded-xl border p-3"><div className="space-y-1"><Label>Rua</Label><Input value={street} onChange={(event) => setStreet(event.target.value)} /></div><div className="grid grid-cols-2 gap-2"><div className="space-y-1"><Label>Número</Label><Input value={number} onChange={(event) => setNumber(event.target.value)} /></div><div className="space-y-1"><Label>Bairro</Label><Input value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)} /></div></div><div className="space-y-1"><Label>Complemento</Label><Input value={complement} onChange={(event) => setComplement(event.target.value)} /></div><div className="space-y-1"><Label>Referência</Label><Input value={reference} onChange={(event) => setReference(event.target.value)} /></div><p className="text-xs text-muted-foreground">Com o endereço corrigido, a próxima estimativa de entrega será calculada novamente.</p></div> : null}
    <div className="space-y-1"><Label>Observação interna</Label><Textarea value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} placeholder="Ex.: cliente confirmou o novo número por telefone." /></div>
  </div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={retry.isPending}>Voltar</Button><Button onClick={() => void submit()} disabled={!canSubmit || retry.isPending}><PackageCheck className="size-4" /> Liberar nova tentativa</Button></DialogFooter></DialogContent></Dialog>;
}

function CancelDialog({ storeId, item, open, onOpenChange, onDone }: { storeId: string; item: ReturnRow; open: boolean; onOpenChange: (value: boolean) => void; onDone: () => void }) {
  const reasonsQuery = useTransitionReasons();
  const cancel = useCancelReturnedDelivery();
  const reasons = useMemo(() => (reasonsQuery.data ?? []).filter((reason) => reason.applies_cancel), [reasonsQuery.data]);
  const [reasonCode, setReasonCode] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const selected = reasons.find((reason) => reason.code === reasonCode) ?? null;

  async function submit() {
    if (!reasonCode) return;
    await cancel.mutateAsync({ storeId, orderId: item.orderId, expectedOrderVersion: item.orderVersion, expectedDeliveryVersion: item.deliveryVersion, reasonCode, internalNote: note.trim() || null, customerMessage: selected?.public_message ?? null });
    onOpenChange(false);
    onDone();
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Cancelar pedido retornado</DialogTitle><DialogDescription>Use quando a loja decidiu que não haverá nova tentativa.</DialogDescription></DialogHeader><div className="space-y-3"><div className="flex flex-wrap gap-2">{reasons.map((reason) => <Button key={reason.code} size="sm" type="button" variant={reasonCode === reason.code ? "default" : "outline"} onClick={() => setReasonCode(reason.code)}>{reason.internal_label}</Button>)}</div>{selected?.public_message ? <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">Mensagem ao cliente: “{selected.public_message}”</p> : null}<div className="space-y-1"><Label>Observação interna</Label><Textarea value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} /></div></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={cancel.isPending}>Voltar</Button><Button variant="destructive" onClick={() => void submit()} disabled={!reasonCode || cancel.isPending}>Confirmar cancelamento</Button></DialogFooter></DialogContent></Dialog>;
}
