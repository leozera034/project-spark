import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Volume2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { audioManager } from "../audio/audio-manager";
import { tabCoordinator } from "../cross-tab/tab-coordinator";
import { useAudioUnlock } from "../audio/use-audio-unlock";
import { Button } from "@/components/ui/button";

type CourierAlerts = { new_assignments?: { entity_id: string }[] };

/** Alerta de nova atribuição para o entregador, consultado direto no navegador. */
export function CourierAlerts() {
  const { isUnlocked, unlock } = useAudioUnlock();
  const { data: alerts } = useQuery<CourierAlerts>({
    queryKey: ["courier-alerts"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as never as (fn: string) => Promise<{ data: CourierAlerts | null; error: unknown }>)(
        "get_my_courier_alerts",
      );
      if (error) throw error;
      return data ?? {};
    },
    refetchInterval: 15000,
    retry: false,
    staleTime: 5000,
  });

  const newAssignments = alerts?.new_assignments?.length ?? 0;

  useEffect(() => {
    if (newAssignments > 0 && tabCoordinator.getIsLeader()) {
      audioManager.play("assignment");
      toast.info("Nova entrega atribuída!", {
        description: "Você tem uma nova entrega aguardando aceite.",
        duration: 10000,
      });
    }
  }, [newAssignments]);

  if (!isUnlocked && newAssignments > 0) {
    return (
      <Button onClick={unlock} className="mb-4 w-full gap-2" variant="secondary">
        <Volume2 className="size-4" />
        Ativar sons de notificação
      </Button>
    );
  }

  return null;
}
