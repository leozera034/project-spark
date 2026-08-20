import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BriefcaseBusiness, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/servicos")({
  head: () => ({ meta: [{ title: "Serviços profissionais | Comandiva Admin" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: ProfessionalServicesAdminPage,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = supabase.rpc.bind(supabase) as any;
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type Service = { id: string; code: string; name: string; description: string | null; price_cents: number | null; currency: string; is_active: boolean; sort_order: number };

function ProfessionalServicesAdminPage() {
  const queryClient = useQueryClient();
  const services = useQuery({
    queryKey: ["admin", "professional-services"],
    queryFn: async () => {
      const { data, error } = await rpc("admin_list_professional_services", {});
      if (error) throw new Error(error.message);
      return (data ?? []) as Service[];
    },
    retry: false,
  });

  return (
    <main className="mx-auto w-full max-w-[1200px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="rounded-[28px] border border-white/10 bg-[#4B1D6D] p-6 text-white shadow-e2 sm:p-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[.12em]"><BriefcaseBusiness className="size-3.5" /> Receita avulsa</div>
        <h1 className="mt-4 font-display text-3xl font-black sm:text-4xl">Serviços profissionais</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/70">Defina preços de serviços executados pela equipe sem misturar com assinatura ou add-ons recorrentes.</p>
      </section>

      {services.isLoading ? <Card><CardContent className="p-8 text-sm text-muted-foreground">Carregando serviços…</CardContent></Card> : services.isError ? <Card><CardContent className="p-8 text-sm text-destructive">Não foi possível carregar os serviços. Verifique sua permissão de dono do SaaS.</CardContent></Card> : services.data?.map((service) => <ServiceEditor key={service.id} service={service} onSaved={() => queryClient.invalidateQueries({ queryKey: ["admin", "professional-services"] })} />)}
    </main>
  );
}

function ServiceEditor({ service, onSaved }: { service: Service; onSaved: () => Promise<unknown> }) {
  const [price, setPrice] = useState(service.price_cents ? (service.price_cents / 100).toFixed(2).replace(".", ",") : "");
  const [active, setActive] = useState(service.is_active);
  useEffect(() => { setPrice(service.price_cents ? (service.price_cents / 100).toFixed(2).replace(".", ",") : ""); setActive(service.is_active); }, [service.price_cents, service.is_active]);

  const save = useMutation({
    mutationFn: async () => {
      const value = Number(price.replace(/\./g, "").replace(",", "."));
      const cents = Math.round(value * 100);
      if (!Number.isFinite(cents) || cents <= 0) throw new Error("INVALID_PRICE");
      const { data, error } = await rpc("admin_update_professional_service", { _service_id: service.id, _price_cents: cents, _is_active: active });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: async () => { toast.success("Preço do serviço atualizado."); await onSaved(); },
    onError: () => toast.error("Não foi possível salvar o serviço."),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{service.name}</CardTitle><CardDescription className="mt-2 max-w-3xl">{service.description}</CardDescription></div><Badge variant={service.is_active ? "success" : "outline"}>{service.is_active ? "Ativo" : "Inativo"}</Badge></div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[220px_auto] sm:items-end">
          <div><Label>Preço avulso (R$)</Label><Input className="mt-1" inputMode="decimal" placeholder="Ex.: 199,00" value={price} onChange={(event) => setPrice(event.target.value)} /></div>
          <label className="flex h-10 items-center gap-2 rounded-xl border px-3 text-sm"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Disponível para novas solicitações</label>
        </div>
        <div className="flex flex-wrap items-center gap-3"><Button disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}Salvar serviço</Button><span className="text-sm text-muted-foreground">Atual: {service.price_cents ? brl.format(service.price_cents / 100) : "sem preço definido"}</span></div>
      </CardContent>
    </Card>
  );
}
