import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useMemo } from "react";

import {
  fetchCourierCounts,
  fetchCourierDetail,
  fetchCourierList,
  fetchEligibleCouriers,
  updateCourier,
  activateCourier,
  deactivateCourier,
  assignCourier,
  reassignCourier,
} from "../courier.api";
import { resetCourierAccess } from "@/lib/courier-access.functions";
import { createStoreCourier } from "@/lib/courier-provisioning.server";
import { useServerFn } from "@tanstack/react-start";
import { extractCode, toFriendlyMessage } from "@/store-config/errors";

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
    queryFn: () => fetchCourierDetail(storeId, courierId!),
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
