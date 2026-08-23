import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useStoreConfig } from "@/store-config/StoreConfigProvider";

export const Route = createFileRoute("/app/loja/configuracoes/entregas")({
  component: DeliverySettings,
});

type DeliveryProofSettings = {
  mode: "none" | "pin";
  canEdit: boolean;
};

const rpc = supabase.rpc.bind(supabase) as any;

async function fetchProofSettings(storeId: string): Promise<DeliveryProofSettings> {
  const { data, error } = await rpc("get_my_store_delivery_proof_settings", { _store_id: storeId });
  if (error) throw new Error(error.message);
  return data as DeliveryProofSettings;
}

async function setProofMode(storeId: string, mode: DeliveryProofSettings["mode"]): Promise<DeliveryProofSettings> {
  const { data, error } = await rpc("set_my_store_delivery_proof_mode", { _store_id: storeId, _mode: mode });
  if (error) throw new Error(error.message);
  return data as DeliveryProofSettings;
}

function DeliverySettings() {
  const { storeId } = useStoreConfig();
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: ["store", "delivery-proof-settings", storeId],
    queryFn: () => fetchProofSettings(storeId!),
    enabled: Boolean(storeId),
  });

  const update = useMutation({
    mutationFn: ({ mode }: { mode: DeliveryProofSettings["mode"] }) => setProofMode(storeId!, mode),
    onSuccess: (data) => {
      queryClient.setQueryData(["store", "delivery-proof-settings", storeId], data);
      toast.success(data.mode === "pin" ? "Código de entrega ativado." : "Código de entrega desativado.");
    },
    onError: () => toast.error("Não foi possível alterar a confirmação de entrega."),
  });

  if (!storeId || settings.isLoading) {
    return <div className="space-y-4"><Skeleton className="h-28 w-full rounded-xl" /><Skeleton className="h-44 w-full rounded-xl" /></div>;
  }

  if (settings.isError || !settings.data) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Não foi possível carregar as configurações de entrega</AlertTitle>
        <AlertDescription>Tente recarregar a página. Nenhuma configuração foi alterada.</AlertDescription>
      </Alert>
    );
  }

  const enabled = settings.data.mode === "pin";
  const canEdit = settings.data.canEdit;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-black uppercase tracking-[.14em] text-brand">Entrega e retirada</p>
        <h1 className="mt-1 font-display text-2xl font-black">Segurança da entrega</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Configure como o entregador comprova que o pedido chegou ao cliente.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><KeyRound className="size-5" /></span>
            <div>
              <CardTitle className="text-base">Código de 6 dígitos</CardTitle>
              <CardDescription>O cliente vê um código privado no acompanhamento e informa ao entregador somente no momento da entrega.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between gap-4 rounded-xl border border-border p-4">
            <div className="space-y-1">
              <Label htmlFor="delivery-proof-pin" className="text-sm font-bold">Exigir código para concluir novas entregas</Label>
              <p className="text-xs leading-relaxed text-muted-foreground">A alteração vale quando uma nova entrega inicia a rota. Entregas já em andamento mantêm a regra anterior.</p>
            </div>
            <Switch
              id="delivery-proof-pin"
              checked={enabled}
              disabled={!canEdit || update.isPending}
              onCheckedChange={(checked) => update.mutate({ mode: checked ? "pin" : "none" })}
            />
          </div>
        </CardContent>
      </Card>

      <Alert>
        <ShieldCheck className="size-4" />
        <AlertTitle>Proteção contra contestação</AlertTitle>
        <AlertDescription>
          O código não é enviado ao entregador e não fica armazenado em texto puro no banco. Após cinco tentativas inválidas, novas tentativas são temporariamente bloqueadas.
        </AlertDescription>
      </Alert>

      {!canEdit ? (
        <Alert>
          <AlertTitle>Somente proprietário ou gerente pode alterar</AlertTitle>
          <AlertDescription>Você pode consultar a regra atual, mas seu perfil não possui permissão para modificá-la.</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
