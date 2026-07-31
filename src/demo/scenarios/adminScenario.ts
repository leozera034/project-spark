import type { DemoScenario } from "./types";

export const adminScenario: DemoScenario = {
  id: "admin",
  title: "Painel administrativo",
  goal: "Administrar lojas, planos e mensalidades do SaaS, sem despachar entregas.",
  audience: "Equipe Pediu Aqui.",
  device: "Desktop",
  entryRoute: "/preview/admin",
  steps: [
    "Dashboard institucional com lojas, volume e alertas",
    "Lista de lojas com ativação, suspensão e reativação",
    "Detalhes da loja com plano, usuários e histórico",
    "Planos e mensalidades demonstrativos",
    "Usuários, auditoria e suporte",
  ],
};
