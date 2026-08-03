import { useQuery } from "@tanstack/react-query";
import { getMyCourierDeliveryCounter, listMyCompletedDeliveries } from "./courier-counter.api";

export const courierReportKeys = {
  all: ['courier-reports'] as const,
  counter: (start?: string, end?: string) => [...courierReportKeys.all, 'counter', { start, end }] as const,
  history: (page = 0) => [...courierReportKeys.all, 'history', { page }] as const,
};

export function useMyCourierDeliveryCounter(start?: string, end?: string) {
  return useQuery({
    queryKey: courierReportKeys.counter(start, end),
    queryFn: () => getMyCourierDeliveryCounter(start, end),
    refetchInterval: 120000, // Sync with heartbeat
  });
}

export function useMyCompletedDeliveries(page = 0, limit = 20) {
  return useQuery({
    queryKey: courierReportKeys.history(page),
    queryFn: () => listMyCompletedDeliveries(limit, page * limit),
  });
}
