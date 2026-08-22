import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getAdminSupportTicket, listAdminSupportTickets, replyAdminSupportTicket } from "@/lib/admin-support.functions";
import type { SupportStatus } from "@/lib/store-support.functions";

export function useAdminSupportTickets(status: SupportStatus | null) {
  const fn = useServerFn(listAdminSupportTickets);
  return useQuery({
    queryKey: ["admin-support", "list", status],
    queryFn: () => fn({ data: { status } }),
    refetchInterval: 30_000,
  });
}

export function useAdminSupportTicket(ticketId: string | null) {
  const fn = useServerFn(getAdminSupportTicket);
  return useQuery({
    queryKey: ["admin-support", "ticket", ticketId],
    queryFn: () => fn({ data: { ticketId: ticketId! } }),
    enabled: Boolean(ticketId),
    refetchInterval: 20_000,
  });
}

export function useAdminSupportActions() {
  const queryClient = useQueryClient();
  const replyFn = useServerFn(replyAdminSupportTicket);
  const reply = useMutation({
    mutationFn: (input: { ticketId: string; message: string; status: Exclude<SupportStatus, "aberto"> }) => replyFn({ data: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-support"] }),
  });
  return { reply };
}
