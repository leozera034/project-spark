import { createFileRoute } from "@tanstack/react-router";

import { GlobalLanding } from "@/components/marketing/GlobalLanding";
import { OG_IMAGE_PATH, absoluteUrl, getSiteOrigin } from "@/lib/site.functions";

export const Route = createFileRoute("/")({
  component: GlobalLanding,
  loader: async () => ({ origin: await getSiteOrigin() }),
  head: ({ loaderData }) => {
    const origin = loaderData?.origin ?? "";
    const ogImage = absoluteUrl(origin, OG_IMAGE_PATH);
    const canonical = absoluteUrl(origin, "/");
    return {
      meta: [
        { title: "Pediu Aqui — cardápio, pedidos, cozinha e entregas em um só lugar" },
        {
          name: "description",
          content:
            "Plataforma para comércio local vender com cardápio digital, receber pedidos, organizar a cozinha e administrar entregas em um único fluxo.",
        },
        { property: "og:title", content: "Pediu Aqui — sua operação digital, do pedido à entrega" },
        {
          property: "og:description",
          content: "Cardápio online, pedidos, cozinha, entregas e gestão para negócios locais.",
        },
        { property: "og:image", content: ogImage },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: ogImage },
      ],
      links: [{ rel: "canonical", href: canonical }],
    };
  },
});
