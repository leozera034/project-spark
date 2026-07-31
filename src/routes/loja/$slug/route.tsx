import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Store } from "lucide-react";
import { z } from "zod";

import { CustomerWizard } from "@/components/storefront/CustomerWizard";
import {
  CustomerWizardProvider,
  useCustomerWizard,
} from "@/storefront/customer/customer-wizard.context";
import { CartProvider } from "@/storefront/cart/cart.context";
import { fetchStorefront } from "@/lib/storefront.functions";

const searchSchema = z.object({
  /** Produto aberto na folha de montagem. */
  produto: z.string().uuid().optional(),
  /** Linha do carrinho em edição, quando a montagem veio do carrinho. */
  linha: z.string().max(64).optional(),
});

export const Route = createFileRoute("/loja/$slug")({
  validateSearch: searchSchema,
  loader: async ({ params }) => fetchStorefront({ data: { slug: params.slug } }),
  head: ({ loaderData, params }) => {
    const name = loaderData?.store.store.name ?? "Cardápio digital";
    const city = loaderData?.store.store.city;
    const description =
      loaderData?.store.settings.description ??
      `Peça online no ${name}${city ? ` em ${city}` : ""}. Cardápio atualizado, entrega e retirada.`;
    const title = `${name} · Cardápio online`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "robots", content: "index,follow" },
      ],
      links: [{ rel: "canonical", href: `/loja/${params.slug}` }],
    };
  },
  errorComponent: () => (
    <CenteredMessage
      title="Cardápio indisponível"
      body="Não conseguimos carregar esta loja agora. Tente novamente em instantes."
    />
  ),
  notFoundComponent: () => (
    <CenteredMessage
      title="Loja não encontrada"
      body="O endereço acessado não corresponde a nenhuma loja ativa."
    />
  ),
  component: StorefrontLayout,
});

/**
 * O wizard sempre precede o cardápio: sem contexto confirmado nesta sessão,
 * a loja não é exibida para pedido. O carrinho vive acima das telas para
 * sobreviver à navegação entre cardápio, item e carrinho.
 */
function StorefrontLayout() {
  const { slug } = Route.useParams();
  return (
    <CustomerWizardProvider slug={slug}>
      <CartProvider slug={slug}>
        <StorefrontGate />
      </CartProvider>
    </CustomerWizardProvider>
  );
}

function StorefrontGate() {
  const { orderingContext } = useCustomerWizard();
  if (!orderingContext) return <CustomerWizard />;
  return <Outlet />;
}

function CenteredMessage({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <Store className="size-10 text-muted-foreground" />
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{body}</p>
    </main>
  );
}
