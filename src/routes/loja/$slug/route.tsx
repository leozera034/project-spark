import { useState } from "react";
import { createFileRoute, notFound, Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, Store } from "lucide-react";
import { z } from "zod";

import { CustomerWizard } from "@/components/storefront/CustomerWizard";
import { ErrorState } from "@/components/feedback/ErrorState";
import { StorefrontSkeleton } from "@/components/feedback/Skeletons";
import { CustomerWizardProvider, useCustomerWizard } from "@/storefront/customer/customer-wizard.context";
import { CartProvider } from "@/storefront/cart/cart.context";
import { fetchStorefront } from "@/lib/storefront.functions";
import { OG_IMAGE_PATH, absoluteUrl, getSiteOrigin } from "@/lib/site.functions";

const searchSchema = z.object({
  produto: z.string().uuid().optional(),
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
    const description = loaderData?.store.settings.description ?? `Peça online no ${name}${city ? ` em ${city}` : ""}. Cardápio atualizado, entrega e retirada.`;
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
              { "@type": "LocalBusiness", name, description, url, ...(city ? { address: { "@type": "PostalAddress", addressLocality: city } } : {}), hasMenu: url },
              { "@type": "BreadcrumbList", itemListElement: [
                { "@type": "ListItem", position: 1, name: "Início", item: "/" },
                { "@type": "ListItem", position: 2, name, item: url },
              ] },
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
  notFoundComponent: () => <CenteredMessage title="Loja não encontrada" body="O endereço acessado não corresponde a nenhuma loja ativa." />,
  component: StorefrontLayout,
});

function StorefrontLayout() {
  const { slug } = Route.useParams();
  return (
    <CustomerWizardProvider slug={slug}>
      <CartProvider slug={slug}><StorefrontGate /></CartProvider>
    </CustomerWizardProvider>
  );
}

function StorefrontGate() {
  const { orderingContext } = useCustomerWizard();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname.endsWith("/acompanhar")) return <Outlet />;
  if (!orderingContext) return <CustomerWizard />;
  return <Outlet />;
}

function StorefrontError() {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  return (
    <main className="pa-commerce-page grid min-h-svh place-items-center px-5 py-12">
      <div className="w-full max-w-lg">
        <ErrorState
          title="Cardápio temporariamente indisponível"
          description="Não conseguimos carregar esta loja agora. Sua conexão pode ter oscilado ou o serviço pode estar se recuperando."
          retrying={retrying}
          onRetry={() => { setRetrying(true); void router.invalidate().finally(() => setRetrying(false)); }}
        />
      </div>
    </main>
  );
}

function CenteredMessage({ title, body }: { title: string; body: string }) {
  return (
    <main className="pa-commerce-page grid min-h-svh place-items-center px-5 py-12">
      <section className="pa-commerce-card w-full max-w-lg p-8 text-center sm:p-10">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#071318]/5 text-[#778186]"><Store className="size-5" /></div>
        <p className="mt-5 text-[10px] font-black uppercase tracking-[.14em] text-[#0d9f91]">Pediu Aqui</p>
        <h1 className="pa-display mt-2 text-2xl font-bold">{title}</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#778186]">{body}</p>
        <a href="/" className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#071318]/10 px-4 text-sm font-bold transition hover:bg-[#071318]/4"><ArrowLeft className="size-4" /> Voltar ao início</a>
      </section>
    </main>
  );
}
