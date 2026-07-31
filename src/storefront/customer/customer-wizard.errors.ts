/**
 * Mensagens humanas. Nunca expor SQL, RPC, policy, stack, store_id ou JSON bruto.
 */
export const WIZARD_MESSAGES = {
  fulfillmentLoadFailed: "Não conseguimos carregar as opções de atendimento.",
  fulfillmentUnavailable: "Esta modalidade não está disponível agora.",
  areaUnavailable: "Este bairro não está mais disponível para entrega.",
  storageFailed: "Não foi possível salvar neste aparelho.",
  storageUnavailable:
    "Seus dados não poderão ser lembrados neste aparelho, mas você pode continuar normalmente.",
  reviewAddress: "Revise o endereço informado.",
  configurationChanged: "As opções de atendimento foram atualizadas. Revise sua escolha.",
  offline: "Você está sem conexão.",
  offlineDraftKept:
    "Seus dados foram preservados. Conecte-se à internet para confirmar as opções da loja.",
  rateLimited: "Muitas tentativas em pouco tempo. Aguarde um instante.",
  noFulfillment:
    "A loja não está recebendo pedidos no momento. Você ainda pode consultar o cardápio.",
  storeClosed:
    "A loja está fechada agora. Você pode consultar o cardápio, mas o envio do pedido será validado novamente quando estiver disponível.",
  unfinished: "Encontramos uma configuração que você ainda não terminou.",
  localOnly:
    "Salvamos estas informações apenas neste aparelho para facilitar seus próximos pedidos.",
} as const;

/** Traduz códigos técnicos do servidor para mensagens do cliente. */
export function messageForValidationError(code: string): string {
  switch (code) {
    case "AREA_UNAVAILABLE":
    case "AREA_REQUIRED":
      return WIZARD_MESSAGES.areaUnavailable;
    case "FULFILLMENT_UNAVAILABLE":
    case "FULFILLMENT_INVALID":
      return WIZARD_MESSAGES.fulfillmentUnavailable;
    case "CONFIGURATION_CHANGED":
      return WIZARD_MESSAGES.configurationChanged;
    case "RATE_LIMITED":
      return WIZARD_MESSAGES.rateLimited;
    default:
      return WIZARD_MESSAGES.fulfillmentLoadFailed;
  }
}
