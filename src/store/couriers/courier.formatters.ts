/**
 * Rótulos legíveis da gestão de entregadores.
 * Enum bruto nunca aparece na interface.
 */
import type { CourierListItem, CourierPresence } from "./courier.types";

/** Janela de presença espelhada do servidor (`private.courier_presence_window`). */
export const PRESENCE_WINDOW_MS = 150_000;

/** Presença derivada: intenção declarada mais sinal recente. */
export function derivePresence(
  onlineIntent: boolean,
  lastSeenAt: string | null,
  serverNow?: string | null,
): CourierPresence {
  if (!onlineIntent) return "offline";
  if (!lastSeenAt) return "sem_sinal";
  const reference = serverNow ? Date.parse(serverNow) : Date.now();
  if (Number.isNaN(reference)) return "online";
  return Date.parse(lastSeenAt) < reference - PRESENCE_WINDOW_MS ? "sem_sinal" : "online";
}

export const PRESENCE_LABEL: Record<CourierPresence, string> = {
  online: "Online",
  offline: "Offline",
  sem_sinal: "Sem sinal",
};

export function accountLabel(isActive: boolean): string {
  return isActive ? "Ativo" : "Inativo";
}

/** Disponível ≠ online. Disponível é ativo, elegível e sem entrega ativa. */
export function availabilityLabel(
  courier: CourierListItem,
): "Disponível" | "Ocupado" | "Indisponível" {
  if (courier.currentAssignment) return "Ocupado";
  if (!courier.isActive || !courier.canAcceptDeliveries) return "Indisponível";
  return "Disponível";
}

export const DELIVERY_STATUS_LABEL: Record<string, string> = {
  pendente: "Sem responsável",
  atribuida: "Atribuída",
  aceita: "Aceita",
  coletada: "Coletada",
  em_rota: "Em rota",
  concluida: "Entregue",
  cancelada: "Cancelada",
};

export const OCCURRENCE_LABEL: Record<string, string> = {
  customer_not_found: "Cliente não encontrado",
  incorrect_address: "Endereço incorreto",
  customer_asked_to_wait: "Cliente pediu para aguardar",
  order_problem: "Problema com o pedido",
  vehicle_problem: "Problema com o veículo",
  other: "Outro motivo",
};

export const DECLINE_REASON_LABEL: Record<string, string> = {
  unavailable: "Não estou disponível",
  vehicle_problem: "Problema com o veículo",
  cannot_reach_store: "Não consigo chegar à loja",
  personal_issue: "Motivo pessoal",
  other: "Outro motivo",
};

export const REASSIGN_REASON_LABEL: Record<string, string> = {
  courier_unavailable: "Entregador indisponível",
  courier_declined: "Entregador recusou",
  vehicle_problem: "Problema com o veículo",
  operational: "Decisão operacional",
  other: "Outro motivo",
};

export const BLOCKING_REASON_LABEL: Record<string, string> = {
  conta_inativa: "Conta inativa",
  sem_permissao_de_aceite: "Não pode aceitar entregas",
  entrega_ativa: "Já possui entrega ativa",
  offline: "Offline agora",
};

export function relativeTime(value: string | null): string {
  if (!value) return "sem registro";
  const diff = Date.now() - Date.parse(value);
  if (Number.isNaN(diff)) return "sem registro";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.floor(hours / 24)} d`;
}
