import { useState } from "react";

import type { CatalogCategory, CatalogProduct } from "./types";
import { formatPriceBRL, parsePriceInput } from "./types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export interface ProductFormValues {
  categoryId: string;
  name: string;
  description: string;
  price: string;
  allowsNotes: boolean;
  isActive: boolean;
  isFeatured: boolean;
  isSoldOut: boolean;
}

export function initialProductValues(product?: CatalogProduct | null): ProductFormValues {
  return {
    categoryId: product?.category_id ?? "",
    name: product?.name ?? "",
    description: product?.description ?? "",
    price: product ? String(product.base_price).replace(".", ",") : "",
    allowsNotes: product?.allows_notes ?? true,
    isActive: product?.is_active ?? true,
    isFeatured: product?.is_featured ?? false,
    isSoldOut: product?.is_sold_out ?? false,
  };
}

export function ProductForm({
  categories,
  values,
  onChange,
  onSubmit,
  onCancel,
  submitting,
  showStatusFields,
  submitLabel,
}: {
  categories: CatalogCategory[];
  values: ProductFormValues;
  onChange: (next: ProductFormValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitting: boolean;
  showStatusFields: boolean;
  submitLabel: string;
}) {
  const [touched, setTouched] = useState(false);
  const price = parsePriceInput(values.price);
  const nameInvalid = values.name.trim().length < 2 || values.name.trim().length > 80;
  const priceInvalid = price === null || price <= 0 || price > 99999;
  const categoryInvalid = values.categoryId === "";
  const invalid = nameInvalid || priceInvalid || categoryInvalid;

  function set<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    onChange({ ...values, [key]: value });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do produto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="prod-categoria">Categoria</Label>
            <Select value={values.categoryId} onValueChange={(v) => set("categoryId", v)}>
              <SelectTrigger id="prod-categoria">
                <SelectValue placeholder="Escolha a categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.is_active ? "" : " (inativa)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {touched && categoryInvalid ? (
              <p className="text-xs text-destructive">Escolha uma categoria.</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prod-nome">Nome</Label>
            <Input
              id="prod-nome"
              value={values.name}
              maxLength={80}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ex.: Refrigerante lata 350ml"
            />
            {touched && nameInvalid ? (
              <p className="text-xs text-destructive">Use entre 2 e 80 caracteres.</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prod-desc">Descrição (opcional)</Label>
            <Textarea
              id="prod-desc"
              value={values.description}
              maxLength={500}
              rows={4}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prod-preco">Preço</Label>
            <Input
              id="prod-preco"
              inputMode="decimal"
              value={values.price}
              onChange={(e) => set("price", e.target.value)}
              placeholder="0,00"
            />
            <p className="text-xs text-muted-foreground">
              {price !== null && price > 0
                ? `O cliente verá ${formatPriceBRL(price)}`
                : "Informe o valor cobrado por unidade."}
            </p>
            {touched && priceInvalid ? (
              <p className="text-xs text-destructive">Informe um preço válido maior que zero.</p>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="prod-obs"
              checked={values.allowsNotes}
              onCheckedChange={(v) => set("allowsNotes", Boolean(v))}
            />
            <Label htmlFor="prod-obs">Permitir observações do cliente</Label>
          </div>

          {showStatusFields ? (
            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="prod-ativo"
                  checked={values.isActive}
                  onCheckedChange={(v) => set("isActive", Boolean(v))}
                />
                <Label htmlFor="prod-ativo">Publicar no cardápio</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="prod-destaque"
                  checked={values.isFeatured}
                  onCheckedChange={(v) => set("isFeatured", Boolean(v))}
                />
                <Label htmlFor="prod-destaque">Marcar como destaque</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="prod-esgotado"
                  checked={values.isSoldOut}
                  onCheckedChange={(v) => set("isSoldOut", Boolean(v))}
                />
                <Label htmlFor="prod-esgotado">Já iniciar como esgotado</Label>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              loading={submitting}
              loadingLabel="Salvando"
              onClick={() => {
                setTouched(true);
                if (!invalid) onSubmit();
              }}
            >
              {submitting ? "Salvando…" : submitLabel}
            </Button>
            <Button variant="ghost" onClick={onCancel} disabled={submitting}>
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">Prévia administrativa</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border p-4">
            <p className="font-medium text-foreground">{values.name.trim() || "Nome do produto"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {values.description.trim() || "A descrição aparece aqui para o cliente."}
            </p>
            <p className="mt-3 text-lg font-semibold text-foreground">
              {price !== null && price > 0 ? formatPriceBRL(price) : "R$ 0,00"}
            </p>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Esta prévia é apenas interna. A vitrine pública do cliente chega em fase posterior.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
