import { createFileRoute, Link } from "@tanstack/react-router";

import { BrandLogo, BrandSymbol } from "@/components/brand/BrandLogo";
import { Reveal } from "@/components/motion/Reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { OG_IMAGE_PATH, absoluteUrl, getSiteOrigin } from "@/lib/site.functions";


export const Route = createFileRoute("/")({
  component: Index,
  loader: async () => ({ origin: await getSiteOrigin() }),
  head: ({ loaderData }) => {
    const origin = loaderData?.origin ?? "";
    const ogImage = absoluteUrl(origin, OG_IMAGE_PATH);
    const canonical = absoluteUrl(origin, "/");
    return {

    meta: [
      { title: "Pediu Aqui — cardápio digital e pedidos para o comércio de bairro" },
      {
        name: "description",
        content:
          "Cardápio digital, pedidos e entregas no seu próprio nome. Seus clientes pedem em poucos toques, sem app e sem cadastro — e cada venda continua sendo sua, do começo ao fim.",
      },
      { property: "og:title", content: "Pediu Aqui — venda mais no seu próprio cardápio digital" },
      {
        property: "og:description",
        content:
          "Monte seu cardápio digital, receba pedidos organizados e faça suas entregas com a sua própria equipe.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: canonical },
      { property: "og:image", content: ogImage },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      {
        property: "og:image:alt",
        content: "Pediu Aqui — seu cardápio digital, seus pedidos, sua entrega",
      },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: "Pediu Aqui — venda mais no seu próprio cardápio digital",
      },
      {
        name: "twitter:description",
        content:
          "Monte seu cardápio digital, receba pedidos organizados e faça suas entregas com a sua própria equipe.",
      },
      { name: "twitter:image", content: ogImage },
      {
        name: "twitter:image:alt",
        content: "Pediu Aqui — seu cardápio digital, seus pedidos, sua entrega",
      },
      { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: canonical }],

    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: "Pediu Aqui",
              url: "/",
              logo: "/brand/apple-touch-icon-180x180.png",
              description:
                "Plataforma de cardápio digital, pedidos e entregas para o comércio de bairro.",
            },
            {
              "@type": "WebSite",
              name: "Pediu Aqui",
              url: "/",
              inLanguage: "pt-BR",
            },
            {
              "@type": "SoftwareApplication",
              name: "Pediu Aqui",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              description:
                "Cardápio digital, pedidos e entregas no nome da própria loja, com equipe de entrega própria.",
            },
          ],
        }),
      },
    ],
    };
  },
});



const pillars = [
  {
    title: "Sua loja, seu nome, suas regras",
    text: "Você recebe um endereço só seu, com sua marca, seus produtos e suas taxas. Nada de disputar espaço com concorrente na mesma vitrine.",
  },
  {
    title: "Menos desistência no meio do caminho",
    text: "O cliente pede com o primeiro nome e o telefone. Sem app, sem senha, sem e-mail: menos passos até o pedido cair para você.",
  },
  {
    title: "Entrega no seu controle",
    text: "Seus entregadores são seus. Cada um enxerga apenas as entregas da sua loja e você acompanha tudo em tempo real, do aceite à porta do cliente.",
  },
];

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <BrandLogo className="h-7 sm:h-8" />
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/design-system">Design system</Link>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main>
        <section className="bg-carbon text-carbon-foreground">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:py-28">
            <Reveal as="span" className="inline-block">
              <Badge variant="brand">Feito para o comércio de bairro</Badge>
            </Reveal>
            <Reveal
              as="h1"
              delay={80}
              className="mt-6 max-w-3xl text-[clamp(2rem,7vw,3.75rem)] font-extrabold leading-[1.05] tracking-tight"
            >
              Seu cardápio online, seus pedidos, seus clientes.
            </Reveal>
            <Reveal as="p" delay={160} className="mt-6 max-w-2xl text-base opacity-80 sm:text-lg">
              Chega de anotar pedido no papel e perder venda por mensagem sem resposta. No Pediu
              Aqui você monta o cardápio, recebe os pedidos organizados e entrega com a sua própria
              equipe — sem comissão sobre a sua clientela.
            </Reveal>
            <Reveal
              delay={240}
              className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap"
            >
              <Button asChild variant="brand" size="touch" className="w-full sm:w-auto">
                <Link to="/design-system">Quero minha loja online</Link>
              </Button>
            </Reveal>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="grid gap-6 md:grid-cols-3">
            {pillars.map((pillar, index) => (
              <Reveal
                as="article"
                key={pillar.title}
                delay={index * 90}
                className="hover-lift group rounded-xl border border-border bg-surface p-6 shadow-e1"
              >
                <BrandSymbol
                  tone="teal"
                  className="size-8 transition-transform duration-300 ease-out group-hover:-translate-y-0.5 group-hover:scale-105"
                />
                <h2 className="mt-5 text-lg font-semibold">{pillar.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{pillar.text}</p>
              </Reveal>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 sm:px-6">
          <BrandLogo className="h-6 opacity-70" />
          <p className="text-xs text-muted-foreground">
            Pediu Aqui · a plataforma de pedidos do comércio de bairro
          </p>
        </div>
      </footer>
    </div>
  );
}
