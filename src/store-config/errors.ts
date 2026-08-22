/**
 * Tradução de códigos de erro do servidor para mensagens seguras.
 *
 * Nada de SQL, nome de constraint, nome de função, policy, stack ou ID de outra
 * loja chega ao lojista.
 */

const MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "Sua sessão expirou. Entre novamente para continuar.",
  FORBIDDEN: "Sua sessão não permite esta alteração.",
  STORE_SELECTION_REQUIRED: "Escolha a loja que deseja configurar.",
  NOT_FOUND: "Não encontramos este registro.",
  VERSION_CONFLICT:
    "Estas configurações foram atualizadas em outro acesso. Recarregamos a versão mais recente.",
  INVALID_NAME: "Revise o nome informado.",
  INVALID_DOCUMENT: "Revise o documento informado.",
  INVALID_PHONE: "Revise o telefone informado.",
  INVALID_EMAIL: "Revise o e-mail informado.",
  INVALID_TIMEZONE: "Revise o fuso horário informado.",
  INVALID_SLUG: "Revise o endereço público informado.",
  RESERVED_SLUG: "Este endereço é reservado pelo sistema.",
  SLUG_TAKEN: "Este endereço já está em uso.",
  INVALID_COLOR: "Revise as cores informadas.",
  INVALID_ASSET_PATH: "A imagem escolhida não é compatível.",
  INVALID_SLOT: "A imagem escolhida não é compatível.",
  INVALID_MIN_ORDER: "Revise o pedido mínimo informado.",
  INVALID_PREP_MINUTES: "Revise o tempo de preparo informado.",
  INVALID_HOURS: "Revise os horários informados.",
  EMPTY_SHIFT: "Revise os horários informados.",
  OVERLAPPING_SHIFTS: "Existem turnos sobrepostos. Revise os horários informados.",
  DUPLICATE_NEIGHBORHOOD: "Já existe um bairro com este nome.",
  INVALID_FEE: "Revise a taxa informada.",
  INVALID_ETA: "Revise o tempo estimado informado.",
  INVALID_ORDER: "Não foi possível reordenar a lista.",
  INVALID_AVAILABILITY: "Escolha ao menos entrega ou retirada para este método.",
  INVALID_INSTRUCTIONS: "Revise as instruções informadas.",
  STRIPE_CONNECT_NOT_READY: "Conclua primeiro o cadastro de recebimentos da Stripe para liberar pagamentos online.",
  ONLINE_PAYMENT_TERMS_REQUIRED: "Confirme que leu as informações sobre taxas e repasses antes de ativar pagamentos online.",
  PIX_KEY_REQUIRED: "Cadastre uma chave Pix antes de ativar o Pix direto para a loja.",
  INVALID_PIX_KEY: "Revise a chave Pix informada.",
  INVALID_PIX_KEY_TYPE: "Escolha um tipo válido para a chave Pix.",
  MANAGED_PAYMENT_METHOD: "Esse meio de pagamento é administrado pela central de recebimentos desta tela.",
  UPLOAD_INVALID_TYPE: "A imagem escolhida não é compatível. Use PNG, JPEG ou WebP.",
  UPLOAD_TOO_LARGE: "A imagem escolhida é grande demais.",
  UPLOAD_FAILED: "Não foi possível enviar a imagem.",
};

const GENERIC = "Não foi possível salvar as alterações.";

export function isConflictError(error: unknown): boolean {
  return extractCode(error) === "VERSION_CONFLICT";
}

export function extractCode(error: unknown): string | null {
  const raw =
    typeof error === "string"
      ? error
      : ((error as { message?: string } | null)?.message ?? "");
  const token = raw.trim().split(/\s|:/)[0]?.toUpperCase() ?? "";
  return token in MESSAGES ? token : null;
}

export function toFriendlyMessage(error: unknown): string {
  const code = extractCode(error);
  return code ? MESSAGES[code] : GENERIC;
}
