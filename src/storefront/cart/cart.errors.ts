/**
 * Mensagens humanas do carrinho.
 * Nunca expor SQL, RPC, policy, stack, store_id ou JSON bruto.
 */
export const CART_MESSAGES = {
  quoteFailed: "Não conseguimos atualizar os valores do carrinho agora.",
  offline: "Você está sem conexão. Mostramos os últimos valores conhecidos.",
  rateLimited: "Muitas atualizações em pouco tempo. Aguarde um instante.",
  storageUnavailable:
    "Seu carrinho não poderá ser lembrado neste aparelho, mas você pode continuar normalmente.",
  soldOut: "Item esgotado. Remova para continuar.",
  unavailable: "Este item saiu do cardápio. Remova para continuar.",
  invalidConfiguration: "As opções deste item mudaram. Revise a montagem.",
  unpriceable: "Não conseguimos calcular o preço deste item agora.",
  priceChanged: "O preço deste item foi atualizado pela loja.",
  storeClosed: "A loja está fechada agora. Você pode montar o pedido e enviar quando reabrir.",
  minimumNotMet: "Pedido mínimo ainda não atingido.",
  fulfillmentChanged: "As opções de atendimento mudaram. Revise antes de continuar.",
  limitReached: "Seu carrinho atingiu o limite de itens.",
  cleared: "Carrinho esvaziado.",
} as const;

export function messageForLineStatus(status: string): string {
  switch (status) {
    case "sold_out":
      return CART_MESSAGES.soldOut;
    case "unavailable":
      return CART_MESSAGES.unavailable;
    case "invalid_configuration":
      return CART_MESSAGES.invalidConfiguration;
    case "unpriceable":
      return CART_MESSAGES.unpriceable;
    case "price_changed":
      return CART_MESSAGES.priceChanged;
    default:
      return CART_MESSAGES.quoteFailed;
  }
}
