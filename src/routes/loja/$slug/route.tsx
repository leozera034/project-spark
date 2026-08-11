import { useState } from "react";
import { createFileRoute, notFound, Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { Store } from "lucide-react";
import { z } from "zod";

import { CustomerWizard } from "@/components/storefront/CustomerWizard";
import { ErrorState } from "@/components/feedback/ErrorState";
import { StorefrontSkeleton } from "@/components/feedback/Skeletons";
import {
  CustomerWizardProvider,
  useCustomerWizard,
} from "@/storefront/customer/customer-wizard.context";
import { CartProvider } from "@/storefront/cart/cart.context";
import { fetchStorefront } from "@/lib/storefront.functions";
import { OG_IMAGE_PATH, absoluteUrl, getSiteOrigin } from "@/lib/site.functions";


const searchSchema = z.object({
  /** Produto aberto na folha de montagem. */
  produto: z.string().uuid().optional(),
  /** Linha do carrinho em edição, quando a montagem veio do carrinho. */
  linha: z.string().max(64).optional(),
});

export const Route = createFileRoute("/loja/$slug")({
  validateSearch: searchSchema,
  loader: async ({ params }) => {
    try {
      const [storefront, origin] = await Promise.all([
        fetchStorefront({ data: { slug: params.slug } }),
        getSiteOrigin(),
      ]);
      return { ...storefront, origin };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("not_found")) throw notFound();
      throw error;
    }
  },
  head: ({ loaderData, params }) => {
    const name = loaderData?.store.store.name ?? "Cardápio digital";
    const city = loaderData?.store.store.city;
    const description =
      loaderData?.store.settings.description ??
      `Peça online no ${name}${city ? ` em ${city}` : ""}. Cardápio atualizado, entrega e retirada.`;
    const title = `${name} · Cardápio online`;
    const origin = loaderData?.origin ?? "";
    const url = absoluteUrl(origin, `/loja/${params.slug}`);
    const ogImage = absoluteUrl(origin, OG_IMAGE_PATH);
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { property: "og:image", content: ogImage },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:image:alt", content: `${name} — cardápio online` },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: ogImage },
        { name: "twitter:image:alt", content: `${name} — cardápio online` },
        { name: "robots", content: "index,follow" },
      ],
      links: [{ rel: "canonical", href: url }],

      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "LocalBusiness",
                name,
                description,
                url,
                ...(city ? { address: { "@type": "PostalAddress", addressLocality: city } } : {}),
                hasMenu: url,
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Início", item: "/" },
                  { "@type": "ListItem", position: 2, name, item: url },
                ],
              },
            ],
          }),
        },
      ],
    };
  },

  pendingComponent: StorefrontSkeleton,
  pendingMs: 200,
  pendingMinMs: 400,
  errorComponent: () => <StorefrontError />,
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
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  // O acompanhamento é aberto por link, muitas vezes em outro aparelho:
  // nunca pode exigir a jornada de identificação.
  if (pathname.endsWith("/acompanhar")) return <Outlet />;
  if (!orderingContext) return <CustomerWizard />;
  return <Outlet />;
}

/** Falha de carregamento do cardápio com caminho claro para tentar de novo. */
function StorefrontError() {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-6">
      <ErrorState
        title="Cardápio indisponível"
        description="Não conseguimos carregar esta loja agora. Verifique sua conexão e tente novamente."
        retrying={retrying}
        onRetry={() => {
          setRetrying(true);
          void router.invalidate().finally(() => setRetrying(false));
        }}
      />
    </main>
  );
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
