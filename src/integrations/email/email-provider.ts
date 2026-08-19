export type EmailProviderCode = "resend";

export type TransactionalEmailStatus =
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "bounced"
  | "complained"
  | "failed"
  | "suppressed"
  | "cancelled";

export interface EmailProviderHealth {
  provider: EmailProviderCode;
  configured: boolean;
  connected: boolean;
  sendingDomain: string | null;
  domainVerified: boolean;
  webhookConfigured: boolean;
  checkedAt: string;
  errorCode?: string | null;
}

export interface TransactionalEmailRequest {
  outboundEmailId: string;
  storeId: string;
  to: {
    email: string;
    name?: string | null;
  };
  from: {
    email: string;
    name: string;
  };
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
  tags?: Array<{ name: string; value: string }>;
}

export interface TransactionalEmailSendResult {
  provider: EmailProviderCode;
  providerEmailId: string;
  accepted: boolean;
  providerCostMicros: number;
}

export interface EmailDeliveryUpdate {
  provider: EmailProviderCode;
  providerEventId: string;
  providerEmailId: string | null;
  eventType:
    | "email.sent"
    | "email.delivered"
    | "email.bounced"
    | "email.complained"
    | "email.failed"
    | "email.suppressed"
    | "email.opened"
    | "email.clicked"
    | string;
  occurredAt: string;
  recipientEmail?: string | null;
  reason?: string | null;
}

/**
 * Provider-neutral boundary for outbound email.
 *
 * Provider credentials must never be passed from the browser or persisted in
 * public tables. Implementations are server-only and should fail closed when
 * the configured sender domain, API key or webhook verification is missing.
 */
export interface EmailProvider {
  readonly code: EmailProviderCode;
  healthCheck(): Promise<EmailProviderHealth>;
  sendTransactional(request: TransactionalEmailRequest): Promise<TransactionalEmailSendResult>;
  mapWebhook(rawBody: string, headers: Headers): Promise<EmailDeliveryUpdate | null>;
}
