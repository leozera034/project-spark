import type { DemoScenario } from "./types";

export const courierScenario: DemoScenario = {
  id: "entregador",
  title: "Aplicativo do entregador",
  goal: "Executar a entrega com uma mão, poucos toques e confirmação protegida.",
  audience: "Entregador vinculado a uma única loja.",
  device: "Celular Android",
  entryRoute: "/preview/entregador",
  steps: [
    "Início com disponibilidade, entrega ativa e concluídas hoje",
    "Nova entrega com coleta, destino e distância aproximada",
    "Entrega ativa em etapas até a confirmação protegida",
    "Registro de ocorrência sem concluir a entrega",
    "Histórico por período",
    "Perfil sem qualquer módulo financeiro",
  ],
};
