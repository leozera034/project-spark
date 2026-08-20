import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, RouteIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  bulkUpsertDeliveryNeighborhoods,
  fetchDeliveryNeighborhoodDistanceCandidates,
} from "./delivery-pricing.api";

function parseMoney(value: string) {
  const n = Number(value.trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function NeighborhoodDistanceBulkSelector({ storeId, canEdit }: { storeId: string; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["delivery-neighborhood-distance-candidates", storeId],
    queryFn: () => fetchDeliveryNeighborhoodDistanceCandidates(storeId),
    enabled: Boolean(storeId),
    retry: false,
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fee, setFee] = useState("5,00");
  const [minimum, setMinimum] = useState("");
  const [eta, setEta] = useState("40");
  const [maxKm, setMaxKm] = useState("");

  const visible = useMemo(() => {
    const limit = maxKm.trim() ? Number(maxKm.replace(",", ".")) : null;
    return (query.data?.items ?? []).filter((item) => limit == null || !Number.isFinite(limit) || item.distanceKm <= limit);
  }, [query.data?.items, maxKm]);

  const save = useMutation({
    mutationFn: async () => {
      const amount = parseMoney(fee);
      const min = minimum.trim() ? parseMoney(minimum) : null;
      const minutes = Number(eta);
      if (amount == null || (minimum.trim() && min == null) || !Number.isInteger(minutes) || minutes < 1) throw new Error("Confira taxa, pedido mínimo e prazo.");
      const items = (query.data?.items ?? []).filter((item) => selected.has(item.name));
      if (items.length === 0) throw new Error("Selecione pelo menos um bairro.");
      return bulkUpsertDeliveryNeighborhoods({
        storeId,
        items: items.map((item) => ({ name: item.name, deliveryFee: amount, minimumOrderAmount: min, estimatedMinutes: minutes })),
      });
    },
    onSuccess: async (result) => {
      toast.success(`${result.saved} bairro(s) configurado(s) com a mesma taxa.`);
      setSelected(new Set());
      await queryClient.invalidateQueries({ queryKey: ["delivery-neighborhood-distance-candidates", storeId] });
      await queryClient.invalidateQueries({ queryKey: ["store-config"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível aplicar a taxa em lote."),
  });

  if (query.isLoading) return <Card><CardContent className="p-5 text-sm text-muted-foreground">Calculando distâncias dos bairros conhecidos…</CardContent></Card>;
  if (query.isError) return null;

  if (!query.data?.storeLocationReady) {
    return (
      <Card className="border-warning/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><MapPin className="size-4" /> Confirme a localização da loja</CardTitle>
          <CardDescription>Para mostrar a quilometragem de cada bairro, a loja precisa ter latitude e longitude confirmadas. Faça isso em Configurações → Endereço.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if ((query.data?.items.length ?? 0) === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bairros com distância da loja</CardTitle>
          <CardDescription>A localização da loja está pronta, mas ainda não existem endereços geolocalizados suficientes para sugerir bairros automaticamente. O importador por cidade/CEP será a próxima fonte de bairros.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const allVisibleSelected = visible.length > 0 && visible.every((item) => selected.has(item.name));

  return (
    <Card className="border-brand/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><RouteIcon className="size-5 text-brand" /> Selecionar bairros pela distância</CardTitle>
        <CardDescription>Veja a distância aproximada da loja, selecione vários bairros manualmente ou limite por quilometragem e aplique uma única taxa em lote.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1.5"><Label>Mostrar até quantos km?</Label><Input inputMode="decimal" value={maxKm} onChange={(e) => setMaxKm(e.target.value)} placeholder="Todos" /></div>
          <div className="space-y-1.5"><Label>Taxa para selecionados</Label><Input inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Pedido mínimo</Label><Input inputMode="decimal" value={minimum} onChange={(e) => setMinimum(e.target.value)} placeholder="Padrão da loja" /></div>
          <div className="space-y-1.5"><Label>Prazo (min)</Label><Input inputMode="numeric" value={eta} onChange={(e) => setEta(e.target.value)} /></div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setSelected(new Set(allVisibleSelected ? [] : visible.map((item) => item.name)))}>
            {allVisibleSelected ? "Desmarcar visíveis" : `Selecionar ${visible.length} visíveis`}
          </Button>
          <Button type="button" size="sm" disabled={!canEdit || selected.size === 0 || save.isPending} onClick={() => save.mutate()}>
            Aplicar taxa em {selected.size} bairro(s)
          </Button>
        </div>

        <div className="max-h-96 divide-y overflow-y-auto rounded-xl border">
          {visible.map((item) => (
            <label key={item.name} className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-muted/40">
              <Checkbox checked={selected.has(item.name)} onCheckedChange={(checked) => setSelected((current) => { const next = new Set(current); if (checked) next.add(item.name); else next.delete(item.name); return next; })} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.sampleCount} endereço(s) geolocalizado(s){item.existingNeighborhoodId ? " · já cadastrado" : ""}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold tabular-nums">{item.distanceKm.toFixed(2)} km</p>
                {item.existingFee != null ? <p className="text-xs text-muted-foreground">Taxa atual R$ {Number(item.existingFee).toFixed(2).replace(".", ",")}</p> : null}
              </div>
            </label>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
