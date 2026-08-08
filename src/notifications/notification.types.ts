export type AlertSeverity = "info" | "warning" | "critical";

export interface BaseAlert {
  id: string;
  type: string;
  severity: AlertSeverity;
  createdAt: string;
  version: number;
}

export interface StoreOperationalAlert extends BaseAlert {
  entityId: string;
  becameUrgentAt?: string;
}

export interface CourierOperationalAlert extends BaseAlert {
  deliveryId: string;
  requiresAcceptance: boolean;
}
