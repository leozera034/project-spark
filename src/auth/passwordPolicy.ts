/**
 * Política de senha aplicada no cliente apenas como orientação.
 * A validação definitiva é do provedor de autenticação, no servidor.
 */

export const PASSWORD_MIN_LENGTH = 8;

export function describePasswordPolicy(): string {
  return `Use pelo menos ${PASSWORD_MIN_LENGTH} caracteres, com letras e números.`;
}

export function validatePassword(password: string): { valid: boolean; message: string } {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, message: describePasswordPolicy() };
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return { valid: false, message: describePasswordPolicy() };
  }
  return { valid: true, message: "" };
}
