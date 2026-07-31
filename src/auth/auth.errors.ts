/**
 * Mapeador central de erros de autenticação.
 * O usuário final nunca recebe mensagem técnica, status bruto, JSON,
 * nome de função, e-mail sintético ou resposta do provedor.
 */

export const AUTH_MESSAGES = {
  signInFailed: "Não foi possível entrar. Confira os dados e tente novamente.",
  courierSignInFailed: "Identificador ou senha inválidos.",
  sessionEnded: "Sua sessão terminou. Entre novamente.",
  recoveryFailed: "Não conseguimos concluir a recuperação agora.",
  linkInvalid: "Este link não é mais válido.",
  passwordsDiffer: "As senhas não são iguais.",
  weakPassword: "Escolha uma senha mais segura.",
  offline: "Você está sem conexão.",
  noAccess: "Seu acesso não está disponível no momento. Fale com o responsável pela sua conta.",
  recoverySent:
    "Se houver uma conta vinculada a este e-mail, enviaremos as instruções de recuperação.",
} as const;

export class AuthFlowError extends Error {
  constructor(public readonly userMessage: string) {
    super(userMessage);
    this.name = "AuthFlowError";
  }
}

function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/** Converte qualquer erro em mensagem segura para o usuário. */
export function mapAuthError(
  error: unknown,
  fallback: string = AUTH_MESSAGES.signInFailed,
): string {
  if (isOffline()) return AUTH_MESSAGES.offline;
  if (error instanceof AuthFlowError) return error.userMessage;

  const raw = error instanceof Error ? error.message : "";
  if (/expired|invalid_token|otp_expired|token/i.test(raw)) return AUTH_MESSAGES.linkInvalid;
  if (/weak.?password|should be at least/i.test(raw)) return AUTH_MESSAGES.weakPassword;
  if (/fetch|network/i.test(raw)) return AUTH_MESSAGES.offline;
  return fallback;
}

/** Registro técnico sanitizado: sem dados pessoais, sem token, sem senha. */
export function logAuthFailure(scope: string): void {
  console.warn(`[auth] falha no fluxo: ${scope}`);
}
