import { useEffect, useState } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getStoreAlerts } from '../notifications.functions';
import { audioManager } from '../audio/audio-manager';
import { tabCoordinator } from '../cross-tab/tab-coordinator';
import { useAudioUnlock } from '../audio/use-audio-unlock';
import { Button } from '@/components/ui/button';
import { AlertCircle, Bell, BellOff, Volume2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

export function StoreOperationalAlerts() {
  const { isUnlocked, unlock } = useAudioUnlock();
  const { data: alerts, refetch } = useSuspenseQuery({
    queryKey: ['store-alerts'],
    queryFn: () => getStoreAlerts(),
    refetchInterval: 30000, // Fallback polling 30s
  });

  const unansweredCount = alerts?.unanswered_orders?.length ?? 0;
  const noCourierCount = alerts?.no_courier_alerts?.length ?? 0;
  const totalAlerts = unansweredCount + noCourierCount;

  useEffect(() => {
    if (totalAlerts > 0 && tabCoordinator.getIsLeader()) {
      const severity = unansweredCount > 0 ? 'new_order' : 'attention';
      audioManager.play(severity as any);
      
      // Update document title for visibility (Sanitized: no PII)
      const originalTitle = document.title.replace(/^\(\d+\)\s+/, '');
      document.title = `(${totalAlerts}) ${originalTitle}`;
    } else if (totalAlerts === 0) {
      document.title = document.title.replace(/^\(\d+\)\s+/, '');
    }
  }, [totalAlerts, unansweredCount]);

  if (!isUnlocked && totalAlerts > 0) {
    return (
      <div className="fixed bottom-4 right-4 z-50 animate-bounce">
        <Button onClick={unlock} className="gap-2 shadow-lg" size="lg">
          <Volume2 className="size-5" />
          Ativar alertas sonoros (${totalAlerts})
        </Button>
      </div>
    );
  }

  if (totalAlerts === 0) return null;

  return (
    <div className="space-y-3 mb-6">
      {alerts?.unanswered_orders?.map((alert: any) => (
        <Alert key={alert.entity_id} variant="destructive" className="border-2 animate-pulse">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="flex items-center justify-between">
            Pedido aguardando resposta crítica
            <Badge variant="outline" className="bg-destructive text-destructive-foreground border-none">
              Há mais de 60s
            </Badge>
          </AlertTitle>
          <AlertDescription>
            Existem pedidos na fila 'Pendente' que ainda não foram aceitos ou recusados.
          </AlertDescription>
        </Alert>
      ))}
      
      {alerts?.no_courier_alerts?.map((alert: any) => (
        <Alert key={alert.entity_id} className="border-2 border-orange-500 bg-orange-50 dark:bg-orange-950/20">
          <Bell className="h-4 w-4 text-orange-500" />
          <AlertTitle className="text-orange-700 dark:text-orange-400">
            Atenção: Pedido pronto sem entregador
          </AlertTitle>
          <AlertDescription>
            Pedido #${alert.entity_id.split('-')[0]} está pronto mas não tem entregador atribuído há mais de 5 minutos.
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
