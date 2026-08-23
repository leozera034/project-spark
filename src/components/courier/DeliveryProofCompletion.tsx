import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, KeyRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

type ProofRequirement = {
  mode: "none" | "pin";
  attemptsRemaining: number;
  retryAfterSeconds: number;
  verifiedAt: string | null;
};

type CompletionResult = {
  ok: boolean;
  error?: "INVALID_PROOF" | "PROOF_RATE_LIMITED" | string;
  attemptsRemaining?: number;
  retryAfterSeconds?: number;
  deliveryId?: string;
  version?: number;
};

const rpc = supabase.rpc.bind(supabase) as any;

async function getProofRequirement(deliveryId: string): Promise<ProofRequirement> {
  const { data, error } = await rpc("get_my_delivery_proof_requirement", { _delivery_id: deliveryId });
  if (error) throw new Error(error.message);
  return data as ProofRequirement;
}

async function completeDelivery(input: {
  deliveryId: string;
  expectedVersion: number;
  proofCode: string | null;
}): Promise<CompletionResult> {
  const { data, error } = await rpc("complete_my_delivery", {
    _delivery_id: input.deliveryId,
    _expected_version: input.expectedVersion,
    _idempotency_key: crypto.randomUUID(),
    _proof_code: input.proofCode,
  });
  if (error) throw new Error(error.message);
  return data as CompletionResult;
}

function retryText(seconds: number) {
  if (seconds <= 0) return null;
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `Muitas tentativas. Aguarde cerca de ${minutes} min antes de tentar novamente.`;
}

export function DeliveryProofCompletion({
  deliveryId,
  expectedVersion,
  onCompleted,
}: {
  deliveryId: string;
  expectedVersion: number;
  onCompleted: () => void | Promise<void>;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const proof = useQuery({
    queryKey: ["courier", "delivery-proof", deliveryId],
    queryFn: () => getProofRequirement(deliveryId),
    staleTime: 10_000,
  });

  const completion = useMutation({
    mutationFn: completeDelivery,
    onSuccess: async (result) => {
      if (!result.ok) return;
      setOpen(false);
      setCode("");
      setFeedback(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["courier", "operational-context"] }),
        queryClient.invalidateQueries({ queryKey: ["courier", "delivery-proof", deliveryId] }),
        queryClient.invalidateQueries({ queryKey: ["store-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["couriers"] }),
        queryClient.invalidateQueries({ queryKey: ["courier-reports"] }),
      ]);
      toast.success("Entrega concluída!");
      await onCompleted();
    },
    onError: () => toast.error("Não foi possível concluir a entrega. Atualize os dados e tente novamente."),
  });

  const requirement = proof.data;
  const locked = Boolean(requirement?.retryAfterSeconds && requirement.retryAfterSeconds > 0);

  async function submit(proofCode: string | null) {
    setFeedback(null);
    const result = await completion.mutateAsync({ deliveryId, expectedVersion, proofCode });
    if (result.ok) return;

    const attemptsRemaining = result.attemptsRemaining ?? requirement?.attemptsRemaining ?? 0;
    const retryAfterSeconds = result.retryAfterSeconds ?? 0;
    queryClient.setQueryData<ProofRequirement>(["courier", "delivery-proof", deliveryId], (current) => ({
      mode: current?.mode ?? "pin",
      attemptsRemaining,
      retryAfterSeconds,
      verifiedAt: current?.verifiedAt ?? null,
    }));

    if (result.error === "PROOF_RATE_LIMITED" || retryAfterSeconds > 0) {
      setFeedback(retryText(retryAfterSeconds) ?? "Limite de tentativas atingido. Aguarde antes de tentar novamente.");
      return;
    }
    if (result.error === "INVALID_PROOF") {
      setFeedback(`Código incorreto. ${attemptsRemaining} tentativa${attemptsRemaining === 1 ? "" : "s"} restante${attemptsRemaining === 1 ? "" : "s"}.`);
      return;
    }
    setFeedback("Não foi possível validar a entrega. Confira o código e tente novamente.");
  }

  async function handlePrimaryAction() {
    if (proof.isLoading) return;
    if (requirement?.mode === "pin") {
      setCode("");
      setFeedback(locked ? retryText(requirement.retryAfterSeconds) : null);
      setOpen(true);
      return;
    }
    await submit(null);
  }

  const digits = code.replace(/\D/g, "").slice(0, 6);

  return (
    <>
      <Button
        className="h-16 w-full bg-success text-lg font-black text-success-foreground hover:bg-success/90"
        onClick={() => void handlePrimaryAction()}
        disabled={proof.isLoading || completion.isPending}
      >
        {requirement?.mode === "pin" ? <KeyRound className="mr-2 h-5 w-5" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
        {proof.isLoading ? "VERIFICANDO ENTREGA..." : requirement?.mode === "pin" ? "CONFIRMAR COM CÓDIGO" : "ENTREGA CONCLUÍDA"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[92vw] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Confirmar entrega com código</DialogTitle>
            <DialogDescription>
              Peça ao cliente o código de 6 dígitos exibido no acompanhamento do pedido. Não conclua sem estar no local da entrega.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="delivery-proof-code">Código do cliente</Label>
            <Input
              id="delivery-proof-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={digits}
              onChange={(event) => { setCode(event.target.value.replace(/\D/g, "").slice(0, 6)); setFeedback(null); }}
              placeholder="000000"
              className="h-16 text-center font-mono text-3xl font-black tracking-[.3em]"
              disabled={completion.isPending || locked}
              autoFocus
            />
            {feedback ? <p role="alert" className="rounded-xl border border-warning/30 bg-warning-soft p-3 text-sm font-semibold">{feedback}</p> : null}
            {requirement?.mode === "pin" && !locked ? <p className="text-xs text-muted-foreground">Tentativas disponíveis: {requirement.attemptsRemaining}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={completion.isPending}>Cancelar</Button>
            <Button variant="brand" onClick={() => void submit(digits)} disabled={digits.length !== 6 || completion.isPending || locked}>
              {completion.isPending ? "Validando..." : "Validar e concluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
