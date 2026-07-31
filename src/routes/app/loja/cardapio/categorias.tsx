import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, FolderOpen, ImagePlus, Loader2 } from "lucide-react";

import {
  archiveCategory,
  createCategory,
  removeCatalogImage,
  reorderCategories,
  setCategoryActive,
  setCategoryImage,
  updateCategory,
  uploadCatalogImage,
} from "@/catalog/api";
import { CatalogImage } from "@/catalog/CatalogImage";
import { useCatalog } from "@/catalog/CatalogProvider";
import type { CatalogCategory } from "@/catalog/types";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/app/loja/cardapio/categorias")({
  component: CategoriasPage,
});

interface DraftState {
  open: boolean;
  editing: CatalogCategory | null;
  name: string;
  description: string;
  isActive: boolean;
}

const EMPTY_DRAFT: DraftState = {
  open: false,
  editing: null,
  name: "",
  description: "",
  isActive: true,
};

function CategoriasPage() {
  const { storeId, categories, overview, run, isBusy } = useCatalog();
  const [showArchived, setShowArchived] = useState(false);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const can = overview?.can ?? { view: true, create: false, update: false, archive: false };
  const visible = categories.filter((c) => (showArchived ? c.is_archived : !c.is_archived));
  const nameInvalid = draft.name.trim().length < 2 || draft.name.trim().length > 60;

  async function submitDraft() {
    if (!storeId || nameInvalid) return;
    const payload = {
      storeId,
      name: draft.name.trim(),
      description: draft.description.trim(),
      isActive: draft.isActive,
    };
    const result = draft.editing
      ? await run(
          () =>
            updateCategory({
              ...payload,
              id: draft.editing!.id,
              expectedUpdatedAt: draft.editing!.updated_at,
            }),
          "Categoria atualizada.",
        )
      : await run(() => createCategory(payload), "Categoria criada.");
    if (result) setDraft(EMPTY_DRAFT);
  }

  async function move(index: number, direction: -1 | 1) {
    if (!storeId) return;
    const ordered = visible.map((c) => c.id);
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    await run(() => reorderCategories(storeId, ordered), "Ordem atualizada.");
  }

  async function handleFile(category: CatalogCategory, file: File | undefined) {
    if (!file || !storeId) return;
    setUploadingId(category.id);
    const previous = category.image_path;
    const done = await run(async () => {
      const path = await uploadCatalogImage({
        storeId,
        scope: "categories",
        entityId: category.id,
        file,
      });
      const updated = await setCategoryImage(storeId, category.id, path);
      await removeCatalogImage(previous);
      return updated;
    }, "Imagem atualizada.");
    setUploadingId(null);
    if (!done) return;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Switch
            id="arquivadas"
            checked={showArchived}
            onCheckedChange={(v) => setShowArchived(Boolean(v))}
          />
          <Label htmlFor="arquivadas" className="text-sm text-muted-foreground">
            Ver arquivadas
          </Label>
        </div>
        {can.create ? (
          <Button onClick={() => setDraft({ ...EMPTY_DRAFT, open: true })}>Nova categoria</Button>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title={showArchived ? "Nenhuma categoria arquivada" : "Nenhuma categoria ainda"}
          description={
            showArchived
              ? "As categorias arquivadas aparecem aqui quando você arquivar alguma."
              : "Crie a primeira categoria para organizar os produtos do seu cardápio."
          }
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((category, index) => (
            <li key={category.id}>
              <Card>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <CatalogImage
                    path={category.image_path}
                    alt={category.name}
                    className="h-16 w-16 shrink-0"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium text-foreground">{category.name}</span>
                      {category.is_archived ? (
                        <Badge variant="outline">Arquivada</Badge>
                      ) : category.is_active ? (
                        <Badge>Ativa</Badge>
                      ) : (
                        <Badge variant="secondary">Inativa</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {category.product_count} produto(s)
                      </span>
                    </div>
                    {category.description ? (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {category.description}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {!showArchived && can.update ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Subir ${category.name}`}
                          disabled={index === 0 || isBusy}
                          onClick={() => void move(index, -1)}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Descer ${category.name}`}
                          disabled={index === visible.length - 1 || isBusy}
                          onClick={() => void move(index, 1)}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </>
                    ) : null}

                    {can.update && !category.is_archived ? (
                      <>
                        <input
                          ref={(el) => {
                            fileInputs.current[category.id] = el;
                          }}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={(event) => {
                            void handleFile(category, event.target.files?.[0]);
                            event.target.value = "";
                          }}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={uploadingId === category.id}
                          onClick={() => fileInputs.current[category.id]?.click()}
                        >
                          {uploadingId === category.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ImagePlus className="h-4 w-4" />
                          )}
                          <span className="ml-1 hidden sm:inline">Imagem</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setDraft({
                              open: true,
                              editing: category,
                              name: category.name,
                              description: category.description ?? "",
                              isActive: category.is_active,
                            })
                          }
                        >
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isBusy}
                          onClick={() =>
                            void run(
                              () =>
                                setCategoryActive(
                                  storeId!,
                                  category.id,
                                  !category.is_active,
                                  category.updated_at,
                                ),
                              category.is_active ? "Categoria desativada." : "Categoria ativada.",
                            )
                          }
                        >
                          {category.is_active ? "Desativar" : "Ativar"}
                        </Button>
                      </>
                    ) : null}

                    {can.archive ? (
                      <Button
                        variant={category.is_archived ? "default" : "ghost"}
                        size="sm"
                        disabled={isBusy}
                        onClick={() =>
                          void run(
                            () =>
                              archiveCategory(
                                storeId!,
                                category.id,
                                !category.is_archived,
                                category.updated_at,
                              ),
                            category.is_archived
                              ? "Categoria restaurada."
                              : "Categoria arquivada.",
                          )
                        }
                      >
                        {category.is_archived ? "Restaurar" : "Arquivar"}
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={draft.open}
        onOpenChange={(open) => setDraft((prev) => (open ? prev : EMPTY_DRAFT))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft.editing ? "Editar categoria" : "Nova categoria"}</DialogTitle>
            <DialogDescription>
              O nome aparece para o cliente e não pode se repetir dentro da sua loja.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cat-nome">Nome</Label>
              <Input
                id="cat-nome"
                value={draft.name}
                maxLength={60}
                onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ex.: Bebidas"
              />
              {draft.name.length > 0 && nameInvalid ? (
                <p className="text-xs text-destructive">Use entre 2 e 60 caracteres.</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cat-desc">Descrição (opcional)</Label>
              <Textarea
                id="cat-desc"
                value={draft.description}
                maxLength={280}
                rows={3}
                onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="cat-ativa"
                checked={draft.isActive}
                onCheckedChange={(v) => setDraft((p) => ({ ...p, isActive: Boolean(v) }))}
              />
              <Label htmlFor="cat-ativa">Visível no cardápio</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDraft(EMPTY_DRAFT)}>
              Cancelar
            </Button>
            <Button
              disabled={nameInvalid}
              loading={isBusy}
              loadingLabel="Salvando"
              onClick={() => void submitDraft()}
            >
              {isBusy ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
