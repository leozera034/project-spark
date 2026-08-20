import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { useCatalog } from "@/catalog/CatalogProvider";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = supabase.rpc.bind(supabase) as any;

type DraftItem = { id: string; persistedId?: string; name: string; price: string };
type BuilderGroup = {
  id: string;
  name: string;
  role?: string | null;
  is_required: boolean;
  min_selections: number;
  max_selections: number;
  included_selections?: number;
  linked_product_count?: number;
  items: Array<{ id: string; name: string; additional_price: number }>;
};

type EditDraft = {
  id: string;
  name: string;
  role: string;
  required: boolean;
  max: number;
  included: number;
  originalItemIds: string[];
  items: DraftItem[];
};

const GROUP_PRESETS = [
  { label: "Adicionais", role: "addon" },
  { label: "Sabores", role: "flavor" },
  { label: "Molhos", role: "sauce" },
  { label: "Bebidas", role: "beverage" },
  { label: "Acompanhamentos", role: "side" },
  { label: "Remover ingredientes", role: "removal" },
] as const;

function moneyInput(value: string) {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  const amount = Number(normalized || 0);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function priceText(value: number) {
  return Number(value || 0).toFixed(2).replace(".", ",");
}

function newDraftItem(): DraftItem {
  return { id: crypto.randomUUID(), name: "", price: "0,00" };
}

export function SimpleOptionsBuilder({ productId }: { productId: string }) {
  const { storeId } = useCatalog();
  const queryClient = useQueryClient();
  const [name, setName] = useState("Adicionais");
  const [role, setRole] = useState("addon");
  const [required, setRequired] = useState(false);
  const [max, setMax] = useState(3);
  const [included, setIncluded] = useState(0);
  const [items, setItems] = useState<DraftItem[]>([newDraftItem()]);
  const [edit, setEdit] = useState<EditDraft | null>(null);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["catalog", "simple-options", storeId, productId] });
    await queryClient.invalidateQueries({ queryKey: ["catalog", "advanced", storeId, productId] });
  };

  const query = useQuery({
    queryKey: ["catalog", "simple-options", storeId, productId],
    enabled: Boolean(storeId),
    queryFn: async () => {
      const { data, error } = await rpc("get_product_advanced_builder", {
        _store_id: storeId,
        _product_id: productId,
      });
      if (error) throw new Error(error.message);
      return (data?.groups ?? []) as BuilderGroup[];
    },
    retry: false,
  });

  const validItems = useMemo(
    () =>
      items
        .map((item) => ({ ...item, name: item.name.trim(), amount: moneyInput(item.price) }))
        .filter((item) => item.name.length >= 2 && item.amount !== null),
    [items],
  );

  const create = useMutation({
    mutationFn: async () => {
      if (!storeId) throw new Error("Loja não selecionada");
      if (name.trim().length < 2) throw new Error("Dê um nome para esta escolha.");
      if (validItems.length === 0) throw new Error("Adicione pelo menos uma opção válida.");
      const safeMax = Math.max(1, Math.min(50, Math.floor(max || 1)));
      const safeIncluded = Math.max(0, Math.min(safeMax, Math.floor(included || 0)));

      const { data: group, error: groupError } = await rpc("create_option_group", {
        _store_id: storeId,
        _name: name.trim(),
        _description: null,
        _selection_type: safeMax === 1 ? "unica" : "multipla",
        _is_required: required,
        _min_selections: required ? 1 : 0,
        _max_selections: safeMax,
        _pricing_strategy: "sum",
        _price_effect: "additive",
        _portion_count: null,
      });
      if (groupError) throw new Error(groupError.message);
      const groupId = group?.id;
      if (!groupId) throw new Error("Não foi possível criar a escolha.");

      const { error: engineError } = await rpc("update_option_group_engine", {
        _store_id: storeId,
        _id: groupId,
        _role: role,
        _included_selections: safeIncluded,
        _configuration: { simple_builder: true },
      });
      if (engineError) throw new Error(engineError.message);

      for (const item of validItems) {
        const { error } = await rpc("create_option_item", {
          _store_id: storeId,
          _option_group_id: groupId,
          _name: item.name,
          _additional_price: item.amount,
          _description: null,
          _max_quantity: 1,
        });
        if (error) throw new Error(error.message);
      }

      const { error: attachError } = await rpc("attach_option_group_to_product", {
        _store_id: storeId,
        _product_id: productId,
        _option_group_id: groupId,
      });
      if (attachError) throw new Error(attachError.message);
    },
    onSuccess: async () => {
      toast.success("Escolha adicionada ao produto.");
      setItems([newDraftItem()]);
      setRequired(false);
      setMax(3);
      setIncluded(0);
      await invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível adicionar a escolha."),
  });

  const saveEdit = useMutation({
    mutationFn: async () => {
      if (!storeId || !edit) throw new Error("Nada para salvar.");
      const safeName = edit.name.trim();
      if (safeName.length < 2) throw new Error("Dê um nome para esta escolha.");
      const safeMax = Math.max(1, Math.min(50, Math.floor(edit.max || 1)));
      const safeIncluded = Math.max(0, Math.min(safeMax, Math.floor(edit.included || 0)));
      const valid = edit.items
        .map((item) => ({ ...item, cleanName: item.name.trim(), amount: moneyInput(item.price) }))
        .filter((item) => item.cleanName.length >= 2 && item.amount !== null);
      if (valid.length === 0) throw new Error("Mantenha pelo menos uma opção válida.");

      const { error: groupError } = await rpc("update_option_group", {
        _store_id: storeId,
        _id: edit.id,
        _name: safeName,
        _description: null,
        _selection_type: safeMax === 1 ? "unica" : "multipla",
        _is_required: edit.required,
        _min_selections: edit.required ? 1 : 0,
        _max_selections: safeMax,
        _pricing_strategy: "sum",
        _price_effect: "additive",
        _portion_count: null,
        _expected_updated_at: null,
      });
      if (groupError) throw new Error(groupError.message);

      const { error: engineError } = await rpc("update_option_group_engine", {
        _store_id: storeId,
        _id: edit.id,
        _role: edit.role || "addon",
        _included_selections: safeIncluded,
        _configuration: { simple_builder: true },
      });
      if (engineError) throw new Error(engineError.message);

      const kept = new Set(valid.map((item) => item.persistedId).filter(Boolean));
      for (const oldId of edit.originalItemIds) {
        if (!kept.has(oldId)) {
          const { error } = await rpc("archive_option_item", {
            _store_id: storeId,
            _id: oldId,
            _archived: true,
            _expected_updated_at: null,
          });
          if (error) throw new Error(error.message);
        }
      }

      for (const item of valid) {
        if (item.persistedId) {
          const { error } = await rpc("update_option_item", {
            _store_id: storeId,
            _id: item.persistedId,
            _name: item.cleanName,
            _additional_price: item.amount,
            _description: null,
            _max_quantity: 1,
            _expected_updated_at: null,
          });
          if (error) throw new Error(error.message);
        } else {
          const { error } = await rpc("create_option_item", {
            _store_id: storeId,
            _option_group_id: edit.id,
            _name: item.cleanName,
            _additional_price: item.amount,
            _description: null,
            _max_quantity: 1,
          });
          if (error) throw new Error(error.message);
        }
      }
    },
    onSuccess: async () => {
      toast.success("Escolha atualizada.");
      setEdit(null);
      await invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a escolha."),
  });

  const removeGroup = useMutation({
    mutationFn: async (group: BuilderGroup) => {
      if (!storeId) throw new Error("Loja não selecionada");
      const { error: detachError } = await rpc("detach_option_group_from_product", {
        _store_id: storeId,
        _product_id: productId,
        _option_group_id: group.id,
      });
      if (detachError) throw new Error(detachError.message);

      if ((group.linked_product_count ?? 1) <= 1) {
        const { error: archiveError } = await rpc("archive_option_group", {
          _store_id: storeId,
          _id: group.id,
          _archived: true,
          _expected_updated_at: null,
        });
        if (archiveError) throw new Error(archiveError.message);
      }
    },
    onSuccess: async () => {
      toast.success("Escolha removida deste produto.");
      setEdit(null);
      await invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível remover a escolha."),
  });

  function beginEdit(group: BuilderGroup) {
    setEdit({
      id: group.id,
      name: group.name,
      role: group.role ?? "addon",
      required: group.is_required,
      max: group.max_selections,
      included: group.included_selections ?? 0,
      originalItemIds: group.items.map((item) => item.id),
      items: group.items.map((item) => ({
        id: item.id,
        persistedId: item.id,
        name: item.name,
        price: priceText(Number(item.additional_price)),
      })),
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adicionar uma escolha ao produto</CardTitle>
          <CardDescription>
            Configure em português comum. A Comandiva traduz isso para as regras técnicas do cardápio.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-2 sm:grid-cols-3">
            {GROUP_PRESETS.map((preset) => (
              <Button
                key={preset.role}
                type="button"
                variant={role === preset.role ? "default" : "outline"}
                onClick={() => {
                  setRole(preset.role);
                  setName(preset.label);
                }}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nome mostrado ao cliente</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Escolha seus adicionais" />
            </div>
            <div className="space-y-1.5">
              <Label>Máximo de escolhas</Label>
              <Input type="number" min={1} max={50} value={max} onChange={(e) => setMax(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Quantas são grátis?</Label>
              <Input type="number" min={0} max={max} value={included} onChange={(e) => setIncluded(Number(e.target.value))} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch id="simple-option-required" checked={required} onCheckedChange={(v) => setRequired(Boolean(v))} />
            <Label htmlFor="simple-option-required">O cliente precisa escolher pelo menos uma opção</Label>
          </div>

          <div className="space-y-3">
            <div>
              <Label>Opções</Label>
              <p className="text-xs text-muted-foreground">
                Preço 0,00 significa sem acréscimo. Para uma opção paga, informe apenas o valor adicional.
              </p>
            </div>
            {items.map((item, index) => (
              <div key={item.id} className="grid gap-2 sm:grid-cols-[1fr_160px_auto]">
                <Input
                  value={item.name}
                  onChange={(e) =>
                    setItems((current) => current.map((row) => (row.id === item.id ? { ...row, name: e.target.value } : row)))
                  }
                  placeholder={index === 0 ? "Ex.: Bacon" : "Nome da opção"}
                />
                <Input
                  inputMode="decimal"
                  value={item.price}
                  onChange={(e) =>
                    setItems((current) => current.map((row) => (row.id === item.id ? { ...row, price: e.target.value } : row)))
                  }
                  placeholder="0,00"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Remover opção"
                  disabled={items.length === 1}
                  onClick={() => setItems((current) => current.filter((row) => row.id !== item.id))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={() => setItems((current) => [...current, newDraftItem()])}>
              <Plus className="mr-1 size-4" /> Adicionar outra opção
            </Button>
          </div>

          <Button loading={create.isPending} onClick={() => create.mutate()}>
            Adicionar ao produto
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Escolhas já configuradas</CardTitle>
          <CardDescription>Edite ou remova sem precisar abrir o modo avançado.</CardDescription>
        </CardHeader>
        <CardContent>
          {query.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (query.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma escolha configurada ainda.</p>
          ) : (
            <div className="space-y-3">
              {query.data?.map((group) => {
                const editing = edit?.id === group.id;
                return (
                  <div key={group.id} className="rounded-xl border p-4">
                    {editing && edit ? (
                      <div className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="space-y-1.5 sm:col-span-2">
                            <Label>Nome da escolha</Label>
                            <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Máximo</Label>
                            <Input type="number" min={1} max={50} value={edit.max} onChange={(e) => setEdit({ ...edit, max: Number(e.target.value) })} />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Grátis</Label>
                            <Input type="number" min={0} max={edit.max} value={edit.included} onChange={(e) => setEdit({ ...edit, included: Number(e.target.value) })} />
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Switch checked={edit.required} onCheckedChange={(v) => setEdit({ ...edit, required: Boolean(v) })} />
                          <Label>Cliente precisa escolher pelo menos uma</Label>
                        </div>

                        <div className="space-y-2">
                          {edit.items.map((item) => (
                            <div key={item.id} className="grid gap-2 sm:grid-cols-[1fr_160px_auto]">
                              <Input
                                value={item.name}
                                onChange={(e) =>
                                  setEdit({
                                    ...edit,
                                    items: edit.items.map((row) => (row.id === item.id ? { ...row, name: e.target.value } : row)),
                                  })
                                }
                                placeholder="Nome da opção"
                              />
                              <Input
                                inputMode="decimal"
                                value={item.price}
                                onChange={(e) =>
                                  setEdit({
                                    ...edit,
                                    items: edit.items.map((row) => (row.id === item.id ? { ...row, price: e.target.value } : row)),
                                  })
                                }
                                placeholder="0,00"
                              />
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                disabled={edit.items.length === 1}
                                onClick={() => setEdit({ ...edit, items: edit.items.filter((row) => row.id !== item.id) })}
                                aria-label="Remover opção"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setEdit({ ...edit, items: [...edit.items, newDraftItem()] })}
                          >
                            <Plus className="mr-1 size-4" /> Nova opção
                          </Button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" loading={saveEdit.isPending} onClick={() => saveEdit.mutate()}>
                            <Save className="mr-1 size-4" /> Salvar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEdit(null)} disabled={saveEdit.isPending}>
                            <X className="mr-1 size-4" /> Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <strong>{group.name}</strong>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {group.is_required ? "Obrigatório" : "Opcional"} · até {group.max_selections}
                              {(group.included_selections ?? 0) > 0 ? ` · ${group.included_selections} grátis` : ""}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => beginEdit(group)}>
                              <Pencil className="mr-1 size-4" /> Editar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={removeGroup.isPending}
                              onClick={() => {
                                if (window.confirm(`Remover “${group.name}” deste produto?`)) removeGroup.mutate(group);
                              }}
                            >
                              <Trash2 className="mr-1 size-4" /> Remover
                            </Button>
                          </div>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {group.items
                            .map((item) =>
                              `${item.name}${Number(item.additional_price) > 0 ? ` (+ R$ ${priceText(Number(item.additional_price))})` : ""}`,
                            )
                            .join(" · ")}
                        </p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
