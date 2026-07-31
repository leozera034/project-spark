import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { SectionTitle } from "@/components/demo/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDemo } from "@/demo/state/useDemo";
import { demoHead } from "@/demo/utils/head";

export const Route = createFileRoute("/preview/admin/suporte")({
  head: demoHead(
    "Suporte às lojas — Pediu Aqui",
    "Chamados abertos pelas lojas, com assunto, resumo e situação.",
  ),
  component: AdminSupport,
});

const STATUS_LABEL = {
  aberto: "Aberto",
  em_analise: "Em análise",
  resolvido: "Resolvido",
} as const;

const STATUS_TONE = {
  aberto: "warning",
  em_analise: "info",
  resolvido: "success",
} as const;

function AdminSupport() {
  const { supportTickets } = useDemo();

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <SectionTitle
        title="Suporte"
        description="Canal direto com as lojas. Sem acesso aos dados de clientes das lojas."
      />

      <ul className="space-y-3">
        {supportTickets.map((ticket) => (
          <li key={ticket.id} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-base font-medium text-foreground">{ticket.subject}</p>
              <Badge variant={STATUS_TONE[ticket.status]}>{STATUS_LABEL[ticket.status]}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {ticket.storeName} · aberto em {ticket.openedAt}
            </p>
            <p className="mt-2 text-sm text-foreground/80">{ticket.summary}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() =>
                toast.info("Chamado respondido", {
                  description: "Alteração realizada apenas na demonstração.",
                })
              }
            >
              Responder
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
