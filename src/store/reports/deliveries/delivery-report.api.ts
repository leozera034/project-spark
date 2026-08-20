import { supabase } from "@/integrations/supabase/client";
import {
  DeliveryReportSummary,
  DeliveryReportSeries,
  DeliveryReportComparison,
  DeliveryReportHistory,
  DeliveryReportPeriodType,
  StoreBusinessReportSummary,
} from "./delivery-report.types";

export async function getStoreBusinessReportSummary(
  storeId: string,
  periodType: DeliveryReportPeriodType,
  startDate?: string,
  endDate?: string,
): Promise<StoreBusinessReportSummary> {
  const { data, error } = await (supabase.rpc as any)("get_my_store_business_report_summary", {
    _store_id: storeId,
    _period_type: periodType,
    _start_date: startDate,
    _end_date: endDate,
  });
  if (error) throw error;
  return data as unknown as StoreBusinessReportSummary;
}

export async function getStoreDeliveryReportSummary(
  storeId: string,
  periodType: DeliveryReportPeriodType,
  startDate?: string,
  endDate?: string,
): Promise<DeliveryReportSummary> {
  const { data, error } = await (supabase.rpc as any)("get_my_store_delivery_report_summary", {
    _store_id: storeId,
    _period_type: periodType,
    _start_date: startDate,
    _end_date: endDate,
  });
  if (error) throw error;
  return data as unknown as DeliveryReportSummary;
}

export async function getStoreDeliveryReportSeries(
  storeId: string,
  periodType: DeliveryReportPeriodType,
  startDate?: string,
  endDate?: string,
): Promise<DeliveryReportSeries> {
  const { data, error } = await (supabase.rpc as any)("get_my_store_delivery_report_series", {
    _store_id: storeId,
    _period_type: periodType,
    _start_date: startDate,
    _end_date: endDate,
  });
  if (error) throw error;
  return data as unknown as DeliveryReportSeries;
}

export async function listStoreDeliveryReportByCourier(
  storeId: string,
  periodType: DeliveryReportPeriodType,
  startDate?: string,
  endDate?: string,
): Promise<DeliveryReportComparison> {
  const { data, error } = await (supabase.rpc as any)("list_my_store_delivery_report_by_courier", {
    _store_id: storeId,
    _period_type: periodType,
    _start_date: startDate,
    _end_date: endDate,
  });
  if (error) throw error;
  return data as unknown as DeliveryReportComparison;
}

export async function listStoreCompletedDeliveries(
  storeId: string,
  periodType: DeliveryReportPeriodType,
  startDate?: string,
  endDate?: string,
  courierId?: string,
  limit = 50,
  offset = 0,
): Promise<DeliveryReportHistory> {
  const { data, error } = await (supabase.rpc as any)("list_my_store_completed_deliveries", {
    _store_id: storeId,
    _period_type: periodType,
    _start_date: startDate,
    _end_date: endDate,
    _courier_id: courierId,
    _limit: limit,
    _offset: offset,
  });
  if (error) throw error;
  return data as unknown as DeliveryReportHistory;
}
