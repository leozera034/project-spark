import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { SectionTitle } from "@/components/demo/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDemo } from "@/demo/state/useDemo";
import { formatBRL } from "@/demo/utils/format";
import { demoHead } from "@/demo/utils/head";
import { invoiceStatusLabel, invoiceStatusTone } from "@/demo/utils/labels";

export const Route = createFileRoute("/preview/admin/cobrancas")({
  head: demoHead(
    "Cobranças — Pediu Aqui",
    "Registro de mensalidades por loja, com vencimento, desconto e tolerância.",
  ),
  component: AdminInvoices,
});

function AdminInvoices() {
  const { invoices } = useDemo();

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <SectionTitle
        title="Cobranças"
        description="Controle manual das mensalidades. A plataforma não processa pagamento automático nesta fase."
      />

      <ul className="space-y-3">
        {invoices.map((invoice) => (
          <li
            key={invoice.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="text-base font-medium text-foreground">{invoice.storeName}</p>
              <p className="text-sm text-muted-foreground">
                {invoice.competence} · vence {invoice.dueDate} · tolerância {invoice.toleranceDays}{" "}
                dias
              </p>
              {invoice.paidAt ? (
                <p className="text-sm text-muted-foreground">Pago em {invoice.paidAt}</p>
              ) : null}
            </div>
            <div className="text-right">
              <p className="text-base font-semibold text-foreground">{formatBRL(invoice.amount)}</p>
              {invoice.discount > 0 ? (
                <p className="text-sm text-muted-foreground">
                  Desconto {formatBRL(invoice.discount)}
                </p>
              ) : null}
            </div>
            <Badge variant={invoiceStatusTone[invoice.status]}>
              {invoiceStatusLabel[invoice.status]}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                toast.info("Cobrança atualizada", {
                  description: "Alteração realizada apenas na demonstração.",
                })
              }
            >
              Registrar pagamento
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
