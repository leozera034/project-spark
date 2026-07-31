import type { DemoAdminUser, DemoInvoice, DemoPlan, DemoSaasStore, DemoStoreUser } from "../types/demo";

export const demoStoreUsers: DemoStoreUser[] = [
  { id: "su-1", name: "Rita Aurora", role: "proprietario", phone: "(00) 00000-0000", active: true, lastAccess: "Hoje, 08:12" },
  { id: "su-2", name: "Paulo Menezes", role: "gerente", phone: "(00) 00000-0000", active: true, lastAccess: "Hoje, 09:40" },
  { id: "su-3", name: "Iara Lopes", role: "atendente", phone: "(00) 00000-0000", active: true, lastAccess: "Hoje, 11:05" },
  { id: "su-4", name: "Zeca Andrade", role: "cozinha", phone: "(00) 00000-0000", active: true, lastAccess: "Hoje, 10:50" },
  { id: "su-5", name: "Ana Ferreira", role: "entregador", phone: "(00) 00000-0000", active: false, lastAccess: "Ontem, 20:15" },
];

export const demoPlans: DemoPlan[] = [
  {
    id: "plan-essencial",
    name: "Essencial",
    price: 89,
    features: ["Cardápio digital", "Pedidos por entrega e retirada", "1 usuário administrador"],
    active: true,
    storeCount: 18,
  },
  {
    id: "plan-operacao",
    name: "Operação",
    price: 149,
    features: ["Tudo do Essencial", "Modo cozinha", "Equipe com papéis", "Entregadores próprios"],
    active: true,
    storeCount: 34,
  },
  {
    id: "plan-rede",
    name: "Rede",
    price: 249,
    features: ["Tudo do Operação", "Relatórios estendidos", "Atendimento prioritário"],
    active: false,
    storeCount: 4,
  },
];

export const demoSaasStores: DemoSaasStore[] = [
  {
    id: "store-aurora",
    slug: "mercado-aurora",
    name: "Mercado Aurora",
    owner: "Rita Aurora",
    contact: "(00) 00000-0000",
    status: "ativa",
    planId: "plan-operacao",
    dueDate: "10/08/2026",
    menuPublished: true,
    ordersInPeriod: 412,
  },
  {
    id: "store-bistro",
    slug: "bistro-das-dunas",
    name: "Bistrô das Dunas",
    owner: "Caio Prado",
    contact: "(00) 00000-0000",
    status: "ativa",
    planId: "plan-essencial",
    dueDate: "15/08/2026",
    menuPublished: true,
    ordersInPeriod: 168,
  },
  {
    id: "store-flor",
    slug: "floricultura-serena",
    name: "Floricultura Serena",
    owner: "Neusa Brito",
    contact: "(00) 00000-0000",
    status: "em_implantacao",
    planId: "plan-essencial",
    dueDate: "20/08/2026",
    menuPublished: false,
    ordersInPeriod: 0,
  },
  {
    id: "store-farma",
    slug: "farmacia-do-vale",
    name: "Farmácia do Vale",
    owner: "Elias Rocha",
    contact: "(00) 00000-0000",
    status: "suspensa",
    planId: "plan-operacao",
    dueDate: "02/07/2026",
    menuPublished: false,
    ordersInPeriod: 39,
  },
];

export const demoInvoices: DemoInvoice[] = [
  { id: "inv-1", storeName: "Mercado Aurora", competence: "07/2026", dueDate: "10/08/2026", amount: 149, discount: 0, status: "em_aberto", toleranceDays: 5 },
  { id: "inv-2", storeName: "Mercado Aurora", competence: "06/2026", dueDate: "10/07/2026", amount: 149, discount: 0, status: "pago", toleranceDays: 5, paidAt: "08/07/2026" },
  { id: "inv-3", storeName: "Bistrô das Dunas", competence: "07/2026", dueDate: "15/08/2026", amount: 89, discount: 10, status: "em_aberto", toleranceDays: 5 },
  { id: "inv-4", storeName: "Farmácia do Vale", competence: "06/2026", dueDate: "02/07/2026", amount: 149, discount: 0, status: "vencido", toleranceDays: 5 },
  { id: "inv-5", storeName: "Floricultura Serena", competence: "07/2026", dueDate: "20/08/2026", amount: 0, discount: 0, status: "cortesia", toleranceDays: 0 },
  { id: "inv-6", storeName: "Bistrô das Dunas", competence: "06/2026", dueDate: "15/07/2026", amount: 89, discount: 0, status: "pago", toleranceDays: 5, paidAt: "14/07/2026" },
];

export const demoAdminUsers: DemoAdminUser[] = [
  { id: "au-1", name: "Rita Aurora", environment: "loja", storeName: "Mercado Aurora", role: "Proprietário", active: true, lastAccess: "Hoje, 08:12" },
  { id: "au-2", name: "Paulo Menezes", environment: "loja", storeName: "Mercado Aurora", role: "Gerente", active: true, lastAccess: "Hoje, 09:40" },
  { id: "au-3", name: "Ana Ferreira", environment: "entregador", storeName: "Mercado Aurora", role: "Entregador", active: true, lastAccess: "Hoje, 11:22" },
  { id: "au-4", name: "Caio Prado", environment: "loja", storeName: "Bistrô das Dunas", role: "Proprietário", active: true, lastAccess: "Ontem, 21:03" },
  { id: "au-5", name: "Equipe Pediu Aqui", environment: "administrador", storeName: "—", role: "Administrador", active: true, lastAccess: "Hoje, 07:45" },
];
