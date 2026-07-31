import { Link, createFileRoute } from "@tanstack/react-router";
import { Clock, MapPin, Search, ShoppingBasket, Store as StoreIcon } from "lucide-react";

import { StoreFooter } from "@/components/demo/StoreShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDemo } from "@/demo/state/useDemo";
import { demoHead } from "@/demo/utils/head";

export const Route = createFileRoute("/loja/mercado-aurora/")({
  head: demoHead(
    "Mercado Aurora — peça pelo cardápio digital",
    "Padaria, mercearia e refeições do Mercado Aurora com entrega no bairro ou retirada na loja.",
  ),
  component: StoreHome,
});

function StoreHome() {
  const { store, storeOpen } = useDemo();

  return (
    <div className="min-h-screen">
      <div
        className="px-4 pb-16 pt-10 text-center"
        style={{ backgroundColor: store.theme.surfaceHero }}
      >
        <p className="text-xs font-medium uppercase tracking-widest text-white/70">
          Cardápio digital
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white">{store.name}</h1>
        <p className="mt-2 text-sm text-white/80">{store.tagline}</p>
      </div>

      <main className="mx-auto -mt-10 max-w-3xl px-4">
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-e2">
          <div className="flex items-start gap-4">
            <div
              aria-hidden="true"
              className="flex size-16 shrink-0 items-center justify-center rounded-xl text-2xl font-bold text-brand-foreground"
              style={{ backgroundColor: store.theme.brand }}
            >
              MA
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-foreground">{store.name}</h2>
                <Badge variant={storeOpen ? "success" : "danger"}>
                  {storeOpen ? "Aberta agora" : "Fechada"}
                </Badge>
              </div>
              <p className="mt-1 text-base text-muted-foreground">{store.description}</p>
            </div>
          </div>

          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-2">
              <Clock aria-hidden="true" className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <dt className="text-sm font-medium text-foreground">Entrega em {store.etaDelivery}</dt>
                <dd className="text-sm text-muted-foreground">
                  Retirada pronta em {store.etaPickup}
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <StoreIcon aria-hidden="true" className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <dt className="text-sm font-medium text-foreground">
                  Aberta das {store.opensAt} às {store.closesAt}
                </dt>
                <dd className="text-sm text-muted-foreground">Todos os dias</dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <ShoppingBasket aria-hidden="true" className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <dt className="text-sm font-medium text-foreground">Entrega e retirada</dt>
                <dd className="text-sm text-muted-foreground">
                  Você escolhe como receber no próximo passo
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin aria-hidden="true" className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <dt className="text-sm font-medium text-foreground">{store.address}</dt>
                <dd className="text-sm text-muted-foreground">Telefone {store.phone}</dd>
              </div>
            </div>
          </dl>
        </section>

        <section className="mt-6">
          <label htmlFor="busca-inicial" className="text-sm font-medium text-foreground">
            O que você procura hoje?
          </label>
          <div className="relative mt-2">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="busca-inicial"
              className="h-12 pl-9 text-base"
              placeholder="Pão, marmita, café..."
            />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            A busca completa fica dentro do cardápio.
          </p>
        </section>

        <div className="mt-6 space-y-3">
          <Button asChild size="touch" variant="brand" className="w-full text-base">
            <Link to="/loja/mercado-aurora/identificacao">Ver o cardápio</Link>
          </Button>
          <Button asChild size="touch" variant="outline" className="w-full text-base">
            <Link to="/loja/mercado-aurora/cardapio">Só quero olhar os produtos</Link>
          </Button>
        </div>

        <StoreFooter />
      </main>
    </div>
  );
}
