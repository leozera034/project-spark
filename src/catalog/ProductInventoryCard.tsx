import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Boxes, TriangleAlert } from "lucide-react";

import { useCatalog } from "@/catalog/CatalogProvider";
import { getProductInventory, updateProductInventory } from "@/catalog/shark-engine.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

export function ProductInventoryCard({ productId, canUpdate }: { productId: string; canUpdate: boolean }) {
  const { storeId, run, isBusy } = useCatalog();
  const query = useQuery({
    queryKey: ["catalog", "product-inventory", storeId, productId],
    queryFn: () => getProductInventory(storeId!, productId),
    enabled: Boolean(storeId),
    retry: false,
  });

  const [managed, setManaged] = useState(false);
  const [quantity, setQuantity] = useState("0");
  const [threshold, setThreshold] = useState("5");

  useEffect(() => {
    if (!query.data) return;
    setManaged(query.data.managed);
    setQuantity(String(query.data.quantity ?? 0));
    setThreshold(String(query.data.low_stock_threshold ?? 5));
  }, [query.data]);

  if (query.isLoading) return <Skeleton className="h-44 w-full" />;
  if (query.error) return null;

  const parsedQuantity = Math.max(0, Number(quantity) || 0);
  const parsedThreshold = Math.max(0, Number(threshold) || 0);

  async function save() {
    if (!storeId || !query.data?.updated_at) return;
    const result = await run(() => updateProductInventory({
      storeId,
      productId,
      managed,
      quantity: managed ? parsedQuantity : null,
      lowStockThreshold: parsedThreshold,
      expectedUpdatedAt: query.data.updated_at,
    }), "Estoque atualizado.");
    if (result) void query.refetch();
  }

  return (
    <Card className="border-violet-400/15">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex items-center gap-2 text-violet-300"><Boxes className="size-4" /><span className="text-xs font-semibold uppercase tracking-[.14em]">Estoque</span></div>
            <CardTitle className="text-base">Controle de disponibilidade</CardTitle>
            <CardDescription>Opcional. Quando ativado, o SHARK reserva estoque no checkout e devolve automaticamente se o pedido for recusado ou cancelado.</CardDescription>
          </div>
          {query.data?.is_empty ? <Badge variant="destructive">Esgotado</Badge> : query.data?.is_low ? <Badge variant="outline"><TriangleAlert className="mr-1 size-3.5" />Estoque baixo</Badge> : managed ? <Badge variant="secondary">Controlado</Badge> : <Badge variant="outline">Sem controle</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-border bg-background/40 p-4">
          <div><p className="text-sm font-semibold">Controlar estoque deste produto</p><p className="mt-1 text-xs text-muted-foreground">Desligado = disponibilidade ilimitada até você marcar o item como indisponível.</p></div>
          <Switch checked={managed} disabled={!canUpdate} onCheckedChange={(value) => setManaged(Boolean(value))} />
        </label>

        {managed ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`stock-${productId}`}>Quantidade disponível</Label>
              <Input id={`stock-${productId}`} type="number" min="0" step="0.001" value={quantity} disabled={!canUpdate} onChange={(event) => setQuantity(event.target.value)} />
              <p className="text-xs text-muted-foreground">Aceita decimal para produtos vendidos por peso/volume.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`threshold-${productId}`}>Avisar quando chegar em</Label>
              <Input id={`threshold-${productId}`} type="number" min="0" step="0.001" value={threshold} disabled={!canUpdate} onChange={(event) => setThreshold(event.target.value)} />
              <p className="text-xs text-muted-foreground">Usado para destacar estoque baixo no painel.</p>
            </div>
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button disabled={!canUpdate || isBusy || !query.data?.updated_at} onClick={() => void save()}>Salvar estoque</Button>
        </div>
      </CardContent>
    </Card>
  );
}
