import type { DemoAuditEntry, DemoSupportTicket } from "../types/demo";

export const demoAudit: DemoAuditEntry[] = [
  { id: "aud-1", date: "30/07/2026 09:12", actor: "R. A.", role: "Proprietário", action: "Atualizou horário de funcionamento", entity: "Loja", context: "Mercado Aurora", result: "sucesso" },
  { id: "aud-2", date: "30/07/2026 09:40", actor: "P. M.", role: "Gerente", action: "Recusou pedido", entity: "Pedido A-1038", context: "Mercado Aurora", result: "sucesso", reason: "Item esgotado no estoque" },
  { id: "aud-3", date: "30/07/2026 10:05", actor: "Equipe Pediu Aqui", role: "Administrador", action: "Suspendeu loja", entity: "Loja", context: "Farmácia do Vale", result: "sucesso", reason: "Mensalidade vencida além da tolerância" },
  { id: "aud-4", date: "30/07/2026 10:32", actor: "I. L.", role: "Atendente", action: "Atribuiu entregador", entity: "Pedido A-1042", context: "Mercado Aurora", result: "sucesso" },
  { id: "aud-5", date: "30/07/2026 10:58", actor: "A. F.", role: "Entregador", action: "Registrou ocorrência", entity: "Entrega A-0975", context: "Mercado Aurora", result: "sucesso", reason: "Cliente pediu para aguardar" },
  { id: "aud-6", date: "30/07/2026 11:04", actor: "C. P.", role: "Proprietário", action: "Tentou acessar outra loja", entity: "Loja", context: "Mercado Aurora", result: "recusado", reason: "Fora do escopo da loja do usuário" },
  { id: "aud-7", date: "30/07/2026 11:20", actor: "Equipe Pediu Aqui", role: "Administrador", action: "Registrou pagamento", entity: "Mensalidade 06/2026", context: "Bistrô das Dunas", result: "sucesso" },
  { id: "aud-8", date: "30/07/2026 11:47", actor: "Z. A.", role: "Cozinha", action: "Marcou pedido como pronto", entity: "Pedido A-1040", context: "Mercado Aurora", result: "sucesso" },
];

export const demoSupportTickets: DemoSupportTicket[] = [
  { id: "sup-1", storeName: "Farmácia do Vale", subject: "Cardápio indisponível após suspensão", openedAt: "29/07/2026", status: "em_analise", summary: "Responsável pediu orientação sobre a regularização da mensalidade." },
  { id: "sup-2", storeName: "Mercado Aurora", subject: "Dúvida sobre taxa por bairro", openedAt: "28/07/2026", status: "resolvido", summary: "Orientação enviada sobre o cadastro de bairros e taxas." },
  { id: "sup-3", storeName: "Floricultura Serena", subject: "Apoio na publicação do primeiro cardápio", openedAt: "27/07/2026", status: "aberto", summary: "Implantação em andamento, aguardando fotos dos produtos." },
];
