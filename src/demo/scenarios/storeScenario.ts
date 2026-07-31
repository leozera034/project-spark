import type { DemoScenario } from "./types";

export const storeScenario: DemoScenario = {
  id: "loja",
  title: "Painel da loja",
  goal: "Acompanhar e mover pedidos com clareza operacional, sem depender de gráficos.",
  audience: "Proprietário, gerente, atendente e cozinha.",
  device: "Notebook e tablet, com uso pontual no celular",
  entryRoute: "/preview/loja",
  steps: [
    "Início com o quadro operacional do dia",
    "Pedidos em colunas no desktop e em lista filtrada no celular",
    "Detalhes do pedido em painel lateral com ações demonstrativas",
    "Modo cozinha legível a distância",
    "Cardápio com estados de produto e telas de edição visual",
    "Entregadores da própria loja, sem qualquer dado financeiro",
    "Equipe, relatórios operacionais e configurações",
  ],
};
