import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { StickyAction, StoreFooter, StorePage, StoreStepHeader } from "@/components/demo/StoreShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDemo } from "@/demo/state/useDemo";
import { demoHead } from "@/demo/utils/head";

export const Route = createFileRoute("/preview/cliente/identificacao")({
  head: demoHead(
    "Identificação — Mercado Aurora",
    "Informe apenas o primeiro nome para continuar o pedido no Mercado Aurora.",
  ),
  component: Identification,
});

function Identification() {
  const navigate = useNavigate();
  const { customer, updateCustomer } = useDemo();
  const [name, setName] = useState(customer.firstName);

  return (
    <div className="flex min-h-screen flex-col">
      <StoreStepHeader title="Boas-vindas" backTo="/preview/cliente" step={1} totalSteps={4} />
      <StorePage className="flex-1">
        <h1 className="text-2xl font-semibold text-foreground">Como podemos chamar você?</h1>
        <p className="mt-2 text-base text-muted-foreground">
          Só o primeiro nome. Usamos para identificar seu pedido no balcão e na entrega.
        </p>

        <div className="mt-6">
          <Label htmlFor="primeiro-nome" className="text-base">
            Primeiro nome
          </Label>
          <Input
            id="primeiro-nome"
            className="mt-2 h-12 text-base"
            autoComplete="given-name"
            placeholder="Marina"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <p className="mt-2 text-sm text-muted-foreground">
            Não pedimos sobrenome, e-mail, CPF, senha nem data de nascimento.
          </p>
        </div>
        <StoreFooter />
      </StorePage>

      <StickyAction>
        <Button
          size="touch"
          variant="brand"
          className="h-13 w-full text-base"
          disabled={name.trim().length < 2}
          onClick={() => {
            updateCustomer({ firstName: name.trim() });
            void navigate({ to: "/preview/cliente/modalidade" });
          }}
        >
          Continuar
        </Button>
      </StickyAction>
    </div>
  );
}
