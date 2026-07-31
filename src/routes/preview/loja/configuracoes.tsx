import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { SectionTitle } from "@/components/demo/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useDemo } from "@/demo/state/useDemo";
import { formatBRL } from "@/demo/utils/format";
import { demoHead } from "@/demo/utils/head";

export const Route = createFileRoute("/preview/loja/configuracoes")({
  head: demoHead(
    "Configurações da loja — Pediu Aqui",
    "Dados da loja, horários, bairros atendidos, formas de pagamento e assinatura.",
  ),
  component: Settings,
});

const WEEK = [
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
  "Domingo",
];

function Settings() {
  const { store, neighborhoods, plans, invoices } = useDemo();
  const [tab, setTab] = useState("dados");

  function demoOnly(label = "Configuração salva") {
    toast.info(label, { description: "Alteração realizada apenas na demonstração." });
  }

  const currentPlan = plans.find((plan) => plan.active) ?? plans[0];

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <SectionTitle
        title="Configurações"
        description="Tudo o que define como a loja aparece e opera no Pediu Aqui."
      />

      <Tabs value={tab} onValueChange={setTab}>
        <div className="rail -mx-4 gap-2 px-4">
          <TabsList className="w-max">
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="horarios">Horários</TabsTrigger>
            <TabsTrigger value="entrega">Entrega</TabsTrigger>
            <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
            <TabsTrigger value="assinatura">Assinatura</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="dados" className="mt-4 space-y-4">
          <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
            <div className="space-y-1.5">
              <Label htmlFor="store-name">Nome da loja</Label>
              <Input id="store-name" defaultValue={store.name} className="h-12" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="store-tagline">Frase curta</Label>
              <Input id="store-tagline" defaultValue={store.tagline} className="h-12" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="store-desc">Descrição</Label>
              <Textarea id="store-desc" defaultValue={store.description} rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="store-address">Endereço</Label>
              <Input id="store-address" defaultValue={store.address} className="h-12" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="store-link">Link público</Label>
              <Input id="store-link" readOnly value={`pediuaqui.app/loja/${store.slug}`} className="h-12" />
              <p className="text-sm text-muted-foreground">
                Este é o endereço que a loja divulga para os clientes.
              </p>
            </div>
            <Button variant="brand" size="touch" onClick={() => demoOnly()}>
              Salvar dados
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="horarios" className="mt-4 space-y-4">
          <div className="rounded-xl border border-border bg-surface p-4">
            <ul className="space-y-3">
              {WEEK.map((day, index) => (
                <li key={day} className="flex flex-wrap items-center gap-3">
                  <span className="w-36 text-sm text-foreground">{day}</span>
                  <Input defaultValue={store.opensAt} className="h-11 w-24" aria-label={`Abre ${day}`} />
                  <span className="text-sm text-muted-foreground">até</span>
                  <Input defaultValue={store.closesAt} className="h-11 w-24" aria-label={`Fecha ${day}`} />
                  <Switch defaultChecked={index !== 6} aria-label={`Abrir ${day}`} className="ml-auto" />
                </li>
              ))}
            </ul>
            <Button variant="brand" size="touch" className="mt-4" onClick={() => demoOnly()}>
              Salvar horários
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="entrega" className="mt-4 space-y-4">
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="text-base font-semibold text-foreground">Bairros atendidos</h2>
            <ul className="mt-3 space-y-2">
              {neighborhoods.map((neighborhood) => (
                <li key={neighborhood.id} className="flex flex-wrap items-center gap-3">
                  <span className="w-40 text-sm text-foreground">{neighborhood.name}</span>
                  <span className="text-sm text-muted-foreground">
                    Taxa {formatBRL(neighborhood.deliveryFee)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Mínimo {formatBRL(neighborhood.minimumOrder)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {neighborhood.etaMinutes} min
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto"
                    onClick={() => demoOnly("Bairro atualizado")}
                  >
                    Editar
                  </Button>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch defaultChecked={store.acceptsDelivery} id="accepts-delivery" />
                <Label htmlFor="accepts-delivery">Aceitar entrega</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch defaultChecked={store.acceptsPickup} id="accepts-pickup" />
                <Label htmlFor="accepts-pickup">Aceitar retirada</Label>
              </div>
            </div>
            <Button variant="brand" size="touch" className="mt-4" onClick={() => demoOnly()}>
              Salvar entrega
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="pagamentos" className="mt-4 space-y-4">
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm text-muted-foreground">
              O pagamento acontece direto entre cliente e loja. A plataforma não processa dinheiro
              de pedidos.
            </p>
            <ul className="mt-3 space-y-3">
              {["Pix na loja", "Dinheiro", "Cartão na entrega", "Pagamento na retirada"].map(
                (method, index) => (
                  <li key={method} className="flex items-center gap-3">
                    <Switch defaultChecked={index !== 3} aria-label={method} />
                    <span className="text-sm text-foreground">{method}</span>
                  </li>
                ),
              )}
            </ul>
            <Button variant="brand" size="touch" className="mt-4" onClick={() => demoOnly()}>
              Salvar pagamentos
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="assinatura" className="mt-4 space-y-4">
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Plano {currentPlan.name}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {formatBRL(currentPlan.price)} por mês
                </p>
              </div>
              <Badge variant="success">Ativo</Badge>
            </div>
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              {currentPlan.features.map((feature) => (
                <li key={feature}>· {feature}</li>
              ))}
            </ul>

            <h3 className="mt-5 text-sm font-semibold text-foreground">Últimas cobranças</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {invoices.slice(0, 4).map((invoice) => (
                <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-foreground">{invoice.competence}</span>
                  <span className="text-muted-foreground">vence {invoice.dueDate}</span>
                  <span className="text-foreground">{formatBRL(invoice.amount)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              Cobrança da assinatura é combinada fora da plataforma nesta fase. Aqui só existe o
              registro do que foi combinado.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
