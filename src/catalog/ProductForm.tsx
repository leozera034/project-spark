import { useState } from "react";

import type { CatalogCategory, CatalogProduct } from "./types";
import { formatPriceBRL, parsePriceInput } from "./types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  return <span aria-hidden="true" className="text-destructive"> *</span>;
}

function FormSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
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

export function ProductForm({ categories, values, onChange, onSubmit, onCancel, submitting, showStatusFields, submitLabel }: {
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
          <FormSection title="O que o cliente vai ver" description="Só o essencial: categoria, nome e uma descrição curta.">
            <div className="space-y-1.5">
              <Label htmlFor="prod-categoria">Categoria<RequiredMark /></Label>
              <Select value={values.categoryId} onValueChange={(v) => set("categoryId", v)}>
                <SelectTrigger id="prod-categoria" aria-invalid={touched && categoryInvalid}><SelectValue placeholder="Escolha a categoria" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.is_active ? "" : " (inativa)"}</SelectItem>)}
                </SelectContent>
              </Select>
              {touched && categoryInvalid ? <p role="alert" className="text-xs text-destructive">Escolha uma categoria.</p> : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prod-nome">Nome<RequiredMark /></Label>
              <Input id="prod-nome" value={values.name} maxLength={80} aria-invalid={touched && nameInvalid} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Pizza Calabresa, X-Burger, Açaí 500 ml" />
              {touched && nameInvalid ? <p role="alert" className="text-xs text-destructive">Use entre 2 e 80 caracteres.</p> : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prod-desc">Descrição <span className="font-normal text-muted-foreground">(opcional)</span></Label>
              <Textarea id="prod-desc" value={values.description} maxLength={500} rows={3} onChange={(e) => set("description", e.target.value)} placeholder="Conte em uma frase o que vem neste item." />
            </div>

            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border px-3 py-3">
              <div><p className="text-sm font-medium">Permitir observações</p><p className="text-xs text-muted-foreground">Ex.: sem cebola, bem passado, pouco gelo.</p></div>
              <Switch id="prod-obs" checked={values.allowsNotes} onCheckedChange={(v) => set("allowsNotes", Boolean(v))} />
            </label>
          </FormSection>

          <FormSection title="Preço inicial" description="É o valor base. Tamanhos, sabores, adicionais e combos podem alterar o preço depois.">
            <div className="space-y-1.5">
              <Label htmlFor="prod-preco">Preço base<RequiredMark /></Label>
              <Input id="prod-preco" inputMode="decimal" value={values.price} aria-invalid={touched && priceInvalid} onChange={(e) => set("price", e.target.value)} placeholder="0,00" className="max-w-[180px]" />
              <p className="text-xs text-muted-foreground">{price !== null && price > 0 ? `Começa em ${formatPriceBRL(price)}` : "Informe o preço inicial do produto."}</p>
              {touched && priceInvalid ? <p role="alert" className="text-xs text-destructive">Informe um preço válido maior que zero.</p> : null}
            </div>
          </FormSection>

          {showStatusFields ? (
            <FormSection title="Publicação" description="Você pode mudar estas opções a qualquer momento.">
              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border px-3 py-3"><div><p className="text-sm font-medium">Mostrar no cardápio</p><p className="text-xs text-muted-foreground">O cliente já poderá encontrar este item.</p></div><Switch id="prod-ativo" checked={values.isActive} onCheckedChange={(v) => set("isActive", Boolean(v))} /></label>
              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border px-3 py-3"><div><p className="text-sm font-medium">Dar destaque</p><p className="text-xs text-muted-foreground">Valoriza este item na vitrine.</p></div><Switch id="prod-destaque" checked={values.isFeatured} onCheckedChange={(v) => set("isFeatured", Boolean(v))} /></label>
              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border px-3 py-3"><div><p className="text-sm font-medium">Começar esgotado</p><p className="text-xs text-muted-foreground">Útil quando você quer configurar agora e vender depois.</p></div><Switch id="prod-esgotado" checked={values.isSoldOut} onCheckedChange={(v) => set("isSoldOut", Boolean(v))} /></label>
            </FormSection>
          ) : null}

          <div className="hidden flex-wrap gap-2 lg:flex">
            <Button loading={submitting} loadingLabel="Salvando" onClick={handleSubmit}>{submitting ? "Salvando…" : submitLabel}</Button>
            <Button variant="ghost" onClick={onCancel} disabled={submitting}>Cancelar</Button>
          </div>
        </div>

        <Card className="h-fit overflow-hidden lg:sticky lg:top-6">
          <CardHeader>
            <CardTitle className="text-base">Prévia do cardápio</CardTitle>
            <CardDescription>Uma ideia de como o cliente vai enxergar este item.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border border-violet-400/10 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,.10),transparent_45%),var(--surface)] p-4">
              <div className="flex flex-wrap items-center gap-1.5">
                {categoryName ? <span className="text-xs font-medium text-muted-foreground">{categoryName}</span> : null}
                {values.isFeatured ? <Badge>Destaque</Badge> : null}
                {values.isSoldOut ? <Badge variant="destructive">Esgotado</Badge> : null}
              </div>
              <p className="mt-2 font-display font-semibold text-foreground">{values.name.trim() || "Nome do produto"}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{values.description.trim() || "Uma descrição curta ajuda o cliente a decidir mais rápido."}</p>
              <p className="mt-3 text-lg font-bold text-violet-200">{price !== null && price > 0 ? formatPriceBRL(price) : "R$ 0,00"}</p>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">Depois de criar, o Shark abre somente as próximas configurações necessárias para o tipo escolhido.</p>
          </CardContent>
        </Card>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur supports-backdrop-filter:bg-card/80 lg:hidden">
        <div className="mx-auto flex max-w-5xl gap-2">
          <Button className="min-h-11 flex-1" loading={submitting} loadingLabel="Salvando" onClick={handleSubmit}>{submitting ? "Salvando…" : submitLabel}</Button>
          <Button variant="ghost" className="min-h-11" onClick={onCancel} disabled={submitting}>Cancelar</Button>
        </div>
      </div>
    </div>
  );
}
