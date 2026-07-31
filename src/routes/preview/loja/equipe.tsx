import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { SectionTitle } from "@/components/demo/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDemo } from "@/demo/state/useDemo";
import type { StoreRole } from "@/demo/types/demo";
import { demoHead } from "@/demo/utils/head";
import { roleLabel } from "@/demo/utils/labels";

export const Route = createFileRoute("/preview/loja/equipe")({
  head: demoHead(
    "Equipe da loja — Pediu Aqui",
    "Papéis e permissões da loja, com explicação simples do que cada função enxerga.",
  ),
  component: Team,
});

const ROLE_SCOPE: Record<StoreRole, string> = {
  proprietario: "Enxerga tudo da loja, inclusive configurações e relatórios.",
  gerente: "Opera pedidos, cardápio e equipe. Não altera dados de cobrança.",
  atendente: "Recebe e acompanha pedidos. Não altera cardápio nem equipe.",
  cozinha: "Vê apenas o modo cozinha, sem contato do cliente e sem valores.",
  entregador: "Vê apenas as próprias entregas no aplicativo de entrega.",
};

function Team() {
  const { storeUsers } = useDemo();

  function demoOnly(label: string) {
    toast.info(label, { description: "Alteração realizada apenas na demonstração." });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <SectionTitle
        title="Equipe"
        description="Cada pessoa vê somente o necessário para o próprio trabalho."
        action={
          <Button variant="brand" size="sm" onClick={() => demoOnly("Convite enviado")}>
            Convidar pessoa
          </Button>
        }
      />

      <ul className="space-y-3">
        {storeUsers.map((user) => (
          <li
            key={user.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="text-base font-medium text-foreground">{user.name}</p>
              <p className="text-sm text-muted-foreground">
                {user.phone} · último acesso {user.lastAccess}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{ROLE_SCOPE[user.role]}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="brandSoft">{roleLabel[user.role]}</Badge>
              <Badge variant={user.active ? "success" : "secondary"}>
                {user.active ? "Ativo" : "Inativo"}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => demoOnly("Papel alterado")}>
                Alterar papel
              </Button>
              <Button variant="ghost" size="sm" onClick={() => demoOnly("Acesso alterado")}>
                {user.active ? "Desativar" : "Ativar"}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-base font-semibold text-foreground">Resumo das permissões</h2>
        <dl className="mt-3 space-y-2 text-sm">
          {(Object.keys(ROLE_SCOPE) as StoreRole[]).map((role) => (
            <div key={role} className="flex flex-col gap-0.5 border-b border-border pb-2 last:border-0">
              <dt className="font-medium text-foreground">{roleLabel[role]}</dt>
              <dd className="text-muted-foreground">{ROLE_SCOPE[role]}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
