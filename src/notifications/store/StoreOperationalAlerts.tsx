import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertCircle, Bell, RotateCcw, Volume2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useMyStores } from "@/store-orders/useStoreOrders";
import { audioManager } from "../audio/audio-manager";
import { tabCoordinator } from "../cross-tab/tab-coordinator";
import { useAudioUnlock } from "../audio/use-audio-unlock";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

type AlertRow = { entity_id: string; order_number?: number; store_id?: string; returned_at?: string; reason_code?: string };
type StoreAlerts = { unanswered_orders?: AlertRow[]; no_courier_alerts?: AlertRow[]; returned_delivery_alerts?: AlertRow[] };

/** Alertas operacionais por loja, incluindo devoluções que exigem decisão humana. */
export function StoreOperationalAlerts() {
  const { isUnlocked, unlock } = useAudioUnlock();
  const storesQuery = useMyStores();
  const stores = storesQuery.data ?? [];

  const { data: alerts } = useQuery<StoreAlerts>({
    queryKey: ["store-alerts", stores.map((store) => store.id).join(",")],
    enabled: stores.length > 0,
    queryFn: async () => {
      const results = await Promise.all(stores.map(async (store) => {
        const { data, error } = await (supabase.rpc as any)("get_my_store_operational_alerts", { _store_id: store.id });
        if (error) throw error;
        return (data ?? {}) as StoreAlerts;
      }));
      return results.reduce<StoreAlerts>((acc, item) => ({
        unanswered_orders: [...(acc.unanswered_orders ?? []), ...(item.unanswered_orders ?? [])],
        no_courier_alerts: [...(acc.no_courier_alerts ?? []), ...(item.no_courier_alerts ?? [])],
        returned_delivery_alerts: [...(acc.returned_delivery_alerts ?? []), ...(item.returned_delivery_alerts ?? [])],
      }), {});
    },
    refetchInterval: 30000,
    retry: false,
    staleTime: 10000,
  });

  const unansweredCount = alerts?.unanswered_orders?.length ?? 0;
  const noCourierCount = alerts?.no_courier_alerts?.length ?? 0;
  const returnedCount = alerts?.returned_delivery_alerts?.length ?? 0;
  const totalAlerts = unansweredCount + noCourierCount + returnedCount;

  useEffect(() => {
    if (totalAlerts > 0 && tabCoordinator.getIsLeader()) {
      audioManager.play(unansweredCount > 0 ? "new_order" : "attention");
      const originalTitle = document.title.replace(/^\(\d+\)\s+/, "");
      document.title = `(${totalAlerts}) ${originalTitle}`;
    } else if (totalAlerts === 0) {
      document.title = document.title.replace(/^\(\d+\)\s+/, "");
    }
  }, [totalAlerts, unansweredCount]);

  if (totalAlerts === 0) return null;

  if (!isUnlocked) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button onClick={unlock} className="gap-2 shadow-lg" size="lg">
          <Volume2 className="size-5" />
          Ativar alertas sonoros ({totalAlerts})
        </Button>
      </div>
    );
  }

  return (
    <div className="mb-6 space-y-3">
      {alerts?.returned_delivery_alerts?.map((alert) => (
        <Alert key={`return-${alert.entity_id}`} className="border-2 border-warning/70 bg-warning/10">
          <RotateCcw className="h-4 w-4 text-warning" />
          <AlertTitle className="flex flex-wrap items-center justify-between gap-3">
            Pedido #{alert.order_number ?? ""} retornou para a loja
            <Badge variant="outline" className="border-warning/40">Decisão necessária</Badge>
          </AlertTitle>
          <AlertDescription className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <span>O entregador devolveu fisicamente o pedido. Cancele ou libere uma nova tentativa.</span>
            <Button size="sm" variant="outline" asChild><Link to="/app/loja/devolucoes">Resolver devolução</Link></Button>
          </AlertDescription>
        </Alert>
      ))}

      {alerts?.unanswered_orders?.map((alert) => (
        <Alert key={alert.entity_id} variant="destructive" className="border-2">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="flex items-center justify-between gap-3">
            Pedido aguardando resposta
            <Badge variant="outline" className="border-none bg-destructive text-destructive-foreground">Há mais de 60s</Badge>
          </AlertTitle>
          <AlertDescription>Existem pedidos na fila pendente que ainda não foram aceitos ou recusados.</AlertDescription>
        </Alert>
      ))}

      {alerts?.no_courier_alerts?.map((alert) => (
        <Alert key={alert.entity_id} className="border-2 border-warning/60 bg-warning/10">
          <Bell className="h-4 w-4 text-warning" />
          <AlertTitle>Pedido pronto sem entregador</AlertTitle>
          <AlertDescription>Um pedido está pronto há mais de 5 minutos sem entregador atribuído.</AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
