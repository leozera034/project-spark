import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { updateSaleMode } from "../advanced-api";
import {
  MEASUREMENT_LABELS,
  SALE_MODE_LABELS,
  type AdvancedBuilder,
  type MeasurementUnit,
  type ProductSaleMode,
} from "../advanced-types";
import { useCatalog } from "../CatalogProvider";

const MEASURED_UNITS: MeasurementUnit[] = ["kg", "g", "l", "ml"];

export function SaleModeCard({
  builder,
  onSaved,
}: {
  builder: AdvancedBuilder;
  onSaved: () => void;
}) {
  const { storeId, run, isBusy } = useCatalog();
  const product = builder.product;
  const canUpdate = builder.can.update && !product.is_archived;

  const [mode, setMode] = useState<ProductSaleMode>(product.sale_mode);
  const [unit, setUnit] = useState<MeasurementUnit>(
    product.measurement_unit === "unit" ? "kg" : product.measurement_unit,
  );
  const [minimum, setMinimum] = useState(String(product.minimum_quantity ?? 1));
  const [step, setStep] = useState(String(product.quantity_step ?? 1));

  useEffect(() => {
    setMode(product.sale_mode);
    setUnit(product.measurement_unit === "unit" ? "kg" : product.measurement_unit);
    setMinimum(String(product.minimum_quantity ?? 1));
    setStep(String(product.quantity_step ?? 1));
  }, [product.sale_mode, product.measurement_unit, product.minimum_quantity, product.quantity_step]);

  async function save() {
    if (!storeId) return;
    const min = Number(minimum.replace(",", "."));
    const stp = Number(step.replace(",", "."));
    const saved = await run(
      () =>
        updateSaleMode({
          storeId,
          productId: product.id,
          saleMode: mode,
          measurementUnit: mode === "measured" ? unit : "unit",
          minimumQuantity: mode === "measured" ? min : 1,
          quantityStep: mode === "measured" ? stp : 1,
          expectedUpdatedAt: product.updated_at,
        }),
      "Modo de venda atualizado.",
    );
    if (saved) onSaved();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Como este produto é vendido</CardTitle>
        <CardDescription>
          O modo de venda define se o cliente escolhe unidades, peso/volume ou uma embalagem pronta.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="sale-mode">Modo de venda</Label>
          <Select
            value={mode}
            onValueChange={(v) => setMode(v as ProductSaleMode)}
            disabled={!canUpdate}
          >
            <SelectTrigger id="sale-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SALE_MODE_LABELS) as ProductSaleMode[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {SALE_MODE_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {mode === "unit"
              ? "O cliente escolhe uma quantidade inteira de unidades."
              : mode === "measured"
                ? "O cliente escolhe o peso ou volume exato. O valor não muda depois do pedido."
                : "O cliente escolhe uma embalagem já pesada, cadastrada como variação."}
          </p>
        </div>

        {mode === "measured" ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="sale-unit">Unidade</Label>
              <Select
                value={unit}
                onValueChange={(v) => setUnit(v as MeasurementUnit)}
                disabled={!canUpdate}
              >
                <SelectTrigger id="sale-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEASURED_UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {MEASUREMENT_LABELS[u]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sale-min">Quantidade mínima</Label>
              <Input
                id="sale-min"
                inputMode="decimal"
                value={minimum}
                disabled={!canUpdate}
                onChange={(e) => setMinimum(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sale-step">Incremento</Label>
              <Input
                id="sale-step"
                inputMode="decimal"
                value={step}
                disabled={!canUpdate}
                onChange={(e) => setStep(e.target.value)}
              />
            </div>
          </div>
        ) : null}

        {canUpdate ? (
          <Button disabled={isBusy} onClick={() => void save()}>
            Salvar modo de venda
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
