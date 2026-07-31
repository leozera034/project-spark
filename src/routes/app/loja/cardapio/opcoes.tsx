import { createFileRoute } from "@tanstack/react-router";

import { OptionGroupLibrary } from "@/catalog/advanced/OptionGroupLibrary";

export const Route = createFileRoute("/app/loja/cardapio/opcoes")({
  head: () => ({
    meta: [
      { title: "Grupos de opções | Pediu Aqui" },
      {
        name: "description",
        content:
          "Crie grupos de opções reaproveitáveis: tamanhos, sabores, adicionais e complementos.",
      },
      { property: "og:title", content: "Grupos de opções | Pediu Aqui" },
      {
        property: "og:description",
        content: "Biblioteca de grupos de opções do cardápio da sua loja.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OpcoesPage,
});

function OpcoesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Biblioteca de opções</h2>
        <p className="text-sm text-muted-foreground">
          Um único motor genérico atende tamanhos, sabores, adicionais, complementos e escolhas
          obrigatórias. Vincule os grupos aos produtos na aba de configuração avançada.
        </p>
      </div>
      <OptionGroupLibrary />
    </div>
  );
}
