import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CircleHelp, Headphones, MessageCircleMore, Plus, RefreshCw, Send, XCircle } from "lucide-react";

import { useAuth } from "@/auth/useAuth";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SupportCategory, SupportStatus } from "@/lib/store-support.functions";
import { useStoreSupportActions, useStoreSupportCenter, useStoreSupportTicket } from "@/store/support/store-support.queries";

export const Route = createFileRoute("/app/loja/ajuda")({
  head: () => ({ meta: [{ title: "Ajuda e suporte | Comandiva" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: StoreHelpPage,
});

const CATEGORIES: Array<{ value: SupportCategory; label: string }> = [
  { value: "pedidos", label: "Pedidos" }, { value: "cardapio", label: "Cardápio" }, { value: "entregas", label: "Entregas" },
  { value: "financeiro", label: "Financeiro / repasses" }, { value: "pagamentos", label: "Pagamentos" }, { value: "conta", label: "Conta e plano" },
  { value: "integracoes", label: "Integrações" }, { value: "outro", label: "Outro" },
];
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

function StoreHelpPage() {
  const { authContext } = useAuth();
  const storeId = authContext?.store_ids?.[0] ?? null;
  const center = useStoreSupportCenter(storeId);
  const actions = useStoreSupportActions();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [category, setCategory] = useState<SupportCategory>("pedidos");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const detail = useStoreSupportTicket(storeId, selectedId);

  if (!storeId) return <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-muted-foreground">Nenhuma loja vinculada a esta conta.</div>;

  function openTicket() {
    if (!subject.trim() || !message.trim() || actions.open.isPending) return;
    actions.open.mutate({ storeId, category, subject: subject.trim(), message: message.trim() }, {
      onSuccess: (result) => {
        setSubject(""); setMessage(""); setCreating(false); setSelectedId(result.id);
      },
    });
  }

  function replyTicket() {
    if (!selectedId || !reply.trim() || actions.reply.isPending) return;
    actions.reply.mutate({ storeId, ticketId: selectedId, message: reply.trim() }, { onSuccess: () => setReply("") });
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-brand">Central de suporte</p><h1 className="mt-1 font-display text-3xl font-black tracking-tight">Ajuda</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Abra chamados, acompanhe respostas da equipe COMANDIVA e mantenha o histórico do problema na própria loja.</p></div>
        <div className="flex gap-2"><Button variant="outline" onClick={() => void center.refetch()}><RefreshCw className={`size-4 ${center.isFetching ? "animate-spin" : ""}`} /> Atualizar</Button><Button onClick={() => { setCreating(true); setSelectedId(null); }}><Plus className="size-4" /> Novo chamado</Button></div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Summary icon={Headphones} label="Chamados" value={center.isLoading ? "—" : String(center.data?.summary.total ?? 0)} />
        <Summary icon={MessageCircleMore} label="Em aberto" value={center.isLoading ? "—" : String(center.data?.summary.active ?? 0)} />
        <Summary icon={CircleHelp} label="Resolvidos" value={center.isLoading ? "—" : String(center.data?.summary.resolved ?? 0)} />
      </section>

      {center.isError ? <ErrorState title="Não foi possível carregar seus chamados" onRetry={() => void center.refetch()} /> : null}

      <section className="grid min-w-0 gap-5 xl:grid-cols-[.75fr_1.25fr]">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="border-b border-border"><CardTitle>Seus chamados</CardTitle><p className="text-sm text-muted-foreground">Mais recentes primeiro.</p></CardHeader>
          <CardContent className="p-0">
            {center.isLoading ? <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-xl bg-surface-muted" />)}</div> : null}
            {!center.isLoading && (center.data?.items.length ?? 0) === 0 ? <div className="p-5"><EmptyState size="compact" title="Nenhum chamado" description="Se surgir um problema, abra um chamado e acompanhe tudo por aqui." /></div> : null}
            <div className="divide-y divide-border">
              {(center.data?.items ?? []).map((ticket) => (
                <button key={ticket.id} type="button" className={`w-full p-4 text-left transition hover:bg-surface-muted/50 ${selectedId === ticket.id ? "bg-brand-soft/45" : ""}`} onClick={() => { setSelectedId(ticket.id); setCreating(false); }}>
                  <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{ticket.subject}</p><p className="mt-1 text-xs text-muted-foreground">{categoryLabel(ticket.category)} · {ticket.messageCount} mensagem(ns)</p></div><StatusBadge status={ticket.status} /></div>
                  <p className="mt-2 text-xs text-muted-foreground">Atualizado {formatDate(ticket.lastMessageAt)}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {creating ? (
          <NewTicketCard category={category} subject={subject} message={message} pending={actions.open.isPending} error={actions.open.isError} onCategory={setCategory} onSubject={setSubject} onMessage={setMessage} onSubmit={openTicket} onCancel={() => setCreating(false)} />
        ) : selectedId ? (
          <TicketConversation detail={detail} reply={reply} setReply={setReply} replying={actions.reply.isPending} closing={actions.close.isPending} replyError={actions.reply.isError} onReply={replyTicket} onClose={() => actions.close.mutate({ storeId, ticketId: selectedId })} />
        ) : (
          <Card className="min-w-0"><CardContent className="grid min-h-72 place-items-center p-6"><EmptyState title="Selecione um chamado" description="Abra uma conversa existente ou crie um novo chamado para falar com o suporte." /></CardContent></Card>
        )}
      </section>
    </div>
  );
}

function NewTicketCard({ category, subject, message, pending, error, onCategory, onSubject, onMessage, onSubmit, onCancel }: { category: SupportCategory; subject: string; message: string; pending: boolean; error: boolean; onCategory: (value: SupportCategory) => void; onSubject: (value: string) => void; onMessage: (value: string) => void; onSubmit: () => void; onCancel: () => void }) {
  return <Card className="min-w-0"><CardHeader><CardTitle>Novo chamado</CardTitle><p className="text-sm text-muted-foreground">Descreva o problema com contexto suficiente para reduzir idas e vindas.</p></CardHeader><CardContent className="space-y-4">
    <div><Label htmlFor="support-category">Área do problema</Label><select id="support-category" className="mt-2 h-11 w-full rounded-xl border border-input bg-surface px-3 text-sm" value={category} onChange={(event) => onCategory(event.target.value as SupportCategory)}>{CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
    <div><Label htmlFor="support-subject">Assunto</Label><Input id="support-subject" className="mt-2" maxLength={160} value={subject} placeholder="Ex.: repasse não aparece como disponível" onChange={(event) => onSubject(event.target.value)} /></div>
    <div><Label htmlFor="support-message">O que aconteceu?</Label><Textarea id="support-message" className="mt-2 text-base" rows={7} maxLength={4000} value={message} placeholder="Informe pedido, horário, tela, comportamento esperado e o que aconteceu de fato quando isso for relevante." onChange={(event) => onMessage(event.target.value)} /><p className="mt-1 text-right text-xs text-muted-foreground">{message.length}/4000</p></div>
    {error ? <p className="text-sm text-destructive">Não foi possível abrir o chamado. Revise os campos e tente novamente.</p> : null}
    <div className="flex justify-end gap-2"><Button variant="outline" onClick={onCancel}>Cancelar</Button><Button disabled={pending || subject.trim().length < 3 || !message.trim()} onClick={onSubmit}>{pending ? "Abrindo…" : "Abrir chamado"}</Button></div>
  </CardContent></Card>;
}

function TicketConversation({ detail, reply, setReply, replying, closing, replyError, onReply, onClose }: { detail: ReturnType<typeof useStoreSupportTicket>; reply: string; setReply: (value: string) => void; replying: boolean; closing: boolean; replyError: boolean; onReply: () => void; onClose: () => void }) {
  if (detail.isLoading) return <Card><CardContent className="space-y-3 p-5">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded-xl bg-surface-muted" />)}</CardContent></Card>;
  if (detail.isError || !detail.data) return <Card><CardContent className="p-5"><ErrorState title="Não foi possível abrir este chamado" onRetry={() => void detail.refetch()} /></CardContent></Card>;
  const { ticket, messages } = detail.data;
  const closed = ticket.status === "fechado" || ticket.status === "resolvido";
  return <Card className="min-w-0 overflow-hidden"><CardHeader className="border-b border-border"><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><CardTitle className="truncate">{ticket.subject}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{categoryLabel(ticket.category)} · aberto {formatDate(ticket.createdAt)}</p></div><StatusBadge status={ticket.status} /></div></CardHeader><CardContent className="p-4 sm:p-5">
    <div className="space-y-3">{messages.map((message) => <div key={message.id} className={`max-w-[88%] rounded-2xl p-3 ${message.authorKind === "loja" ? "ml-auto bg-brand text-brand-foreground" : "mr-auto border border-border bg-surface-muted"}`}><p className="text-[11px] font-bold uppercase tracking-[.08em] opacity-75">{message.authorKind === "admin" ? "Suporte COMANDIVA" : message.authorKind === "loja" ? "Sua loja" : "Sistema"}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p><p className="mt-1 text-[11px] opacity-70">{formatDate(message.createdAt)}</p></div>)}</div>
    {!closed ? <div className="mt-5 border-t border-border pt-4"><Label htmlFor="support-reply">Responder</Label><Textarea id="support-reply" className="mt-2 text-base" rows={4} maxLength={4000} value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Envie uma atualização ou responda ao suporte." />{replyError ? <p className="mt-2 text-sm text-destructive">Não foi possível enviar a resposta.</p> : null}<div className="mt-3 flex flex-wrap justify-between gap-2"><Button variant="outline" disabled={closing} onClick={onClose}><XCircle className="size-4" /> {closing ? "Encerrando…" : "Encerrar chamado"}</Button><Button disabled={!reply.trim() || replying} onClick={onReply}><Send className="size-4" /> {replying ? "Enviando…" : "Enviar resposta"}</Button></div></div> : <p className="mt-5 rounded-xl border border-border bg-surface-muted p-3 text-sm text-muted-foreground">Este chamado está encerrado. Se o problema reaparecer, abra um novo chamado para manter o histórico claro.</p>}
  </CardContent></Card>;
}

function Summary({ icon: Icon, label, value }: { icon: typeof Headphones; label: string; value: string }) { return <Card><CardContent className="flex items-center justify-between gap-3 p-5"><div><p className="text-xs font-bold uppercase tracking-[.1em] text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-black tabular-nums">{value}</p></div><span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand"><Icon className="size-5" /></span></CardContent></Card>; }
function StatusBadge({ status }: { status: SupportStatus }) { const map: Record<SupportStatus, { label: string; variant: "outline" | "warning" | "info" | "success" | "secondary" }> = { aberto:{label:"Aberto",variant:"warning"}, em_atendimento:{label:"Em atendimento",variant:"info"}, aguardando_loja:{label:"Aguardando você",variant:"warning"}, resolvido:{label:"Resolvido",variant:"success"}, fechado:{label:"Fechado",variant:"secondary"} }; const item=map[status]; return <Badge variant={item.variant} className="shrink-0">{item.label}</Badge>; }
function categoryLabel(category: SupportCategory) { return CATEGORIES.find((item) => item.value === category)?.label ?? category; }
function formatDate(value: string) { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? "—" : dateTime.format(parsed); }
