export type DeliveryReportPeriodType = "today" | "week" | "month" | "custom";

export interface DeliveryReportPeriod {
  type: DeliveryReportPeriodType;
  start: string;
  end: string;
}

export interface DeliveryReportSummary {
  completedDeliveries: number;
  couriersWithCompletions: number;
  period: DeliveryReportPeriod;
  timezone: string;
  generatedAt: string;
}

export interface DeliveryReportDailyPoint {
  local_date: string;
  completed_deliveries: number;
}

export interface DeliveryReportSeries {
  series: DeliveryReportDailyPoint[];
  timezone: string;
}

export interface DeliveryReportCourierRow {
  courierId: string;
  courierName: string;
  courierStatus: string;
  completed_deliveries: number;
}

export interface DeliveryReportComparison {
  rows: DeliveryReportCourierRow[];
  timezone: string;
}

export interface CompletedDeliveryHistoryItem {
  deliveryId: string;
  orderNumber: number;
  courierId: string;
  courierName: string;
  completedAt: string;
}

export interface DeliveryReportHistory {
  items: CompletedDeliveryHistoryItem[];
  total: number;
  timezone: string;
}

export interface DeliveryReportFilters {
  periodType: DeliveryReportPeriodType;
  startDate?: string;
  endDate?: string;
  courierId?: string;
}
