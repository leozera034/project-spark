import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { SectionTitle } from "@/components/demo/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { demoCategories } from "@/demo/data/demoProducts";
import { useDemo } from "@/demo/state/useDemo";
import type { DemoProduct, ProductAvailability } from "@/demo/types/demo";
import { formatBRL } from "@/demo/utils/format";
import { demoHead } from "@/demo/utils/head";
import { availabilityLabel } from "@/demo/utils/labels";

export const Route = createFileRoute("/preview/loja/cardapio")({
  head: demoHead(
    "Cardápio da loja — Pediu Aqui",
    "Gestão de categorias, itens, variações e disponibilidade do catálogo.",
  ),
  component: MenuManager,
});

const availabilityTone: Record<ProductAvailability, "success" | "warning" | "secondary"> = {
  disponivel: "success",
  esgotado: "warning",
  indisponivel: "secondary",
};

function MenuManager() {
  const { products } = useDemo();
  const [selected, setSelected] = useState<DemoProduct | null>(null);
  const [categoryId, setCategoryId] = useState<string>("todas");

  const filtered =
    categoryId === "todas" ? products : products.filter((item) => item.categoryId === categoryId);

  function demoOnly(label: string) {
    toast.info(label, { description: "Alteração realizada apenas na demonstração." });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <SectionTitle
        title="Cardápio"
        description="Estrutura genérica de catálogo: categorias, itens, variações e complementos."
        action={
          <Button variant="brand" size="sm" onClick={() => demoOnly("Novo item")}>
            Novo item
          </Button>
        }
      />

      <div className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-2 pb-2">
          {[{ id: "todas", name: "Todas" }, ...demoCategories].map((category) => (
            <li key={category.id}>
              <button
                type="button"
                aria-pressed={categoryId === category.id}
                onClick={() => setCategoryId(category.id)}
                className={`min-h-11 whitespace-nowrap rounded-full border px-4 text-sm font-medium ${
                  categoryId === category.id
                    ? "border-brand bg-brand text-brand-foreground"
                    : "border-border bg-surface text-foreground"
                }`}
              >
                {category.name}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <ul className="space-y-3">
        {filtered.map((product) => (
          <li
            key={product.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="text-base font-medium text-foreground">{product.name}</p>
              <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                {product.description}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge variant={availabilityTone[product.availability]}>
                  {availabilityLabel[product.availability]}
                </Badge>
                {product.highlighted ? <Badge variant="brandSoft">Destaque</Badge> : null}
                {product.variations ? (
                  <Badge variant="secondary">{product.variations.length} variações</Badge>
                ) : null}
                {product.optionGroups ? (
                  <Badge variant="secondary">{product.optionGroups.length} grupos de opções</Badge>
                ) : null}
              </div>
            </div>
            <div className="text-right">
              <p className="text-base font-semibold text-foreground">
                {formatBRL(product.price)}
                {product.unitLabel ? (
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}
                    / {product.unitLabel}
                  </span>
                ) : null}
              </p>
              <div className="mt-2 flex items-center justify-end gap-2">
                <span className="text-xs text-muted-foreground">Ativo</span>
                <Switch
                  checked={product.active}
                  aria-label={`Ativar ${product.name}`}
                  onCheckedChange={() => demoOnly("Situação do item alterada")}
                />
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setSelected(product)}>
              Editar
            </Button>
          </li>
        ))}
      </ul>

      <Sheet open={selected !== null} onOpenChange={(open) => (open ? null : setSelected(null))}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selected ? (
            <>
              <SheetHeader className="text-left">
                <SheetTitle>{selected.name}</SheetTitle>
                <SheetDescription>
                  Formulário demonstrativo. Nada é salvo nesta fase.
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-4 text-sm">
                <div>
                  <p className="font-medium text-foreground">Descrição</p>
                  <p className="mt-1 text-muted-foreground">{selected.description}</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Preço base</p>
                  <p className="mt-1 text-muted-foreground">{formatBRL(selected.price)}</p>
                </div>
                {selected.variations ? (
                  <div>
                    <p className="font-medium text-foreground">Variações</p>
                    <ul className="mt-1 space-y-1 text-muted-foreground">
                      {selected.variations.map((variation) => (
                        <li key={variation.id} className="flex justify-between gap-4">
                          <span>{variation.name}</span>
                          <span>{formatBRL(variation.price)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {selected.optionGroups ? (
                  <div>
                    <p className="font-medium text-foreground">Grupos de opções</p>
                    <ul className="mt-1 space-y-2 text-muted-foreground">
                      {selected.optionGroups.map((group) => (
                        <li key={group.id}>
                          <span className="text-foreground">{group.name}</span> · {group.helper}
                          <ul className="mt-1 space-y-0.5 pl-4">
                            {group.items.map((item) => (
                              <li key={item.id} className="flex justify-between gap-4">
                                <span>{item.name}</span>
                                <span>
                                  {item.priceDelta === 0 ? "Sem custo" : `+ ${formatBRL(item.priceDelta)}`}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div>
                  <p className="font-medium text-foreground">Disponibilidade</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(["disponivel", "esgotado", "indisponivel"] as ProductAvailability[]).map(
                      (value) => (
                        <Button
                          key={value}
                          size="sm"
                          variant={selected.availability === value ? "brand" : "outline"}
                          onClick={() => demoOnly("Disponibilidade alterada")}
                        >
                          {availabilityLabel[value]}
                        </Button>
                      ),
                    )}
                  </div>
                </div>
              </div>

              <Button
                size="touch"
                variant="brand"
                className="mt-6 w-full"
                onClick={() => {
                  demoOnly("Item salvo");
                  setSelected(null);
                }}
              >
                Salvar alterações
              </Button>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
