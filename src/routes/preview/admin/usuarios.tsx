import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { SectionTitle } from "@/components/demo/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DemoAdminUser } from "@/demo/types/demo";

const demoAdminUsers: DemoAdminUser[] = [
  {
    id: "au-1",
    name: "Rita Aurora",
    environment: "loja",
    storeName: "Mercado Aurora",
    role: "Proprietária",
    active: true,
    lastAccess: "hoje, 11:40",
  },
  {
    id: "au-2",
    name: "Caio Menezes",
    environment: "loja",
    storeName: "Mercado Aurora",
    role: "Atendente",
    active: true,
    lastAccess: "hoje, 10:12",
  },
  {
    id: "au-3",
    name: "Dan Oliveira",
    environment: "entregador",
    storeName: "Mercado Aurora",
    role: "Entregador",
    active: true,
    lastAccess: "hoje, 11:05",
  },
  {
    id: "au-4",
    name: "Vera Lopes",
    environment: "loja",
    storeName: "Padaria Estrela",
    role: "Gerente",
    active: false,
    lastAccess: "ontem, 18:22",
  },
  {
    id: "au-5",
    name: "Equipe Pediu Aqui",
    environment: "administrador",
    storeName: "Plataforma",
    role: "Administração",
    active: true,
    lastAccess: "hoje, 09:00",
  },
];
import { demoHead } from "@/demo/utils/head";

export const Route = createFileRoute("/preview/admin/usuarios")({
  head: demoHead(
    "Usuários da plataforma — Pediu Aqui",
    "Pessoas com acesso aos ambientes de loja, entrega e administração.",
  ),
  component: AdminUsers,
});

function AdminUsers() {
  const [query, setQuery] = useState("");
  const filtered = demoAdminUsers.filter((user) =>
    `${user.name} ${user.storeName} ${user.role}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <SectionTitle
        title="Usuários"
        description="Cada pessoa pertence a uma loja específica. Não existe acesso cruzado entre lojas."
      />

      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar por nome, loja ou papel"
        className="h-12 max-w-md"
        aria-label="Buscar usuário"
      />

      <ul className="space-y-3">
        {filtered.map((user) => (
          <li
            key={user.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="text-base font-medium text-foreground">{user.name}</p>
              <p className="text-sm text-muted-foreground">
                {user.storeName} · {user.role} · último acesso {user.lastAccess}
              </p>
            </div>
            <Badge variant="secondary">{user.environment}</Badge>
            <Badge variant={user.active ? "success" : "danger"}>
              {user.active ? "Ativo" : "Bloqueado"}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                toast.info("Acesso alterado", {
                  description: "Alteração realizada apenas na demonstração.",
                })
              }
            >
              {user.active ? "Bloquear" : "Desbloquear"}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
