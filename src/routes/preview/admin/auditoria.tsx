import { createFileRoute } from "@tanstack/react-router";

import { SectionTitle } from "@/components/demo/States";
import { Badge } from "@/components/ui/badge";
import { useDemo } from "@/demo/state/useDemo";
import { demoHead } from "@/demo/utils/head";

export const Route = createFileRoute("/preview/admin/auditoria")({
  head: demoHead(
    "Auditoria — Pediu Aqui",
    "Registro de ações sensíveis com autor, contexto e resultado.",
  ),
  component: AdminAudit,
});

function AdminAudit() {
  const { audit } = useDemo();

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <SectionTitle
        title="Auditoria"
        description="Toda ação sensível fica registrada, inclusive as tentativas recusadas."
      />

      <ul className="space-y-3">
        {audit.map((entry) => (
          <li key={entry.id} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-base font-medium text-foreground">{entry.action}</p>
              <Badge variant={entry.result === "sucesso" ? "success" : "danger"}>
                {entry.result === "sucesso" ? "Permitido" : "Recusado"}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {entry.date} · {entry.actor} ({entry.role}) · {entry.entity}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{entry.context}</p>
            {entry.reason ? (
              <p className="mt-1 text-sm text-danger">Motivo: {entry.reason}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
