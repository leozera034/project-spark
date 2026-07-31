import type {
  CourierDeliveryStatus,
  Fulfillment,
  InvoiceStatus,
  OrderStatus,
  PaymentMethod,
  ProductAvailability,
  SaasStoreStatus,
  StoreRole,
} from "../types/demo";

export const orderStatusLabel: Record<OrderStatus, string> = {
  novo: "Novo",
  em_preparo: "Em preparo",
  pronto: "Pronto",
  aguardando_entregador: "Aguardando entregador",
  saiu_para_entrega: "Saiu para entrega",
  aguardando_retirada: "Aguardando retirada",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export type ToneVariant = "brandSoft" | "success" | "warning" | "info" | "danger" | "secondary";

export const orderStatusTone: Record<OrderStatus, ToneVariant> = {
  novo: "info",
  em_preparo: "warning",
  pronto: "brandSoft",
  aguardando_entregador: "warning",
  saiu_para_entrega: "info",
  aguardando_retirada: "brandSoft",
  concluido: "success",
  cancelado: "danger",
};

export const fulfillmentLabel: Record<Fulfillment, string> = {
  entrega: "Entrega",
  retirada: "Retirada",
};

export const paymentLabel: Record<PaymentMethod, string> = {
  pix_na_loja: "Pix na loja",
  dinheiro: "Dinheiro",
  cartao_na_entrega: "Cartão na entrega",
  pagamento_na_retirada: "Pagamento na retirada",
};

export const availabilityLabel: Record<ProductAvailability, string> = {
  disponivel: "Disponível",
  esgotado: "Esgotado",
  indisponivel: "Indisponível",
};

export const deliveryStatusLabel: Record<CourierDeliveryStatus, string> = {
  disponivel: "Disponível",
  aceita: "Aceita",
  coletada: "Coletada",
  em_rota: "Em rota",
  entregue: "Entregue",
  cancelada: "Cancelada",
};

export const roleLabel: Record<StoreRole, string> = {
  proprietario: "Proprietário",
  gerente: "Gerente",
  atendente: "Atendente",
  cozinha: "Cozinha",
  entregador: "Entregador",
};

export const invoiceStatusLabel: Record<InvoiceStatus, string> = {
  pago: "Pago",
  em_aberto: "Em aberto",
  vencido: "Vencido",
  cortesia: "Cortesia",
};

export const invoiceStatusTone: Record<InvoiceStatus, ToneVariant> = {
  pago: "success",
  em_aberto: "info",
  vencido: "danger",
  cortesia: "secondary",
};

export const saasStoreStatusLabel: Record<SaasStoreStatus, string> = {
  ativa: "Ativa",
  suspensa: "Suspensa",
  em_implantacao: "Em implantação",
};

export const saasStoreStatusTone: Record<SaasStoreStatus, ToneVariant> = {
  ativa: "success",
  suspensa: "danger",
  em_implantacao: "info",
};
