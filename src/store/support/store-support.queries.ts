import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  closeStoreSupportTicket,
  getStoreSupportCenter,
  getStoreSupportTicket,
  openStoreSupportTicket,
  replyStoreSupportTicket,
  type SupportCategory,
} from "@/lib/store-support.functions";

export function useStoreSupportCenter(storeId: string | null) {
  const fn = useServerFn(getStoreSupportCenter);
  return useQuery({
    queryKey: ["store-support", storeId, "center"],
    queryFn: () => fn({ data: { storeId: storeId! } }),
    enabled: Boolean(storeId),
    refetchInterval: 60_000,
  });
}

export function useStoreSupportTicket(storeId: string | null, ticketId: string | null) {
  const fn = useServerFn(getStoreSupportTicket);
  return useQuery({
    queryKey: ["store-support", storeId, "ticket", ticketId],
    queryFn: () => fn({ data: { storeId: storeId!, ticketId: ticketId! } }),
    enabled: Boolean(storeId && ticketId),
    refetchInterval: 30_000,
  });
}

export function useStoreSupportActions() {
  const queryClient = useQueryClient();
  const openFn = useServerFn(openStoreSupportTicket);
  const replyFn = useServerFn(replyStoreSupportTicket);
  const closeFn = useServerFn(closeStoreSupportTicket);

  const open = useMutation({
    mutationFn: (input: { storeId: string; category: SupportCategory; subject: string; message: string }) => openFn({ data: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["store-support"] }),
  });
  const reply = useMutation({
    mutationFn: (input: { storeId: string; ticketId: string; message: string }) => replyFn({ data: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["store-support"] }),
  });
  const close = useMutation({
    mutationFn: (input: { storeId: string; ticketId: string }) => closeFn({ data: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["store-support"] }),
  });

  return { open, reply, close };
}
