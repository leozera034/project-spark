import { createFileRoute } from "@tanstack/react-router";

import { OptionGroupLibrary } from "@/catalog/advanced/OptionGroupLibrary";
import { PageHeader } from "@/components/catalog/PageHeader";

export const Route = createFileRoute("/app/loja/cardapio/opcoes")({
  head: () => ({
    meta: [
      { title: "Opções e adicionais | Comandiva" },
      { name: "description", content: "Crie tamanhos, sabores, adicionais e complementos para os produtos da loja." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OpcoesPage,
});

function OpcoesPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Opções e adicionais"
        description="Crie escolhas que podem ser reaproveitadas em vários produtos, como tamanhos, sabores, molhos e complementos."
      />
      <OptionGroupLibrary />
    </div>
  );
}
