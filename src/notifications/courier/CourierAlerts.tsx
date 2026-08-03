import { useEffect } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getCourierAlerts } from '../notifications.functions';
import { audioManager } from '../audio/audio-manager';
import { tabCoordinator } from '../cross-tab/tab-coordinator';
import { useAudioUnlock } from '../audio/use-audio-unlock';
import { Button } from '@/components/ui/button';
import { Volume2, Bike } from 'lucide-react';
import { toast } from 'sonner';

export function CourierAlerts() {
  const { isUnlocked, unlock } = useAudioUnlock();
  const { data: alerts } = useSuspenseQuery({
    queryKey: ['courier-alerts'],
    queryFn: () => getCourierAlerts(),
    refetchInterval: 15000, // Faster polling for couriers
  });

  const newAssignments = alerts?.new_assignments?.length ?? 0;

  useEffect(() => {
    if (newAssignments > 0 && tabCoordinator.getIsLeader()) {
      audioManager.play('assignment');
      toast.info('Nova entrega atribuída!', {
        description: 'Você tem uma nova entrega aguardando aceite.',
        duration: 10000,
      });
    }
  }, [newAssignments]);

  if (!isUnlocked && newAssignments > 0) {
    return (
      <Button onClick={unlock} className="w-full gap-2 mb-4" variant="secondary">
        <Volume2 className="size-4" />
        Ativar Sons de Notificação
      </Button>
    );
  }

  return null;
}
