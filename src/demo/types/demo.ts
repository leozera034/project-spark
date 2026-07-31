/**
 * Pediu Aqui — Fase 03 (protótipo navegável).
 *
 * Tipos exclusivos da camada de demonstração. Nada aqui representa o contrato
 * definitivo do banco de dados; a modelagem real será definida na Fase 04.
 */

export type Fulfillment = "entrega" | "retirada";

export type OrderStatus =
  | "novo"
  | "em_preparo"
  | "pronto"
  | "aguardando_entregador"
  | "saiu_para_entrega"
  | "aguardando_retirada"
  | "concluido"
  | "cancelado";

export type PaymentMethod = "pix_na_loja" | "dinheiro" | "cartao_na_entrega" | "pagamento_na_retirada";

export type ProductAvailability = "disponivel" | "esgotado" | "indisponivel";

export interface DemoStore {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  coverAlt: string;
  isOpen: boolean;
  opensAt: string;
  closesAt: string;
  etaDelivery: string;
  etaPickup: string;
  acceptsDelivery: boolean;
  acceptsPickup: boolean;
  minimumOrder: number;
  address: string;
  phone: string;
  /** Tokens de tema da loja (identidade da loja, não do Pediu Aqui). */
  theme: {
    brand: string;
    brandForeground: string;
    brandSoft: string;
    brandSoftForeground: string;
    surfaceHero: string;
  };
}

export interface DemoNeighborhood {
  id: string;
  name: string;
  deliveryFee: number;
  minimumOrder: number;
  etaMinutes: number;
}

export interface DemoCategory {
  id: string;
  name: string;
  storeId: string;
}

export interface DemoOptionItem {
  id: string;
  name: string;
  priceDelta: number;
}

export interface DemoOptionGroup {
  id: string;
  name: string;
  helper: string;
  required: boolean;
  min: number;
  max: number;
  items: DemoOptionItem[];
}

export interface DemoVariation {
  id: string;
  name: string;
  price: number;
}

export interface DemoProduct {
  id: string;
  storeId: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  availability: ProductAvailability;
  highlighted: boolean;
  active: boolean;
  unitLabel?: string;
  variations?: DemoVariation[];
  optionGroups?: DemoOptionGroup[];
}

export interface DemoAddress {
  id: string;
  label: "Casa" | "Trabalho" | "Outro";
  neighborhoodId: string;
  street: string;
  number: string;
  complement?: string;
  reference?: string;
}

export interface DemoCartLine {
  id: string;
  productId: string;
  productName: string;
  variationName?: string;
  optionNames: string[];
  quantity: number;
  note?: string;
  unitPrice: number;
}

export interface DemoOrderItem {
  name: string;
  quantity: number;
  options: string[];
  note?: string;
  unitPrice: number;
}

export interface DemoOrder {
  id: string;
  storeId: string;
  code: string;
  createdAt: string;
  placedMinutesAgo: number;
  customerName: string;
  customerPhone: string;
  fulfillment: Fulfillment;
  address?: DemoAddress;
  items: DemoOrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: PaymentMethod;
  changeFor?: number;
  note?: string;
  status: OrderStatus;
  courierId?: string;
  cancelReason?: string;
  late: boolean;
}

export type CourierDeliveryStatus =
  | "disponivel"
  | "aceita"
  | "coletada"
  | "em_rota"
  | "entregue"
  | "cancelada";

export interface DemoCourier {
  id: string;
  storeId: string;
  name: string;
  phone: string;
  vehicle: string;
  plate?: string;
  online: boolean;
  initials: string;
}

export interface DemoDelivery {
  id: string;
  orderCode: string;
  courierId: string;
  storeName: string;
  pickupAddress: string;
  neighborhood: string;
  deliveryAddress: string;
  note?: string;
  paymentLabel: string;
  approximateDistanceKm: number;
  status: CourierDeliveryStatus;
  incident?: string;
  finishedAt?: string;
  day: "hoje" | "semana" | "mes";
}

export type StoreRole = "proprietario" | "gerente" | "atendente" | "cozinha" | "entregador";

export interface DemoStoreUser {
  id: string;
  name: string;
  role: StoreRole;
  phone: string;
  active: boolean;
  lastAccess: string;
}

export interface DemoPlan {
  id: string;
  name: string;
  price: number;
  features: string[];
  active: boolean;
  storeCount: number;
}

export type InvoiceStatus = "pago" | "em_aberto" | "vencido" | "cortesia";

export interface DemoInvoice {
  id: string;
  storeName: string;
  competence: string;
  dueDate: string;
  amount: number;
  discount: number;
  status: InvoiceStatus;
  toleranceDays: number;
  paidAt?: string;
}

export type SaasStoreStatus = "ativa" | "suspensa" | "em_implantacao";

export interface DemoSaasStore {
  id: string;
  slug: string;
  name: string;
  owner: string;
  contact: string;
  status: SaasStoreStatus;
  planId: string;
  dueDate: string;
  menuPublished: boolean;
  ordersInPeriod: number;
}

export interface DemoAdminUser {
  id: string;
  name: string;
  environment: "loja" | "entregador" | "administrador";
  storeName: string;
  role: string;
  active: boolean;
  lastAccess: string;
}

export interface DemoAuditEntry {
  id: string;
  date: string;
  actor: string;
  role: string;
  action: string;
  entity: string;
  context: string;
  result: "sucesso" | "recusado";
  reason?: string;
}

export interface DemoSupportTicket {
  id: string;
  storeName: string;
  subject: string;
  openedAt: string;
  status: "aberto" | "em_analise" | "resolvido";
  summary: string;
}
