import { Link, createFileRoute } from "@tanstack/react-router";
import { Building2, Clock3, CreditCard, KeyRound, MapPin, Palette, Settings2, Truck, UserRoundCog } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/app/loja/configuracoes/")({ component: SettingsHome });

const GROUPS = [
  {
    title: "Loja",
    description: "Informações que identificam seu negócio para clientes.",
    items: [
      { to: "/app/loja/configuracoes/dados", label: "Dados da loja", description: "Nome, contato, descrição e mensagens", icon: Building2 },
      { to: "/app/loja/configuracoes/endereco", label: "Endereço", description: "Local de retirada e origem das entregas", icon: MapPin },
      { to: "/app/loja/configuracoes/identidade", label: "Identidade", description: "Link público, logo, capa e cores", icon: Palette },
    ],
  },
  {
    title: "Operação",
    description: "Como e quando sua loja recebe pedidos.",
    items: [
      { to: "/app/loja/configuracoes/horarios", label: "Horários", description: "Dias e turnos de funcionamento", icon: Clock3 },
      { to: "/app/loja/configuracoes/atendimento", label: "Atendimento", description: "Pedido mínimo, preparo, abertura e alertas", icon: Settings2 },
    ],
  },
  {
    title: "Entrega e retirada",
    description: "Modalidades, cobertura, prazos, taxas e segurança da operação.",
    items: [
      { to: "/app/loja/configuracoes/atendimento", label: "Modalidades", description: "Ative entrega e retirada e ajuste o tempo de preparo", icon: Settings2 },
      { to: "/app/loja/configuracoes/bairros", label: "Cobertura e taxas", description: "Taxa fixa, por distância ou por bairro", icon: Truck },
      { to: "/app/loja/configuracoes/entregas", label: "Segurança da entrega", description: "Código de confirmação e prova de entrega", icon: KeyRound },
    ],
  },
  {
    title: "Pagamentos",
    description: "Formas de pagamento aceitas nos pedidos da loja.",
    items: [
      { to: "/app/loja/configuracoes/pagamentos", label: "Pagamentos e recebimentos", description: "Pagamento online, Pix, dinheiro e maquininha", icon: CreditCard },
    ],
  },
  {
    title: "Conta e plano",
    description: "Assinatura, cobrança e administração da conta Comandiva.",
    items: [
      { to: "/app/loja/plano", label: "Conta e plano", description: "Plano atual, cobrança, renovação e histórico", icon: UserRoundCog },
    ],
  },
] as const;

function SettingsHome() {
  return (
    <div className="space-y-7">
      {GROUPS.map((group) => (
        <section key={group.title} className="space-y-3">
          <div>
            <h2 className="font-display text-xl font-black">{group.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={`${group.title}-${item.to}-${item.label}`} to={item.to as never} className="group block">
                  <Card className="h-full transition hover:border-brand/25 hover:bg-brand-soft/25">
                    <CardHeader className="pb-3">
                      <span className="mb-2 grid size-10 place-items-center rounded-xl bg-brand-soft text-brand"><Icon className="size-5" /></span>
                      <CardTitle className="text-base">{item.label}</CardTitle>
                      <CardDescription>{item.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0 text-sm font-semibold text-brand">Abrir →</CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
