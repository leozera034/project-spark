import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, FolderOpen, ImagePlus, Loader2, Plus } from "lucide-react";

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
import { PageHeader } from "@/components/catalog/PageHeader";
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
  const activeCategories = categories.filter((c) => !c.is_archived);
  const archivedCategories = categories.filter((c) => c.is_archived);
  const visible = showArchived ? archivedCategories : activeCategories;
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

  const openNewCategory = () => setDraft({ ...EMPTY_DRAFT, open: true });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Categorias"
        description="Organize a ordem em que os clientes encontram as seções do cardápio."
        action={
          can.create ? (
            <Button onClick={openNewCategory}>
              <Plus className="size-4" /> Nova categoria
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm">
        <div>
          <p className="text-sm font-bold text-foreground">{activeCategories.length} {activeCategories.length === 1 ? "categoria" : "categorias"} no cardápio</p>
          <p className="text-xs text-muted-foreground">A ordem abaixo é a mesma vista pelo cliente.</p>
        </div>
        <label className="flex min-h-11 items-center gap-2 rounded-xl px-2">
          <Switch id="arquivadas" checked={showArchived} onCheckedChange={(v) => setShowArchived(Boolean(v))} />
          <span className="text-sm font-semibold text-muted-foreground">Arquivadas{archivedCategories.length > 0 ? ` (${archivedCategories.length})` : ""}</span>
        </label>
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
          action={!showArchived && can.create ? <Button onClick={openNewCategory}><Plus className="size-4" /> Criar primeira categoria</Button> : null}
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((category, index) => (
            <li key={category.id}>
              <Card className="overflow-hidden transition-shadow hover:shadow-md">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <CatalogImage path={category.image_path} alt={category.name} className="h-20 w-full shrink-0 rounded-xl object-cover sm:h-16 sm:w-16" />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-bold text-foreground">{category.name}</span>
                      {category.is_archived ? <Badge variant="outline">Arquivada</Badge> : category.is_active ? <Badge variant="success">Ativa</Badge> : <Badge variant="secondary">Inativa</Badge>}
                      <span className="text-xs text-muted-foreground">
                        {category.product_count} {category.product_count === 1 ? "produto" : "produtos"}
                      </span>
                    </div>
                    {category.description ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{category.description}</p> : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {!showArchived && can.update ? (
                      <>
                        <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label={`Subir ${category.name}`} disabled={index === 0 || isBusy} onClick={() => void move(index, -1)}>
                          <ArrowUp className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label={`Descer ${category.name}`} disabled={index === visible.length - 1 || isBusy} onClick={() => void move(index, 1)}>
                          <ArrowDown className="size-4" />
                        </Button>
                      </>
                    ) : null}

                    {can.update && !category.is_archived ? (
                      <>
                        <input
                          ref={(el) => { fileInputs.current[category.id] = el; }}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={(event) => {
                            void handleFile(category, event.target.files?.[0]);
                            event.target.value = "";
                          }}
                        />
                        <Button variant="outline" size="sm" className="min-h-11" disabled={uploadingId === category.id} onClick={() => fileInputs.current[category.id]?.click()}>
                          {uploadingId === category.id ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
                          <span>Imagem</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-11"
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
                          className="min-h-11"
                          disabled={isBusy}
                          onClick={() =>
                            void run(
                              () => setCategoryActive(storeId!, category.id, !category.is_active, category.updated_at),
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
                        className="min-h-11"
                        disabled={isBusy}
                        onClick={() =>
                          void run(
                            () => archiveCategory(storeId!, category.id, !category.is_archived, category.updated_at),
                            category.is_archived ? "Categoria restaurada." : "Categoria arquivada.",
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

      <Dialog open={draft.open} onOpenChange={(open) => setDraft((prev) => (open ? prev : EMPTY_DRAFT))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft.editing ? "Editar categoria" : "Nova categoria"}</DialogTitle>
            <DialogDescription>O nome aparece para o cliente e não pode se repetir dentro da sua loja.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cat-nome">Nome</Label>
              <Input id="cat-nome" value={draft.name} maxLength={60} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} placeholder="Ex.: Bebidas" className="min-h-12" />
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className={draft.name.length > 0 && nameInvalid ? "text-destructive" : "text-muted-foreground"}>{draft.name.length > 0 && nameInvalid ? "Use entre 2 e 60 caracteres." : "Use um nome curto que o cliente reconheça rápido."}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{draft.name.length}/60</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cat-desc">Descrição (opcional)</Label>
              <Textarea id="cat-desc" value={draft.description} maxLength={280} rows={3} onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))} placeholder="Ex.: Refrigerantes, sucos, água e energéticos." />
              <p className="text-right text-xs tabular-nums text-muted-foreground">{draft.description.length}/280</p>
            </div>

            <div className="flex min-h-14 items-center justify-between gap-4 rounded-xl border border-border p-3">
              <div><Label htmlFor="cat-ativa">Visível no cardápio</Label><p className="mt-0.5 text-xs text-muted-foreground">Desative para esconder a seção temporariamente.</p></div>
              <Switch id="cat-ativa" checked={draft.isActive} onCheckedChange={(v) => setDraft((p) => ({ ...p, isActive: Boolean(v) }))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" className="min-h-11" onClick={() => setDraft(EMPTY_DRAFT)}>Cancelar</Button>
            <Button className="min-h-11" disabled={nameInvalid} loading={isBusy} loadingLabel="Salvando" onClick={() => void submitDraft()}>
              {isBusy ? "Salvando…" : "Salvar categoria"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
