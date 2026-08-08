import { useQuery } from "@tanstack/react-query";
import {
  getStoreDeliveryReportSummary,
  getStoreDeliveryReportSeries,
  listStoreDeliveryReportByCourier,
  listStoreCompletedDeliveries,
} from "./delivery-report.api";
import { DeliveryReportPeriodType } from "./delivery-report.types";

export const reportKeys = {
  all: ["delivery-reports"] as const,
  summaries: () => [...reportKeys.all, "summary"] as const,
  summary: (period: DeliveryReportPeriodType, start?: string, end?: string) =>
    [...reportKeys.summaries(), { period, start, end }] as const,
  series: (period: DeliveryReportPeriodType, start?: string, end?: string) =>
    [...reportKeys.all, "series", { period, start, end }] as const,
  comparison: (period: DeliveryReportPeriodType, start?: string, end?: string) =>
    [...reportKeys.all, "comparison", { period, start, end }] as const,
  history: (
    period: DeliveryReportPeriodType,
    start?: string,
    end?: string,
    courierId?: string,
    page = 0,
  ) => [...reportKeys.all, "history", { period, start, end, courierId, page }] as const,
};

export function useStoreDeliveryReportSummary(
  period: DeliveryReportPeriodType,
  start?: string,
  end?: string,
) {
  return useQuery({
    queryKey: reportKeys.summary(period, start, end),
    queryFn: () => getStoreDeliveryReportSummary(period, start, end),
  });
}

export function useStoreDeliveryReportSeries(
  period: DeliveryReportPeriodType,
  start?: string,
  end?: string,
) {
  return useQuery({
    queryKey: reportKeys.series(period, start, end),
    queryFn: () => getStoreDeliveryReportSeries(period, start, end),
  });
}

export function useStoreDeliveryReportComparison(
  period: DeliveryReportPeriodType,
  start?: string,
  end?: string,
) {
  return useQuery({
    queryKey: reportKeys.comparison(period, start, end),
    queryFn: () => listStoreDeliveryReportByCourier(period, start, end),
  });
}

export function useStoreCompletedDeliveries(
  period: DeliveryReportPeriodType,
  start?: string,
  end?: string,
  courierId?: string,
  page = 0,
  limit = 20,
) {
  return useQuery({
    queryKey: reportKeys.history(period, start, end, courierId, page),
    queryFn: () => listStoreCompletedDeliveries(period, start, end, courierId, limit, page * limit),
  });
}
