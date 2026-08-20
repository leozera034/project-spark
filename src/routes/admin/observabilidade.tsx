import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react";
import { usePlatformRecentErrors } from "@/store/platform/platform-admin.queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/observabilidade")({ component: AdminObservabilityPage });

function AdminObservabilityPage() {
  const errors = usePlatformRecentErrors(100);
  return <main className="mx-auto w-full max-w-[1400px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[.16em] text-brand">Observabilidade</p><h1 className="mt-1 font-display text-3xl font-black">Erros e saúde técnica</h1><p className="mt-2 text-sm text-muted-foreground">Falhas capturadas pela aplicação, com origem, rota e horário.</p></div><Button variant="outline" onClick={() => void errors.refetch()}><RefreshCw className="size-4" /> Atualizar</Button></header>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-brand" /> Erros recentes</CardTitle><CardDescription>{errors.data?.length ?? 0} registro(s) carregado(s).</CardDescription></CardHeader><CardContent className="space-y-2">{errors.isLoading?<p className="text-sm text-muted-foreground">Carregando…</p>:(errors.data?.length??0)===0?<div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum erro recente registrado.</div>:errors.data?.map((item)=><div key={item.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold">{item.message ?? "Erro sem mensagem"}</p><p className="mt-1 text-xs text-muted-foreground">{item.route ?? "rota desconhecida"} · {item.source ?? item.boundary ?? "origem desconhecida"}</p></div><Badge variant="destructive"><AlertTriangle className="mr-1 size-3" /> {new Date(item.createdAt).toLocaleString("pt-BR")}</Badge></div></div>)}</CardContent></Card>
  </main>;
}
