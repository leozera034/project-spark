import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Headphones, RefreshCw, Send } from "lucide-react";

import { useAdminSupportActions, useAdminSupportTicket, useAdminSupportTickets } from "@/admin/support/admin-support.queries";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SupportStatus } from "@/lib/store-support.functions";

export const Route = createFileRoute("/admin/suporte")({
  head: () => ({ meta: [{ title: "Suporte | Admin Comandiva" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: AdminSupportPage,
});

const FILTERS: Array<{ value: SupportStatus | null; label: string }> = [
  { value: null, label: "Todos" }, { value: "aberto", label: "Abertos" }, { value: "em_atendimento", label: "Em atendimento" }, { value: "aguardando_loja", label: "Aguardando loja" }, { value: "resolvido", label: "Resolvidos" },
];
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

function AdminSupportPage() {
  const [filter, setFilter] = useState<SupportStatus | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [nextStatus, setNextStatus] = useState<Exclude<SupportStatus, "aberto">>("aguardando_loja");
  const list = useAdminSupportTickets(filter);
  const detail = useAdminSupportTicket(selectedId);
  const actions = useAdminSupportActions();

  function sendReply() {
    if (!selectedId || !reply.trim() || actions.reply.isPending) return;
    actions.reply.mutate({ ticketId: selectedId, message: reply.trim(), status: nextStatus }, { onSuccess: () => setReply("") });
  }

  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[.14em] text-[#7A2D8E]">Operação de atendimento</p><h1 className="mt-1 text-3xl font-black tracking-tight">Suporte às lojas</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Fila central de chamados criados pelos lojistas, com histórico e resposta dentro do produto.</p></div><Button variant="outline" onClick={() => void list.refetch()}><RefreshCw className={`size-4 ${list.isFetching ? "animate-spin" : ""}`} /> Atualizar</Button></header>

      <div className="rail flex gap-2 overflow-x-auto pb-1">{FILTERS.map((item) => <Button key={item.label} size="sm" className="shrink-0" variant={filter === item.value ? "default" : "outline"} onClick={() => setFilter(item.value)}>{item.label}</Button>)}</div>
      {list.isError ? <ErrorState title="Não foi possível carregar a fila de suporte" onRetry={() => void list.refetch()} /> : null}

      <section className="grid min-w-0 gap-5 xl:grid-cols-[.75fr_1.25fr]">
        <Card className="min-w-0 overflow-hidden"><CardHeader className="border-b border-border"><CardTitle className="flex items-center gap-2"><Headphones className="size-5" /> Fila</CardTitle><p className="text-sm text-muted-foreground">{list.data?.total ?? 0} chamado(s) neste filtro</p></CardHeader><CardContent className="p-0">
          {list.isLoading ? <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-xl bg-surface-muted" />)}</div> : null}
          {!list.isLoading && (list.data?.items.length ?? 0) === 0 ? <div className="p-5"><EmptyState size="compact" title="Fila vazia" description="Não há chamados neste estado." /></div> : null}
          <div className="divide-y divide-border">{(list.data?.items ?? []).map((ticket) => <button key={ticket.id} type="button" className={`w-full p-4 text-left transition hover:bg-surface-muted/45 ${selectedId === ticket.id ? "bg-brand-soft/40" : ""}`} onClick={() => setSelectedId(ticket.id)}><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-bold">{ticket.subject}</p><p className="mt-1 truncate text-xs text-muted-foreground">{ticket.storeName} · {ticket.category} · {ticket.messageCount} msg</p></div><Status status={ticket.status} /></div><p className="mt-2 text-xs text-muted-foreground">{formatDate(ticket.lastMessageAt)}</p></button>)}</div>
        </CardContent></Card>

        {!selectedId ? <Card><CardContent className="grid min-h-80 place-items-center p-6"><EmptyState title="Selecione um chamado" description="Abra um item da fila para ler a conversa e responder à loja." /></CardContent></Card> : detail.isLoading ? <Card><CardContent className="space-y-3 p-5">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded-xl bg-surface-muted" />)}</CardContent></Card> : detail.isError || !detail.data ? <Card><CardContent className="p-5"><ErrorState title="Não foi possível abrir o chamado" onRetry={() => void detail.refetch()} /></CardContent></Card> : <Card className="min-w-0 overflow-hidden"><CardHeader className="border-b border-border"><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><CardTitle className="truncate">{detail.data.ticket.subject}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{detail.data.ticket.storeName} · criado {formatDate(detail.data.ticket.createdAt)}</p></div><Status status={detail.data.ticket.status} /></div></CardHeader><CardContent className="p-4 sm:p-5">
          <div className="space-y-3">{detail.data.messages.map((message) => <div key={message.id} className={`max-w-[88%] rounded-2xl p-3 ${message.authorKind === "admin" ? "ml-auto bg-[#4B1D6D] text-white" : "mr-auto border border-border bg-surface-muted"}`}><p className="text-[11px] font-bold uppercase tracking-[.08em] opacity-70">{message.authorKind === "admin" ? "Equipe COMANDIVA" : message.authorKind === "loja" ? "Lojista" : "Sistema"}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p><p className="mt-1 text-[11px] opacity-65">{formatDate(message.createdAt)}</p></div>)}</div>
          <div className="mt-5 border-t border-border pt-4"><Label htmlFor="admin-support-reply">Responder à loja</Label><Textarea id="admin-support-reply" className="mt-2 text-base" rows={4} maxLength={4000} value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Explique a orientação, ação tomada ou informação que precisa da loja." /><div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]"><select className="h-11 rounded-xl border border-input bg-surface px-3 text-sm" value={nextStatus} onChange={(event) => setNextStatus(event.target.value as Exclude<SupportStatus, "aberto">)}><option value="em_atendimento">Continuar em atendimento</option><option value="aguardando_loja">Aguardar resposta da loja</option><option value="resolvido">Marcar resolvido</option><option value="fechado">Fechar chamado</option></select><Button disabled={!reply.trim() || actions.reply.isPending} onClick={sendReply}><Send className="size-4" /> {actions.reply.isPending ? "Enviando…" : "Responder"}</Button></div>{actions.reply.isError ? <p className="mt-2 text-sm text-destructive">Não foi possível enviar a resposta.</p> : null}</div>
        </CardContent></Card>}
      </section>
    </main>
  );
}

function Status({ status }: { status: SupportStatus }) { const map: Record<SupportStatus,{label:string;variant:"outline"|"warning"|"info"|"success"|"secondary"}>={aberto:{label:"Aberto",variant:"warning"},em_atendimento:{label:"Em atendimento",variant:"info"},aguardando_loja:{label:"Aguardando loja",variant:"warning"},resolvido:{label:"Resolvido",variant:"success"},fechado:{label:"Fechado",variant:"secondary"}}; const item=map[status]; return <Badge variant={item.variant} className="shrink-0">{item.label}</Badge>; }
function formatDate(value: string) { const date=new Date(value); return Number.isNaN(date.getTime()) ? "—" : dateTime.format(date); }
