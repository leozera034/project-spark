import type { DemoScenario } from "./types";

export const customerScenario: DemoScenario = {
  id: "cliente",
  title: "Experiência do cliente",
  goal: "Pedir sem criar conta, com poucas decisões por tela e confirmação explícita do endereço.",
  audience: "Pessoa da vizinhança, qualquer idade, primeira compra ou recompra.",
  device: "Celular",
  entryRoute: "/loja/mercado-aurora",
  steps: [
    "Página inicial da loja com status, prazos e acesso ao cardápio",
    "Identificação apenas pelo primeiro nome",
    "Escolha entre entrega e retirada",
    "Confirmação obrigatória do endereço salvo",
    "Cadastro de novo endereço em etapas",
    "Cardápio com categorias, destaques e produtos indisponíveis",
    "Detalhe do produto com variações e grupos de opções",
    "Carrinho, checkout e confirmação",
    "Acompanhamento do pedido para entrega e para retirada",
  ],
};
