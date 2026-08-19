export type WhatsAppProviderCode =
  | "meta_whatsapp"
  | "360dialog_whatsapp"
  | "twilio_whatsapp";

export type WhatsAppDeliveryStatus =
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "cancelled"
  | "blocked";

export interface WhatsAppTemplateSendRequest {
  to: string;
  templateName: string;
  language: string;
  variables: Record<string, string | number | boolean>;
  idempotencyKey: string;
}

export interface WhatsAppTemplateSendResult {
  providerMessageId: string;
  status: Extract<WhatsAppDeliveryStatus, "sent" | "queued">;
  providerCostMicros?: number;
  rawStatus?: string;
}

/**
 * Contrato único do Comandiva para providers de WhatsApp.
 * Credenciais nunca entram aqui nem no client bundle; implementações concretas
 * devem buscá-las apenas no backend por credential_ref/secret store.
 */
export interface WhatsAppProvider {
  readonly code: WhatsAppProviderCode;
  sendTemplate(request: WhatsAppTemplateSendRequest): Promise<WhatsAppTemplateSendResult>;
}

export class WhatsAppProviderError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "WhatsAppProviderError";
  }
}
