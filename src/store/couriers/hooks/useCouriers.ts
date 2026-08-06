import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useMemo } from "react";

import {
  fetchCourierCounts,
  fetchCourierDetail,
  fetchCourierList,
  fetchEligibleCouriers,
  fetchDeliveryAssignment,
  updateCourier,
  activateCourier,
  deactivateCourier,
  assignCourier,
  reassignCourier,
  // Fase 19
  fetchMyCourierOperationalContext,
  setMyCourierOnline,
  setMyCourierOffline,
  heartbeatMyCourierPresence,
  acceptMyDeliveryAssignment,
  declineMyDeliveryAssignment,
  confirmMyArrivalAtStore,
  confirmMyOrderPickup,
  startMyDelivery,
  completeMyDelivery,
  reportMyDeliveryOccurrence,
} from "../courier.api";
import { resetCourierAccess } from "@/lib/courier-access.functions";
import { createStoreCourier } from "@/lib/courier-provisioning.functions";
import { useServerFn } from "@tanstack/react-start";
import { extractCode, toFriendlyMessage } from "@/store-config/errors";
import type { DeliveryActionResult, CourierPresenceResult } from "../courier.types";

export function useCourierList(storeId: string | null, filters: any = {}) {
  const filterKey = useMemo(() => JSON.stringify(filters), [filters]);
  return useQuery({
    queryKey: ["couriers", "list", storeId, filterKey],
    queryFn: () => fetchCourierList(storeId, filters),
    enabled: !!storeId,
  });
}

export function useCourierCounts(storeId: string | null) {
  return useQuery({
    queryKey: ["couriers", "counts", storeId],
    queryFn: () => fetchCourierCounts(storeId),
    enabled: !!storeId,
  });
}

export function useCourierDetail(storeId: string | null, courierId: string | undefined) {
  return useQuery({
    queryKey: ["couriers", "detail", storeId, courierId],
    queryFn: () => {
      if (!courierId) throw new Error("Entregador não informado.");
      return fetchCourierDetail(storeId, courierId);
    },
    enabled: !!storeId && !!courierId,
  });
}

export function useCreateCourier() {
  const queryClient = useQueryClient();
  const createFn = useServerFn(createStoreCourier);

  return useMutation({
    mutationFn: createFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["couriers"] });
      toast.success("Entregador cadastrado com sucesso!");
    },
    onError: (error) => {
      toast.error(toFriendlyMessage(error));
    },
  });
}

export function useUpdateCourier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateCourier,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["couriers"] });
      toast.success("Perfil atualizado!");
    },
    onError: (error) => {
      const code = extractCode(error);
      if (code === "VERSION_CONFLICT") {
        toast.error("O perfil foi alterado em outro aparelho. Recarregando...");
        queryClient.invalidateQueries({ queryKey: ["couriers"] });
      } else {
        toast.error(toFriendlyMessage(error));
      }
    },
  });
}

export function useActivateCourier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: activateCourier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["couriers"] });
      toast.success("Entregador ativado.");
    },
  });
}

export function useDeactivateCourier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deactivateCourier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["couriers"] });
      toast.success("Entregador inativado.");
    },
  });
}

export function useResetCourierAccess() {
  const resetFn = useServerFn(resetCourierAccess);
  return useMutation({
    mutationFn: (variables: { data: { courier_id: string } }) => resetFn(variables),
    onSuccess: () => {
      toast.success("Acesso redefinido com sucesso.");
    },
    onError: (error) => {
      toast.error(toFriendlyMessage(error));
    },
  });
}


export function useEligibleCouriers(storeId: string | null, orderId: string) {
  return useQuery({
    queryKey: ["couriers", "eligible", storeId, orderId],
    queryFn: () => fetchEligibleCouriers(storeId, orderId),
    enabled: !!storeId && !!orderId,
  });
}

export function useDeliveryAssignment(storeId: string | null, orderId: string) {
  return useQuery({
    queryKey: ["couriers", "assignment", storeId, orderId],
    queryFn: () => fetchDeliveryAssignment(storeId, orderId),
    enabled: Boolean(storeId && orderId),
  });
}

export function useAssignCourier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: assignCourier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-orders"] });
      queryClient.invalidateQueries({ queryKey: ["couriers"] });
      toast.success("Entregador atribuído.");
    },
  });
}

export function useReassignCourier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reassignCourier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-orders"] });
      queryClient.invalidateQueries({ queryKey: ["couriers"] });
      toast.success("Entregador trocado.");
    },
  });
}

/**
 * Fase 19 — Hooks operacionais do entregador
 */

export function useMyCourierOperationalContext() {
  return useQuery({
    queryKey: ["courier", "operational-context"],
    queryFn: () => fetchMyCourierOperationalContext(),
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });
}

export function useSetCourierOnline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setMyCourierOnline,
    onSuccess: (data: CourierPresenceResult) => {
      queryClient.setQueryData(["courier", "operational-context"], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          onlineIntent: data.onlineIntent,
          presenceStatus: data.presenceStatus,
          lastSeenAt: data.lastSeenAt,
          version: data.version,
        };
      });
      toast.success("Você está online.");
    },
    onError: (error) => toast.error(toFriendlyMessage(error)),
  });
}

export function useSetCourierOffline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setMyCourierOffline,
    onSuccess: (data: CourierPresenceResult) => {
      queryClient.setQueryData(["courier", "operational-context"], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          onlineIntent: data.onlineIntent,
          presenceStatus: data.presenceStatus,
          lastSeenAt: data.lastSeenAt,
          version: data.version,
        };
      });
      toast.success("Você está offline.");
    },
    onError: (error) => toast.error(toFriendlyMessage(error)),
  });
}

export function useCourierHeartbeat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: heartbeatMyCourierPresence,
    onSuccess: (data: CourierPresenceResult) => {
      queryClient.setQueryData(["courier", "operational-context"], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          presenceStatus: data.presenceStatus,
          lastSeenAt: data.lastSeenAt,
          version: data.version,
        };
      });
    },
  });
}

// Ações de Entrega

function useDeliveryActionMutation(
  mutationFn: (input: any) => Promise<DeliveryActionResult>,
  successMsg: string
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courier", "operational-context"] });
      toast.success(successMsg);
    },
    onError: (error) => {
      const code = extractCode(error);
      if (code === "VERSION_CONFLICT") {
        toast.error("Esta entrega foi atualizada em outro acesso.");
        queryClient.invalidateQueries({ queryKey: ["courier", "operational-context"] });
      } else {
        toast.error(toFriendlyMessage(error));
      }
    },
  });
}

export function useAcceptDeliveryAssignment() {
  return useDeliveryActionMutation(acceptMyDeliveryAssignment, "Entrega aceita.");
}

export function useDeclineDeliveryAssignment() {
  return useDeliveryActionMutation(declineMyDeliveryAssignment, "Entrega recusada.");
}

export function useConfirmArrivalAtStore() {
  return useDeliveryActionMutation(confirmMyArrivalAtStore, "Chegada à loja confirmada.");
}

export function useConfirmOrderPickup() {
  return useDeliveryActionMutation(confirmMyOrderPickup, "Pedido coletado.");
}

export function useStartDelivery() {
  return useDeliveryActionMutation(startMyDelivery, "Entrega iniciada.");
}

export function useCompleteDelivery() {
  return useDeliveryActionMutation(completeMyDelivery, "Entrega concluída!");
}

export function useReportDeliveryOccurrence() {
  return useDeliveryActionMutation(reportMyDeliveryOccurrence, "Ocorrência registrada.");
}
