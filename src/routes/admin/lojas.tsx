import { createFileRoute } from "@tanstack/react-router";
import { Building2, PauseCircle, PlayCircle, RefreshCw, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useAdminActions, usePlatformStores } from "@/store/platform/platform-admin.queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/admin/lojas")({ component: AdminStoresPage });

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function billingLabel(store: any) {
  if (store.stripe_recurring_confirmed) return "Stripe recorrente";
  if (store.subscription_status === "cortesia") return "Cortesia";
  if (store.subscription_status === "trial") return "Trial interno";
  if (store.plan_name && !store.billing_provider) return "Acesso administrativo";
  return "Sem assinatura";
}

function AdminStoresPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [suspending, setSuspending] = useState<{ id: string; name: string } | null>(null);
  const [reason, setReason] = useState("");
  const stores = usePlatformStores({ search, status: status || undefined, limit: 200 });
  const { suspend, reactivate } = useAdminActions();

  async function confirmSuspend() {
    if (!suspending || !reason.trim()) return;
    try {
      await suspend.mutateAsync({ storeId: suspending.id, reason: reason.trim() });
      toast.success("Loja suspensa.");
      setSuspending(null);
      setReason("");
    } catch {
      toast.error("Não foi possível suspender a loja.");
    }
  }

  async function activate(id: string) {
    try {
      await reactivate.mutateAsync({ storeId: id });
      toast.success("Loja ativada/reativada.");
    } catch {
      toast.error("Não foi possível ativar a loja.");
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.16em] text-brand">Administração</p>
          <h1 className="mt-1 font-display text-3xl font-black">Lojas da plataforma</h1>
          <p className="mt-2 text-sm text-muted-foreground">Ative, reative ou suspenda lojas e confira o plano, a origem da cobrança e o status real da assinatura.</p>
        </div>
        <Button variant="outline" onClick={() => void stores.refetch()}><RefreshCw className="size-4" /> Atualizar</Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building2 className="size-5 text-brand" /> Diretório operacional</CardTitle>
          <CardDescription>{stores.data?.total ?? 0} loja(s) encontrada(s).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" placeholder="Buscar por nome ou slug" /></div>
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos os status</option><option value="ativa">Ativas</option><option value="suspensa">Suspensas</option><option value="em_implantacao">Em implantação</option><option value="inativa">Inativas</option>
            </select>
          </div>

          <div className="overflow-x-auto rounded-xl border">
            <Table className="min-w-[1000px]">
              <TableHeader><TableRow><TableHead>Loja</TableHead><TableHead>Status</TableHead><TableHead>Plano</TableHead><TableHead>Cobrança</TableHead><TableHead>Valor referência</TableHead><TableHead>Pedidos</TableHead><TableHead>Próximo período</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
              <TableBody>
                {(stores.data?.items ?? []).map((store) => (
                  <TableRow key={store.id}>
                    <TableCell><div className="font-semibold">{store.name}</div><div className="text-xs text-muted-foreground">/{store.slug}{store.city ? ` · ${store.city}${store.state ? `/${store.state}` : ""}` : ""}</div></TableCell>
                    <TableCell><Badge variant={store.status === "ativa" ? "default" : store.status === "suspensa" ? "destructive" : "outline"}>{store.status}</Badge></TableCell>
                    <TableCell><div className="font-medium">{store.plan_name ?? "Sem plano"}</div><div className="text-xs text-muted-foreground">{store.billing_interval ?? "—"}</div></TableCell>
                    <TableCell><Badge variant={store.stripe_recurring_confirmed ? "default" : "outline"}>{billingLabel(store)}</Badge><div className="mt-1 text-xs text-muted-foreground">{store.provider_status ?? store.subscription_status ?? "—"}</div></TableCell>
                    <TableCell>{store.amount_cents != null ? money.format(Number(store.amount_cents) / 100) : "—"}</TableCell>
                    <TableCell className="font-semibold tabular-nums">{store.total_orders}</TableCell>
                    <TableCell>{store.current_period_end ? new Date(store.current_period_end).toLocaleDateString("pt-BR") : store.complimentary_until ? `Cortesia até ${new Date(store.complimentary_until).toLocaleDateString("pt-BR")}` : "Não agendado"}</TableCell>
                    <TableCell className="text-right">
                      {store.status === "ativa" ? <Button size="sm" variant="outline" onClick={() => setSuspending({ id: store.id, name: store.name })}><PauseCircle className="size-4" /> Suspender</Button> : <Button size="sm" onClick={() => void activate(store.id)}><PlayCircle className="size-4" /> Ativar</Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(suspending)} onOpenChange={(open) => { if (!open) setSuspending(null); }}>
        <DialogContent><DialogHeader><DialogTitle>Suspender {suspending?.name}</DialogTitle><DialogDescription>Informe o motivo. O histórico fica preservado e a loja poderá ser reativada depois.</DialogDescription></DialogHeader><Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Motivo da suspensão" /><DialogFooter><Button variant="outline" onClick={() => setSuspending(null)}>Voltar</Button><Button variant="destructive" disabled={!reason.trim() || suspend.isPending} onClick={() => void confirmSuspend()}>Confirmar suspensão</Button></DialogFooter></DialogContent>
      </Dialog>
    </main>
  );
}
