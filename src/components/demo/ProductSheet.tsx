import { Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useDemo } from "@/demo/state/useDemo";
import type { DemoProduct } from "@/demo/types/demo";
import { formatBRL } from "@/demo/utils/format";

/**
 * Detalhe do produto.
 * Valores demonstrativos; a validação real ocorrerá no backend em fase futura.
 */
export function ProductSheet({
  product,
  onClose,
}: {
  product: DemoProduct | null;
  onClose: () => void;
}) {
  const { addCartLine } = useDemo();
  const [variationId, setVariationId] = useState<string>("");
  const [options, setOptions] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");

  useEffect(() => {
    setVariationId(product?.variations?.[0]?.id ?? "");
    setOptions([]);
    setQuantity(1);
    setNote("");
  }, [product]);

  const variation = product?.variations?.find((item) => item.id === variationId);
  const basePrice = variation?.price ?? product?.price ?? 0;

  const selectedOptionItems = useMemo(() => {
    if (!product?.optionGroups) return [];
    return product.optionGroups
      .flatMap((group) => group.items)
      .filter((item) => options.includes(item.id));
  }, [product, options]);

  const unitPrice = basePrice + selectedOptionItems.reduce((sum, item) => sum + item.priceDelta, 0);

  const requiredMissing =
    product?.optionGroups?.some(
      (group) =>
        group.required && group.items.filter((item) => options.includes(item.id)).length < group.min,
    ) ?? false;

  function toggleOption(groupId: string, itemId: string, single: boolean, max: number) {
    const group = product?.optionGroups?.find((item) => item.id === groupId);
    if (!group) return;
    const groupItemIds = group.items.map((item) => item.id);

    setOptions((current) => {
      if (single) {
        return [...current.filter((id) => !groupItemIds.includes(id)), itemId];
      }
      if (current.includes(itemId)) return current.filter((id) => id !== itemId);
      const inGroup = current.filter((id) => groupItemIds.includes(id));
      if (inGroup.length >= max) return current;
      return [...current, itemId];
    });
  }

  return (
    <Sheet open={product !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl sm:max-w-2xl">
        {product ? (
          <>
            <div
              aria-hidden="true"
              className="mb-4 flex h-32 items-center justify-center rounded-xl bg-muted text-2xl font-semibold text-muted-foreground"
            >
              {product.name.slice(0, 2).toUpperCase()}
            </div>
            <SheetHeader className="text-left">
              <SheetTitle className="text-xl">{product.name}</SheetTitle>
              <SheetDescription className="text-base">{product.description}</SheetDescription>
            </SheetHeader>

            <p className="mt-3 text-lg font-semibold text-foreground">{formatBRL(basePrice)}</p>

            {product.variations ? (
              <fieldset className="mt-6">
                <legend className="text-base font-semibold text-foreground">Escolha a opção</legend>
                <p className="text-sm text-muted-foreground">Escolha 1 opção</p>
                <RadioGroup value={variationId} onValueChange={setVariationId} className="mt-3 space-y-2">
                  {product.variations.map((item) => (
                    <div
                      key={item.id}
                      className="flex min-h-12 items-center gap-3 rounded-lg border border-border px-3"
                    >
                      <RadioGroupItem value={item.id} id={item.id} />
                      <Label htmlFor={item.id} className="flex flex-1 justify-between text-base">
                        <span>{item.name}</span>
                        <span className="text-muted-foreground">{formatBRL(item.price)}</span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </fieldset>
            ) : null}

            {product.optionGroups?.map((group) => {
              const single = group.max === 1;
              return (
                <fieldset key={group.id} className="mt-6">
                  <legend className="text-base font-semibold text-foreground">
                    {group.name}
                    {group.required ? (
                      <span className="ml-2 text-sm font-normal text-brand">Obrigatório</span>
                    ) : null}
                  </legend>
                  <p className="text-sm text-muted-foreground">{group.helper}</p>
                  <div className="mt-3 space-y-2">
                    {group.items.map((item) => {
                      const checked = options.includes(item.id);
                      return (
                        <div
                          key={item.id}
                          className="flex min-h-12 items-center gap-3 rounded-lg border border-border px-3"
                        >
                          <Checkbox
                            id={item.id}
                            checked={checked}
                            onCheckedChange={() =>
                              toggleOption(group.id, item.id, single, group.max)
                            }
                          />
                          <Label htmlFor={item.id} className="flex flex-1 justify-between text-base">
                            <span>{item.name}</span>
                            <span className="text-muted-foreground">
                              {item.priceDelta > 0 ? `+ ${formatBRL(item.priceDelta)}` : "sem custo"}
                            </span>
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </fieldset>
              );
            })}

            <div className="mt-6">
              <Label htmlFor="observacao-produto" className="text-base">
                Alguma observação?
              </Label>
              <Textarea
                id="observacao-produto"
                className="mt-2 text-base"
                placeholder="Sem cebola, embalar separado..."
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>

            <div className="mt-6 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="iconTouch"
                  aria-label="Diminuir quantidade"
                  onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                >
                  <Minus aria-hidden="true" />
                </Button>
                <span className="w-8 text-center text-lg font-semibold" aria-live="polite">
                  {quantity}
                </span>
                <Button
                  variant="outline"
                  size="iconTouch"
                  aria-label="Aumentar quantidade"
                  onClick={() => setQuantity((value) => value + 1)}
                >
                  <Plus aria-hidden="true" />
                </Button>
              </div>
              <p className="ml-auto text-right">
                <span className="block text-sm text-muted-foreground">Total demonstrativo</span>
                <span className="text-lg font-semibold text-foreground">
                  {formatBRL(unitPrice * quantity)}
                </span>
              </p>
            </div>

            <Button
              size="touch"
              variant="brand"
              className="mt-4 h-13 w-full text-base"
              disabled={requiredMissing}
              onClick={() => {
                addCartLine({
                  id: `line-${Date.now()}`,
                  productId: product.id,
                  productName: product.name,
                  variationName: variation?.name,
                  optionNames: selectedOptionItems.map((item) => item.name),
                  quantity,
                  note: note.trim() || undefined,
                  unitPrice,
                });
                toast.success("Adicionado ao carrinho", {
                  description: "Alteração realizada apenas na demonstração.",
                });
                onClose();
              }}
            >
              {requiredMissing ? "Escolha as opções obrigatórias" : "Adicionar ao carrinho"}
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">
              Valores demonstrativos; a validação real ocorrerá no backend em fase futura.
            </p>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
