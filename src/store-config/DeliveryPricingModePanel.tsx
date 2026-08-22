import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleDollarSign, MapPinned, Plus, Radar, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NeighborhoodDistanceBulkSelector } from "./NeighborhoodDistanceBulkSelector";
import {
  fetchDeliveryPricingConfig,
  replaceDeliveryRadiusBands,
  updateDeliveryPricingConfig,
  type DeliveryPricingMode,
  type DeliveryRadiusBand,
} from "./delivery-pricing.api";

function numberValue(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function radiusDraft(): DeliveryRadiusBand {
  return { max_distance_km: 3, delivery_fee: 5, min_order_amount: null, eta_minutes: 40, is_active: true };
}

export function DeliveryPricingModePanel({ storeId, canEdit }: { storeId: string; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["delivery-pricing", storeId], queryFn: () => fetchDeliveryPricingConfig(storeId), enabled: Boolean(storeId), retry: false });
  const config = query.data;
  const [mode, setMode] = useState<DeliveryPricingMode>("neighborhood");
  const [fixedFee, setFixedFee] = useState("0,00");
  const [fixedMin, setFixedMin] = useState("");
  const [fixedEta, setFixedEta] = useState("40");
  const [bands, setBands] = useState<DeliveryRadiusBand[]>([]);

  useEffect(() => {
    if (!config) return;
    setMode(config.mode);
    setFixedFee(Number(config.fixed_fee ?? 0).toFixed(2).replace(".", ","));
    setFixedMin(config.fixed_min_order_amount == null ? "" : Number(config.fixed_min_order_amount).toFixed(2).replace(".", ","));
    setFixedEta(String(config.fixed_eta_minutes ?? 40));
    setBands(config.radius_bands ?? []);
  }, [config]);

  const sortedBands = useMemo(() => [...bands].sort((a, b) => Number(a.max_distance_km) - Number(b.max_distance_km)), [bands]);

  const saveConfig = useMutation({
    mutationFn: async () => {
      const fee = numberValue(fixedFee);
      const min = fixedMin.trim() ? numberValue(fixedMin) : null;
      const eta = Number(fixedEta);
      if (fee == null || (min == null && fixedMin.trim()) || !Number.isInteger(eta) || eta < 1) throw new Error("Confira os valores da configuração.");
      return updateDeliveryPricingConfig({ storeId, mode, fixedFee: fee, fixedMinOrderAmount: min, fixedEtaMinutes: eta });
    },
    onSuccess: async () => { toast.success("Forma de cobrança salva."); await queryClient.invalidateQueries({ queryKey: ["delivery-pricing", storeId] }); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível salvar."),
  });

  const saveBands = useMutation({
    mutationFn: async () => {
      if (sortedBands.length === 0) throw new Error("Crie pelo menos uma faixa de distância.");
      let previous = 0;
      for (const band of sortedBands) {
        const distance = Number(band.max_distance_km);
        if (!Number.isFinite(distance) || distance <= previous) throw new Error("As faixas precisam ter distâncias crescentes.");
        if (!Number.isFinite(Number(band.delivery_fee)) || Number(band.delivery_fee) < 0) throw new Error("Confira as taxas das faixas.");
        previous = distance;
      }
      return replaceDeliveryRadiusBands(storeId, sortedBands);
    },
    onSuccess: async () => { toast.success("Faixas de distância salvas."); await queryClient.invalidateQueries({ queryKey: ["delivery-pricing", storeId] }); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível salvar as faixas."),
  });

  if (query.isLoading) return <Card><CardContent className="p-6 text-sm text-muted-foreground">Carregando configuração de entrega…</CardContent></Card>;
  if (query.isError) return <Card><CardContent className="p-6 text-sm text-destructive">Não foi possível carregar a configuração de entrega.</CardContent></Card>;

  const choices: Array<{ value: DeliveryPricingMode; title: string; description: string; icon: typeof MapPinned }> = [
    { value: "fixed", title: "Taxa fixa", description: "Uma única taxa para todos os endereços atendidos.", icon: CircleDollarSign },
    { value: "radius", title: "Por distância", description: "Defina valores diferentes conforme a distância da loja.", icon: Radar },
    { value: "neighborhood", title: "Por bairro", description: "Defina uma taxa específica para cada bairro atendido.", icon: MapPinned },
  ];

  return (
    <div className="space-y-5">
      <Card className="border-brand/20">
        <CardHeader>
          <CardTitle>Como você cobra a entrega?</CardTitle>
          <CardDescription>Escolha a opção que combina melhor com sua operação. Você pode mudar depois.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            {choices.map((choice) => {
              const Icon = choice.icon;
              return (
                <button key={choice.value} type="button" disabled={!canEdit} onClick={() => setMode(choice.value)} className={`rounded-xl border p-4 text-left transition ${mode === choice.value ? "border-brand bg-brand-soft/40 ring-2 ring-brand/10" : "border-border hover:border-brand/40"}`}>
                  <Icon className="mb-3 size-5 text-brand" />
                  <p className="font-semibold">{choice.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{choice.description}</p>
                </button>
              );
            })}
          </div>

          {mode === "fixed" ? (
            <div className="grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-3">
              <div className="space-y-1.5"><Label>Taxa de entrega</Label><Input inputMode="decimal" value={fixedFee} onChange={(e) => setFixedFee(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Pedido mínimo</Label><Input inputMode="decimal" placeholder="Sem mínimo específico" value={fixedMin} onChange={(e) => setFixedMin(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Prazo estimado (min)</Label><Input inputMode="numeric" value={fixedEta} onChange={(e) => setFixedEta(e.target.value)} /></div>
            </div>
          ) : null}

          {mode === "radius" ? (
            <div className="space-y-4 rounded-xl border border-border p-4">
              <div><p className="font-semibold">Faixas de distância</p><p className="text-xs text-muted-foreground">Exemplo: até 3 km por R$ 5, até 5 km por R$ 8.</p></div>
              {sortedBands.map((band, index) => (
                <div key={band.id ?? index} className="grid gap-2 rounded-lg bg-muted/30 p-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] sm:items-end">
                  <div className="space-y-1"><Label>Até (km)</Label><Input inputMode="decimal" value={String(band.max_distance_km)} onChange={(e) => setBands((current) => current.map((row) => row === band ? { ...row, max_distance_km: Number(e.target.value.replace(",", ".")) } : row))} /></div>
                  <div className="space-y-1"><Label>Taxa</Label><Input inputMode="decimal" value={String(band.delivery_fee)} onChange={(e) => setBands((current) => current.map((row) => row === band ? { ...row, delivery_fee: Number(e.target.value.replace(",", ".")) } : row))} /></div>
                  <div className="space-y-1"><Label>Pedido mínimo</Label><Input inputMode="decimal" value={band.min_order_amount ?? ""} onChange={(e) => setBands((current) => current.map((row) => row === band ? { ...row, min_order_amount: e.target.value ? Number(e.target.value.replace(",", ".")) : null } : row))} /></div>
                  <div className="space-y-1"><Label>Prazo (min)</Label><Input inputMode="numeric" value={band.eta_minutes ?? ""} onChange={(e) => setBands((current) => current.map((row) => row === band ? { ...row, eta_minutes: e.target.value ? Number(e.target.value) : null } : row))} /></div>
                  <Button type="button" size="icon" variant="ghost" disabled={!canEdit} onClick={() => setBands((current) => current.filter((row) => row !== band))}><Trash2 className="size-4" /></Button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={!canEdit} onClick={() => setBands((current) => [...current, radiusDraft()])}><Plus className="mr-1 size-4" /> Adicionar faixa</Button><Button type="button" disabled={!canEdit || saveBands.isPending} onClick={() => saveBands.mutate()}>Salvar faixas</Button></div>
            </div>
          ) : null}

          {mode === "neighborhood" ? <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">Cadastre os bairros abaixo e defina taxa, pedido mínimo e prazo para cada um. Você também pode aplicar o mesmo valor a vários bairros de uma vez.</div> : null}

          <div className="flex justify-end"><Button disabled={!canEdit || saveConfig.isPending} onClick={() => saveConfig.mutate()}>Salvar forma de cobrança</Button></div>
        </CardContent>
      </Card>

      {mode === "neighborhood" ? <NeighborhoodDistanceBulkSelector storeId={storeId} canEdit={canEdit} /> : null}
    </div>
  );
}
