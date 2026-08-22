/**
 * Mensagens humanas do checkout. Nenhum detalhe técnico chega ao cliente.
 */
export const CHECKOUT_MESSAGES = {
  offline: "Você está sem conexão. Reconecte para enviar o pedido.",
  rateLimited: "Muitas tentativas seguidas. Aguarde alguns segundos e tente de novo.",
  failed: "Não conseguimos enviar o pedido agora. Tente novamente.",
  storeClosed: "A loja fechou enquanto você finalizava. O pedido não foi enviado.",
  fulfillmentInvalid:
    "A entrega ou o bairro mudaram. Revise o endereço e a modalidade antes de enviar.",
  paymentInvalid: "Esta forma de pagamento não está mais disponível. Escolha outra.",
  changeInvalid: "Informe um valor de troco válido.",
  minimumNotMet: "O subtotal ficou abaixo do pedido mínimo desta área.",
  phoneInvalid: "Informe um telefone válido com DDD.",
  nameInvalid: "Informe seu primeiro nome.",
  cartEmpty: "Seu carrinho está vazio.",
  cartTooLarge: "Seu carrinho tem itens demais. Remova alguns para continuar.",
  lineUnavailable: "Um item mudou de disponibilidade. Volte ao carrinho e revise.",
  conflict: "Este envio já foi feito com dados diferentes. Recarregue o carrinho e tente de novo.",
  addressInvalid: "Confirme o endereço de entrega antes de enviar.",
} as const;

export function messageForCheckoutError(code: string): string {
  switch (code) {
    case "offline":
      return CHECKOUT_MESSAGES.offline;
    case "rate_limited":
      return CHECKOUT_MESSAGES.rateLimited;
    case "store_closed":
      return CHECKOUT_MESSAGES.storeClosed;
    case "fulfillment_invalid":
      return CHECKOUT_MESSAGES.fulfillmentInvalid;
    case "payment_method_invalid":
      return CHECKOUT_MESSAGES.paymentInvalid;
    case "change_invalid":
      return CHECKOUT_MESSAGES.changeInvalid;
    case "minimum_not_met":
      return CHECKOUT_MESSAGES.minimumNotMet;
    case "phone_invalid":
      return CHECKOUT_MESSAGES.phoneInvalid;
    case "name_invalid":
      return CHECKOUT_MESSAGES.nameInvalid;
    case "cart_empty":
      return CHECKOUT_MESSAGES.cartEmpty;
    case "cart_too_large":
      return CHECKOUT_MESSAGES.cartTooLarge;
    case "line_unavailable":
      return CHECKOUT_MESSAGES.lineUnavailable;
    case "idempotency_conflict":
      return CHECKOUT_MESSAGES.conflict;
    case "address_invalid":
      return CHECKOUT_MESSAGES.addressInvalid;
    default:
      return CHECKOUT_MESSAGES.failed;
  }
}
