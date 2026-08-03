import { supabase } from "@/integrations/supabase/client";
import { 
  DeliveryReportSummary, 
  DeliveryReportSeries, 
  DeliveryReportComparison, 
  DeliveryReportHistory,
  DeliveryReportPeriodType
} from "./delivery-report.types";

export async function getStoreDeliveryReportSummary(
  periodType: DeliveryReportPeriodType,
  startDate?: string,
  endDate?: string
): Promise<DeliveryReportSummary> {
  const { data, error } = await supabase.rpc("get_my_store_delivery_report_summary", {
    _period_type: periodType,
    _start_date: startDate,
    _end_date: endDate
  });
  if (error) throw error;
  return data as unknown as DeliveryReportSummary;
}

export async function getStoreDeliveryReportSeries(
  periodType: DeliveryReportPeriodType,
  startDate?: string,
  endDate?: string
): Promise<DeliveryReportSeries> {
  const { data, error } = await supabase.rpc("get_my_store_delivery_report_series", {
    _period_type: periodType,
    _start_date: startDate,
    _end_date: endDate
  });
  if (error) throw error;
  return data as unknown as DeliveryReportSeries;
}

export async function listStoreDeliveryReportByCourier(
  periodType: DeliveryReportPeriodType,
  startDate?: string,
  endDate?: string
): Promise<DeliveryReportComparison> {
  const { data, error } = await supabase.rpc("list_my_store_delivery_report_by_courier", {
    _period_type: periodType,
    _start_date: startDate,
    _end_date: endDate
  });
  if (error) throw error;
  return data as unknown as DeliveryReportComparison;
}

export async function listStoreCompletedDeliveries(
  periodType: DeliveryReportPeriodType,
  startDate?: string,
  endDate?: string,
  courierId?: string,
  limit = 50,
  offset = 0
): Promise<DeliveryReportHistory> {
  const { data, error } = await supabase.rpc("list_my_store_completed_deliveries", {
    _period_type: periodType,
    _start_date: startDate,
    _end_date: endDate,
    _courier_id: courierId,
    _limit: limit,
    _offset: offset
  });
  if (error) throw error;
  return data as unknown as DeliveryReportHistory;
}
