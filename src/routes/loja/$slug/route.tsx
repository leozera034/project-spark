import { useState } from "react";
import { createFileRoute, notFound, Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { Store } from "lucide-react";
import { z } from "zod";

import { ThemedCustomerWizard } from "@/components/storefront/ThemedCustomerWizard";
import { ErrorState } from "@/components/feedback/ErrorState";
import { StorefrontSkeleton } from "@/components/feedback/Skeletons";
import {
  CustomerWizardProvider,
  useCustomerWizard,
} from "@/storefront/customer/customer-wizard.context";
import { CartProvider } from "@/storefront/cart/cart.context";
import { getDefaultStoreBanner } from "@/storefront/default-banners";
import {
  loadStorefrontFromBrowser,
  PublicStorefrontClientError,
} from "@/storefront/public-edge.client";
import { OG_IMAGE_PATH, absoluteUrl } from "@/lib/site.functions";

const searchSchema = z.object({
  /** Produto aberto na folha de montagem. */
  produto: z.string().uuid().optional(),
  /** Linha do carrinho em edição, quando a montagem veio do carrinho. */
  linha: z.string().max(64).optional(),
});

export const Route = createFileRoute("/loja/$slug")({
  ssr: false,
  validateSearch: searchSchema,
  loader: async ({ params }) => {
    try {
      const storefront = await loadStorefrontFromBrowser(params.slug);
      const origin = typeof window !== "undefined" ? window.location.origin : "";

      const settings = storefront.store.settings;
      if (!settings.cover_url) {
        settings.cover_url = getDefaultStoreBanner(storefront.store.store.segment);
      }

      return { ...storefront, origin };
    } catch (error) {
      if (error instanceof PublicStorefrontClientError && error.code === "not_found") {
        throw notFound();
      }
      throw error;
    }
  },
  head: ({ loaderData, params }) => {
    const storeData = loaderData?.store.store;
    const settings = loaderData?.store.settings;
    const name = storeData?.name ?? "Cardápio digital";
    const city = storeData?.city;
    const state = storeData?.state;
    const segment = storeData?.segment;
    const description =
      settings?.description ??
      `Peça online no ${name}${city ? ` em ${city}` : ""}. Veja o cardápio atualizado, escolha entrega ou retirada e faça seu pedido pelo celular.`;
    const title = `${name} · Cardápio online${city ? ` em ${city}` : ""}`;
    const origin = loaderData?.origin ?? "";
    const url = absoluteUrl(origin, `/loja/${params.slug}`);
    const imageSource = settings?.cover_url || settings?.logo_url || OG_IMAGE_PATH;
    const ogImage = absoluteUrl(origin, imageSource);
    const logo = settings?.logo_url ? absoluteUrl(origin, settings.logo_url) : undefined;
    const siteHome = absoluteUrl(origin, "/");
    const imageAlt = `${name} — cardápio online${city ? ` em ${city}` : ""}`;

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:site_name", content: "Comandiva" },
        { property: "og:locale", content: "pt_BR" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { property: "og:image", content: ogImage },
        { property: "og:image:secure_url", content: ogImage },
        { property: "og:image:alt", content: imageAlt },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: ogImage },
        { name: "twitter:image:alt", content: imageAlt },
        { name: "robots", content: "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" },
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
                "@id": `${url}#business`,
                name,
                description,
                url,
                image: ogImage,
                ...(logo ? { logo } : {}),
                ...(segment ? { category: segment } : {}),
                ...(city || state
                  ? {
                      address: {
                        "@type": "PostalAddress",
                        ...(city ? { addressLocality: city } : {}),
                        ...(state ? { addressRegion: state } : {}),
                        addressCountry: "BR",
                      },
                    }
                  : {}),
                hasMenu: url,
                potentialAction: {
                  "@type": "OrderAction",
                  target: url,
                },
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Comandiva", item: siteHome },
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
  const { store } = Route.useLoaderData();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  // O acompanhamento é aberto por link, muitas vezes em outro aparelho:
  // nunca pode exigir a jornada de identificação.
  if (pathname.endsWith("/acompanhar")) return <Outlet />;
  if (!orderingContext) return <ThemedCustomerWizard segment={store.store.segment} />;
  return <Outlet />;
}

/** Falha de carregamento do cardápio com caminho claro para tentar de novo. */
function StorefrontError() {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  return (
    <main className="storefront-global mx-auto flex min-h-svh max-w-md flex-col justify-center px-6">
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
    <main className="storefront-global mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <Store className="size-10 text-muted-foreground" />
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{body}</p>
    </main>
  );
}
