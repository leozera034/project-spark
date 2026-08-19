import { useQuery } from "@tanstack/react-query";

import { useStoreScope } from "@/store-scope/StoreScopeProvider";

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
  summary: (storeId: string | null, period: DeliveryReportPeriodType, start?: string, end?: string) =>
    [...reportKeys.summaries(), { storeId, period, start, end }] as const,
  series: (storeId: string | null, period: DeliveryReportPeriodType, start?: string, end?: string) =>
    [...reportKeys.all, "series", { storeId, period, start, end }] as const,
  comparison: (storeId: string | null, period: DeliveryReportPeriodType, start?: string, end?: string) =>
    [...reportKeys.all, "comparison", { storeId, period, start, end }] as const,
  history: (
    storeId: string | null,
    period: DeliveryReportPeriodType,
    start?: string,
    end?: string,
    courierId?: string,
    page = 0,
  ) => [...reportKeys.all, "history", { storeId, period, start, end, courierId, page }] as const,
};

export function useStoreDeliveryReportSummary(period: DeliveryReportPeriodType, start?: string, end?: string) {
  const { storeId } = useStoreScope();
  return useQuery({
    queryKey: reportKeys.summary(storeId, period, start, end),
    queryFn: () => getStoreDeliveryReportSummary(storeId as string, period, start, end),
    enabled: Boolean(storeId),
  });
}

export function useStoreDeliveryReportSeries(period: DeliveryReportPeriodType, start?: string, end?: string) {
  const { storeId } = useStoreScope();
  return useQuery({
    queryKey: reportKeys.series(storeId, period, start, end),
    queryFn: () => getStoreDeliveryReportSeries(storeId as string, period, start, end),
    enabled: Boolean(storeId),
  });
}

export function useStoreDeliveryReportComparison(period: DeliveryReportPeriodType, start?: string, end?: string) {
  const { storeId } = useStoreScope();
  return useQuery({
    queryKey: reportKeys.comparison(storeId, period, start, end),
    queryFn: () => listStoreDeliveryReportByCourier(storeId as string, period, start, end),
    enabled: Boolean(storeId),
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
  const { storeId } = useStoreScope();
  return useQuery({
    queryKey: reportKeys.history(storeId, period, start, end, courierId, page),
    queryFn: () =>
      listStoreCompletedDeliveries(storeId as string, period, start, end, courierId, limit, page * limit),
    enabled: Boolean(storeId),
  });
}
