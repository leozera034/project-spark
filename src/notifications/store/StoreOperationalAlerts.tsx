import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Bell, Volume2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { audioManager } from "../audio/audio-manager";
import { tabCoordinator } from "../cross-tab/tab-coordinator";
import { useAudioUnlock } from "../audio/use-audio-unlock";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

type AlertRow = { entity_id: string };
type StoreAlerts = { unanswered_orders?: AlertRow[]; no_courier_alerts?: AlertRow[] };

/** Alertas operacionais sanitizados: consulta autenticada direto no navegador. */
export function StoreOperationalAlerts() {
  const { isUnlocked, unlock } = useAudioUnlock();
  const { data: alerts } = useQuery<StoreAlerts>({
    queryKey: ["store-alerts"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as never as (fn: string) => Promise<{ data: StoreAlerts | null; error: unknown }>)(
        "get_my_store_operational_alerts",
      );
      if (error) throw error;
      return data ?? {};
    },
    refetchInterval: 30000,
    retry: false,
    staleTime: 10000,
  });

  const unansweredCount = alerts?.unanswered_orders?.length ?? 0;
  const noCourierCount = alerts?.no_courier_alerts?.length ?? 0;
  const totalAlerts = unansweredCount + noCourierCount;

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
      {alerts?.unanswered_orders?.map((alert) => (
        <Alert key={alert.entity_id} variant="destructive" className="border-2">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="flex items-center justify-between gap-3">
            Pedido aguardando resposta
            <Badge variant="outline" className="border-none bg-destructive text-destructive-foreground">
              Há mais de 60s
            </Badge>
          </AlertTitle>
          <AlertDescription>
            Existem pedidos na fila pendente que ainda não foram aceitos ou recusados.
          </AlertDescription>
        </Alert>
      ))}

      {alerts?.no_courier_alerts?.map((alert) => (
        <Alert key={alert.entity_id} className="border-2 border-warning/60 bg-warning/10">
          <Bell className="h-4 w-4 text-warning" />
          <AlertTitle>Pedido pronto sem entregador</AlertTitle>
          <AlertDescription>
            Um pedido está pronto há mais de 5 minutos sem entregador atribuído.
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
