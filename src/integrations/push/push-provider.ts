export type PushProviderCode = "fcm";
export type PushPlatform = "android" | "ios" | "web";

export interface PushProviderHealth {
  provider: PushProviderCode;
  projectId: string | null;
  credentialsConfigured: boolean;
  cloudMessagingApiEnabled: boolean;
  validateOnlyVerified: boolean;
  checkedAt: string;
  errorCode?: string | null;
}

export interface PushMessageRequest {
  outboundMessageId: string;
  registrationToken: string;
  platform: PushPlatform;
  title: string;
  body: string;
  data: Record<string, string>;
  idempotencyKey: string;
}

export interface PushSendResult {
  provider: PushProviderCode;
  providerMessageId: string;
  accepted: boolean;
}

export interface PushProviderErrorClassification {
  code: string;
  retryable: boolean;
  deactivateToken: boolean;
  retryAfterSeconds?: number | null;
}

/**
 * Provider-neutral server boundary for push notifications.
 * Registration tokens are credentials and must never be returned to browser UI.
 */
export interface PushProvider {
  readonly code: PushProviderCode;
  healthCheck(): Promise<PushProviderHealth>;
  send(request: PushMessageRequest): Promise<PushSendResult>;
  classifyError(status: number, payload: unknown, headers: Headers): PushProviderErrorClassification;
}
