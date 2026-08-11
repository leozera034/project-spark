import { AlertCircle } from "lucide-react";

/**
 * Região de alerta acessível para erros de autenticação.
 * Mantém exatamente as mensagens vindas de auth.errors.ts.
 */
export function AuthAlert({ message }: { message: string }) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger-soft px-3.5 py-3 text-sm text-danger"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}
