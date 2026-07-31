import { Link, createFileRoute } from "@tanstack/react-router";
import { Bike, RotateCcw, ShieldCheck, Store, ShoppingBag, Palette } from "lucide-react";
import { toast } from "sonner";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { adminScenario } from "@/demo/scenarios/adminScenario";
import { courierScenario } from "@/demo/scenarios/courierScenario";
import { customerScenario } from "@/demo/scenarios/customerScenario";
import { storeScenario } from "@/demo/scenarios/storeScenario";
import type { DemoScenario } from "@/demo/scenarios/types";
import { DEMO_VERSION } from "@/demo/state/DemoProvider";
import { useDemo } from "@/demo/state/useDemo";
import { demoHead } from "@/demo/utils/head";

export const Route = createFileRoute("/preview/")({
  head: demoHead(
    "Central de preview — Pediu Aqui",
    "Protótipo navegável dos quatro ambientes do Pediu Aqui com dados fictícios.",
  ),
  component: PreviewHome,
});

const ICONS = {
  cliente: ShoppingBag,
  loja: Store,
  entregador: Bike,
  admin: ShieldCheck,
} as const;

const SCENARIOS: DemoScenario[] = [customerScenario, storeScenario, courierScenario, adminScenario];

function PreviewHome() {
  const { resetDemo } = useDemo();

  return (
    <div className="min-h-screen bg-background">
      <DemoBanner />
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-6">
          <div className="flex items-center gap-3">
            <BrandLogo lockup="horizontal" tone="carbon" className="h-7" />
            <Badge variant="brandSoft">Fase 03</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="gap-2">
              <Link to="/design-system">
                <Palette aria-hidden="true" />
                Design system
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                resetDemo();
                toast.success("Protótipo reiniciado", {
                  description: "Todos os estados voltaram ao ponto inicial da demonstração.",
                });
              }}
            >
              <RotateCcw aria-hidden="true" />
              Reiniciar demonstração
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Protótipo navegável — todos os dados são fictícios
        </h1>
        <p className="mt-3 max-w-2xl text-base text-muted-foreground">
          Quatro ambientes para validar jornadas, linguagem e hierarquia visual antes de qualquer
          implementação de banco de dados, autenticação ou integração.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {SCENARIOS.map((scenario) => {
            const Icon = ICONS[scenario.id as keyof typeof ICONS];
            return (
              <Card key={scenario.id} className="flex flex-col border-border bg-surface shadow-e1">
                <CardHeader>
                  <div className="flex size-10 items-center justify-center rounded-lg bg-brand-soft text-brand-soft-foreground">
                    <Icon aria-hidden="true" className="size-5" />
                  </div>
                  <CardTitle className="mt-3 text-xl">{scenario.title}</CardTitle>
                  <CardDescription className="text-sm">{scenario.goal}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto space-y-4">
                  <dl className="space-y-1 text-sm">
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground">Usuário:</dt>
                      <dd className="text-foreground">{scenario.audience}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground">Dispositivo prioritário:</dt>
                      <dd className="text-foreground">{scenario.device}</dd>
                    </div>
                  </dl>
                  <Button asChild size="touch" variant="brand" className="w-full">
                    <Link to={scenario.entryRoute}>Abrir demonstração</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="mt-10 text-xs text-muted-foreground">
          {DEMO_VERSION} · Esta central não aparece no cardápio público nem em menus de produção.
        </p>
      </main>
    </div>
  );
}
