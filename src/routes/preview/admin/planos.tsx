import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { SectionTitle } from "@/components/demo/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDemo } from "@/demo/state/useDemo";
import { formatBRL } from "@/demo/utils/format";
import { demoHead } from "@/demo/utils/head";

export const Route = createFileRoute("/preview/admin/planos")({
  head: demoHead(
    "Planos da plataforma — Pediu Aqui",
    "Planos comerciais, recursos incluídos e quantidade de lojas em cada um.",
  ),
  component: AdminPlans,
});

function AdminPlans() {
  const { plans } = useDemo();

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <SectionTitle
        title="Planos"
        description="Estrutura comercial simples, sem cobrança automática nesta fase."
        action={
          <Button
            variant="brand"
            size="sm"
            onClick={() =>
              toast.info("Novo plano", {
                description: "Alteração realizada apenas na demonstração.",
              })
            }
          >
            Criar plano
          </Button>
        }
      />

      <ul className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <li key={plan.id} className="flex flex-col rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-foreground">{plan.name}</h2>
              {plan.active ? <Badge variant="success">Em uso</Badge> : null}
            </div>
            <p className="mt-2 text-3xl font-semibold text-foreground">
              {formatBRL(plan.price)}
              <span className="text-base font-normal text-muted-foreground"> /mês</span>
            </p>
            <ul className="mt-4 flex-1 space-y-2 text-sm">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-muted-foreground">
                  <Check aria-hidden="true" className="mt-0.5 size-4 text-brand" />
                  {feature}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-muted-foreground">
              {plan.storeCount} lojas neste plano
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() =>
                toast.info("Plano editado", {
                  description: "Alteração realizada apenas na demonstração.",
                })
              }
            >
              Editar plano
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
