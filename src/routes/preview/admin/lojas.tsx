import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { SectionTitle } from "@/components/demo/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useDemo } from "@/demo/state/useDemo";
import { demoHead } from "@/demo/utils/head";
import { saasStoreStatusLabel, saasStoreStatusTone } from "@/demo/utils/labels";

export const Route = createFileRoute("/preview/admin/lojas")({
  head: demoHead(
    "Lojas da plataforma — Pediu Aqui",
    "Cadastro, situação e isolamento das lojas atendidas pela plataforma.",
  ),
  component: AdminStores,
});

function AdminStores() {
  const { saasStores, setSaasStoreStatus, plans } = useDemo();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = saasStores.filter((store) =>
    `${store.name} ${store.owner} ${store.slug}`.toLowerCase().includes(query.toLowerCase()),
  );
  const selected = saasStores.find((store) => store.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <SectionTitle
        title="Lojas"
        description="Cada loja é isolada. Nenhum dado circula entre lojas diferentes."
        action={
          <Button
            variant="brand"
            size="sm"
            onClick={() =>
              toast.info("Nova loja", {
                description: "Alteração realizada apenas na demonstração.",
              })
            }
          >
            Cadastrar loja
          </Button>
        }
      />

      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar por nome, dono ou endereço"
        className="h-12 max-w-md"
        aria-label="Buscar loja"
      />

      <ul className="space-y-3">
        {filtered.map((store) => (
          <li
            key={store.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="text-base font-medium text-foreground">{store.name}</p>
              <p className="text-sm text-muted-foreground">
                {store.owner} · pediuaqui.app/loja/{store.slug}
              </p>
              <p className="text-sm text-muted-foreground">
                {store.ordersInPeriod} pedidos no mês · vence {store.dueDate}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={saasStoreStatusTone[store.status]}>
                {saasStoreStatusLabel[store.status]}
              </Badge>
              <Badge variant={store.menuPublished ? "success" : "secondary"}>
                {store.menuPublished ? "Cardápio publicado" : "Cardápio oculto"}
              </Badge>
            </div>
            <Button variant="outline" size="sm" onClick={() => setSelectedId(store.id)}>
              Abrir
            </Button>
          </li>
        ))}
      </ul>

      <Sheet open={selected !== null} onOpenChange={(open) => (open ? null : setSelectedId(null))}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selected ? (
            <>
              <SheetHeader className="text-left">
                <SheetTitle>{selected.name}</SheetTitle>
                <SheetDescription>
                  Ficha da loja. Nenhuma ação altera dados reais nesta fase.
                </SheetDescription>
              </SheetHeader>

              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Responsável</dt>
                  <dd className="text-foreground">{selected.owner}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Contato</dt>
                  <dd className="text-foreground">{selected.contact}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Plano</dt>
                  <dd className="text-foreground">
                    {plans.find((plan) => plan.id === selected.planId)?.name ?? "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Vencimento</dt>
                  <dd className="text-foreground">{selected.dueDate}</dd>
                </div>
              </dl>

              <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                Suspender bloqueia o acesso da equipe e oculta o cardápio público, sem apagar dados.
              </p>

              <div className="mt-5 grid gap-2">
                <Button
                  size="touch"
                  variant={selected.status === "ativa" ? "outline" : "brand"}
                  onClick={() => {
                    setSaasStoreStatus(selected.id, selected.status === "ativa" ? "suspensa" : "ativa");
                    toast.success(
                      selected.status === "ativa" ? "Loja suspensa" : "Loja reativada",
                      { description: "Alteração realizada apenas na demonstração." },
                    );
                  }}
                >
                  {selected.status === "ativa" ? "Suspender loja" : "Reativar loja"}
                </Button>
                <Button
                  size="touch"
                  variant="outline"
                  onClick={() =>
                    toast.info("Plano alterado", {
                      description: "Alteração realizada apenas na demonstração.",
                    })
                  }
                >
                  Trocar plano
                </Button>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
