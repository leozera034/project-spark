export interface CourierDeliveryCounter {
  today: number;
  currentWeek: number;
  currentMonth: number;
  selectedPeriod: number;
  timezone: string;
  generatedAt: string;
}

export interface CourierCompletedDeliveryItem {
  deliveryId: string;
  orderNumber: number;
  completedAt: string;
}

export interface CourierDeliveryHistory {
  items: CourierCompletedDeliveryItem[];
  timezone: string;
}
