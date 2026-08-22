import { useState } from "react";

import type { CatalogCategory, CatalogProduct } from "./types";
import { formatPriceBRL, parsePriceInput } from "./types";
import { Badge } from "@/components/ui/badge";
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

function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-destructive">
      {" "}*
    </span>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
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
  const categoryName = categories.find((c) => c.id === values.categoryId)?.name;

  function set<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    onChange({ ...values, [key]: value });
  }

  function handleSubmit() {
    setTouched(true);
    if (!invalid) onSubmit();
  }

  return (
    <div className="pb-24 lg:pb-0">
      <div className="grid gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="space-y-4">
          <FormSection
            title="Informações básicas"
            description="Nome, categoria e descrição que o cliente vê no cardápio."
          >
            <div className="space-y-1.5">
              <Label htmlFor="prod-categoria">
                Categoria
                <RequiredMark />
              </Label>
              <Select value={values.categoryId} onValueChange={(v) => set("categoryId", v)}>
                <SelectTrigger id="prod-categoria" aria-invalid={touched && categoryInvalid}>
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
                <p role="alert" className="text-xs text-destructive">
                  Escolha uma categoria.
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prod-nome">
                Nome
                <RequiredMark />
              </Label>
              <Input
                id="prod-nome"
                value={values.name}
                maxLength={80}
                aria-invalid={touched && nameInvalid}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Ex.: Refrigerante lata 350ml"
              />
              <div className="flex items-start justify-between gap-3 text-xs">
                <span className={touched && nameInvalid ? "text-destructive" : "text-muted-foreground"}>
                  {touched && nameInvalid ? "Use entre 2 e 80 caracteres." : "Use um nome curto e fácil de reconhecer."}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{values.name.length}/80</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prod-desc">Descrição (opcional)</Label>
              <Textarea
                id="prod-desc"
                value={values.description}
                maxLength={500}
                rows={4}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Destaque ingredientes, tamanho, acompanhamentos ou o que torna este item especial."
              />
              <p className="text-right text-xs tabular-nums text-muted-foreground">{values.description.length}/500</p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Switch
                id="prod-obs"
                checked={values.allowsNotes}
                onCheckedChange={(v) => set("allowsNotes", Boolean(v))}
              />
              <Label htmlFor="prod-obs">Permitir observações do cliente</Label>
            </div>
          </FormSection>

          <FormSection title="Preço" description="Valor principal usado para apresentar e calcular o produto.">
            <div className="space-y-1.5">
              <Label htmlFor="prod-preco">
                Preço
                <RequiredMark />
              </Label>
              <Input
                id="prod-preco"
                inputMode="decimal"
                value={values.price}
                aria-invalid={touched && priceInvalid}
                onChange={(e) => set("price", e.target.value)}
                placeholder="0,00"
                className="max-w-[180px]"
              />
              <p className="text-xs text-muted-foreground">
                {price !== null && price > 0
                  ? `O cliente verá ${formatPriceBRL(price)} como preço base.`
                  : "Informe um valor válido maior que zero."}
              </p>
              {touched && priceInvalid ? (
                <p role="alert" className="text-xs text-destructive">
                  Informe um preço válido maior que zero.
                </p>
              ) : null}
            </div>
          </FormSection>

          {showStatusFields ? (
            <FormSection
              title="Disponibilidade"
              description="Controle se o produto aparece e como aparece para o cliente."
            >
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-3">
                <div><Label htmlFor="prod-ativo">Publicar no cardápio</Label><p className="mt-0.5 text-xs text-muted-foreground">Desative para esconder o item sem apagar o histórico.</p></div>
                <Switch id="prod-ativo" checked={values.isActive} onCheckedChange={(v) => set("isActive", Boolean(v))} />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-3">
                <div><Label htmlFor="prod-destaque">Marcar como destaque</Label><p className="mt-0.5 text-xs text-muted-foreground">Ajuda o cliente a identificar itens importantes.</p></div>
                <Switch id="prod-destaque" checked={values.isFeatured} onCheckedChange={(v) => set("isFeatured", Boolean(v))} />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-3">
                <div><Label htmlFor="prod-esgotado">Iniciar como esgotado</Label><p className="mt-0.5 text-xs text-muted-foreground">O item continua visível, mas não pode ser adicionado ao pedido.</p></div>
                <Switch id="prod-esgotado" checked={values.isSoldOut} onCheckedChange={(v) => set("isSoldOut", Boolean(v))} />
              </div>
            </FormSection>
          ) : null}

          <div className="hidden flex-wrap gap-2 lg:flex">
            <Button loading={submitting} loadingLabel="Salvando" onClick={handleSubmit}>
              {submitting ? "Salvando…" : submitLabel}
            </Button>
            <Button variant="ghost" onClick={onCancel} disabled={submitting}>
              Cancelar
            </Button>
          </div>
        </div>

        <Card className="h-fit lg:sticky lg:top-6">
          <CardHeader>
            <CardTitle className="text-base">Prévia no cardápio</CardTitle>
            <CardDescription>Uma aproximação de como o item será entendido pelo cliente.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-1.5">
                {categoryName ? <span className="text-xs font-medium text-muted-foreground">{categoryName}</span> : null}
                {!values.isActive ? <Badge variant="secondary">Oculto</Badge> : null}
                {values.isFeatured ? <Badge variant="brand">Destaque</Badge> : null}
                {values.isSoldOut ? <Badge variant="destructive">Esgotado</Badge> : null}
              </div>
              <p className="mt-2 font-display font-bold text-foreground">
                {values.name.trim() || "Nome do produto"}
              </p>
              <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                {values.description.trim() || "A descrição aparece aqui para ajudar o cliente a decidir."}
              </p>
              <p className="mt-3 text-lg font-black text-brand">
                {price !== null && price > 0 ? formatPriceBRL(price) : "R$ 0,00"}
              </p>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Depois de salvar, use “Ver como cliente” na área do Cardápio para conferir a publicação real, inclusive foto, opções e disponibilidade.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur supports-backdrop-filter:bg-card/80 lg:hidden">
        <div className="mx-auto flex max-w-5xl gap-2">
          <Button
            className="min-h-11 flex-1"
            loading={submitting}
            loadingLabel="Salvando"
            onClick={handleSubmit}
          >
            {submitting ? "Salvando…" : submitLabel}
          </Button>
          <Button variant="ghost" className="min-h-11" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
