import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CopyPlus, Plus, Save, Shapes, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  adminListCategoryProfiles,
  adminSaveCategoryProfile,
  type AdminCategoryProfile,
  type CategoryProductTemplate,
} from "@/catalog/category-profiles.admin";
import {
  CAPABILITY_LABELS,
  PRODUCT_TYPE_LABELS,
} from "@/catalog/shark-engine.api";
import type { ProductCapabilities, ProductType } from "@/catalog/advanced-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/admin/categorias")({ component: CategoryProfilesAdmin });

type Draft = {
  id: string | null;
  code: string;
  name: string;
  description: string;
  icon: string;
  capabilities: ProductCapabilities;
  templates: CategoryProductTemplate[];
  active: boolean;
  sortOrder: number;
};

const emptyDraft = (): Draft => ({
  id: null,
  code: "",
  name: "",
  description: "",
  icon: "",
  capabilities: {},
  templates: [],
  active: true,
  sortOrder: 100,
});

function toDraft(profile: AdminCategoryProfile): Draft {
  return {
    id: profile.id,
    code: profile.code,
    name: profile.name,
    description: profile.description ?? "",
    icon: profile.icon ?? "",
    capabilities: { ...(profile.default_capabilities ?? {}) },
    templates: (profile.product_templates ?? []).map((template) => ({
      ...template,
      capabilities: { ...(template.capabilities ?? {}) },
    })),
    active: profile.is_active,
    sortOrder: profile.sort_order,
  };
}

function CategoryProfilesAdmin() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin", "category-profiles"], queryFn: adminListCategoryProfiles });
  const [draft, setDraft] = useState<Draft | null>(null);

  const mutation = useMutation({
    mutationFn: adminSaveCategoryProfile,
    onSuccess: async () => {
      toast.success("Perfil de categoria salvo.");
      setDraft(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "category-profiles"] });
    },
    onError: () => toast.error("Não foi possível salvar o perfil de categoria."),
  });

  const activeCount = query.data?.filter((p) => p.is_active).length ?? 0;

  return (
    <main className="mx-auto w-full max-w-[1400px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="rounded-[28px] border border-violet-300/10 bg-[linear-gradient(135deg,rgba(55,25,88,.72),rgba(15,8,25,.96))] p-5 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge variant="outline" className="mb-3"><Shapes className="mr-1 size-3.5" /> Motor Shark</Badge>
            <h1 className="font-display text-3xl font-black tracking-[-.04em] text-white">Perfis inteligentes de categoria</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/50">
              Estes perfis definem defaults e sugestões. Eles nunca limitam os tipos de produto que uma loja pode vender.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-white/45">{activeCount} ativos</span>
            <Button onClick={() => setDraft(emptyDraft())}><Plus className="size-4" /> Nova categoria</Button>
          </div>
        </div>
      </section>

      {query.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-60 rounded-2xl" />)}</div>
      ) : query.error ? (
        <Card><CardContent className="py-10 text-center text-sm text-destructive">Não foi possível carregar os perfis.</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(query.data ?? []).map((profile) => (
            <Card key={profile.id} className="overflow-hidden">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">{profile.name}{!profile.is_active ? <Badge variant="secondary">Inativa</Badge> : null}</CardTitle>
                    <CardDescription className="mt-1">{profile.description || "Sem descrição."}</CardDescription>
                  </div>
                  <Badge variant="outline">{profile.code}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(profile.default_capabilities ?? {}).filter(([, value]) => Boolean(value)).slice(0, 8).map(([key]) => (
                    <Badge key={key} variant="secondary">{CAPABILITY_LABELS[key] ?? key}</Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{profile.product_templates?.length ?? 0} template(s) de produto · ordem {profile.sort_order}</p>
                <Button variant="outline" className="w-full" onClick={() => setDraft(toDraft(profile))}>Editar perfil</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {draft ? <ProfileEditor draft={draft} setDraft={setDraft} saving={mutation.isPending} onSave={() => mutation.mutate({
        id: draft.id,
        code: draft.code,
        name: draft.name,
        description: draft.description,
        icon: draft.icon,
        capabilities: draft.capabilities,
        templates: draft.templates,
        active: draft.active,
        sortOrder: draft.sortOrder,
      })} onCancel={() => setDraft(null)} /> : null}
    </main>
  );
}

function ProfileEditor({ draft, setDraft, saving, onSave, onCancel }: {
  draft: Draft;
  setDraft: (draft: Draft) => void;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const enabledCapabilities = useMemo(() => Object.keys(draft.capabilities).filter((key) => Boolean(draft.capabilities[key])), [draft.capabilities]);

  const addTemplate = () => {
    const template: CategoryProductTemplate = {
      type: "simple",
      label: "Novo produto",
      capabilities: { ...draft.capabilities },
    };
    setDraft({ ...draft, templates: [...draft.templates, template] });
  };

  return (
    <Card className="border-violet-400/20">
      <CardHeader>
        <CardTitle>{draft.id ? "Editar perfil" : "Nova categoria"}</CardTitle>
        <CardDescription>Alterações afetam sugestões futuras; produtos já configurados não são reescritos automaticamente.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5"><Label>Nome</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ex.: Cafeteria" /></div>
          <div className="space-y-1.5"><Label>Código</Label><Input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} placeholder="cafeteria" /></div>
          <div className="space-y-1.5"><Label>Ícone</Label><Input value={draft.icon} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} placeholder="coffee" /></div>
          <div className="space-y-1.5"><Label>Ordem</Label><Input type="number" value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) || 0 })} /></div>
          <div className="space-y-1.5 md:col-span-2 lg:col-span-4"><Label>Descrição</Label><Textarea rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
        </div>

        <div className="space-y-3">
          <div><h3 className="font-semibold">Capacidades sugeridas</h3><p className="text-xs text-muted-foreground">São defaults da categoria. O produto continua podendo ativar ou desativar capacidades individualmente.</p></div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(CAPABILITY_LABELS).map(([key, label]) => {
              const checked = Boolean(draft.capabilities[key]);
              return <label key={key} className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border px-3 text-sm"><span>{label}</span><Switch checked={checked} onCheckedChange={(value) => setDraft({ ...draft, capabilities: { ...draft.capabilities, [key]: Boolean(value) } })} /></label>;
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><h3 className="font-semibold">Templates de produto</h3><p className="text-xs text-muted-foreground">Atalhos oferecidos quando o lojista cria um produto.</p></div>
            <Button type="button" variant="outline" size="sm" onClick={addTemplate}><CopyPlus className="size-4" /> Adicionar template</Button>
          </div>
          {draft.templates.length === 0 ? <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Nenhum template. A loja ainda poderá criar qualquer tipo de produto.</p> : (
            <div className="space-y-3">
              {draft.templates.map((template, index) => (
                <div key={`${template.type}-${index}`} className="grid gap-3 rounded-xl border border-border p-3 lg:grid-cols-[180px_1fr_auto_auto] lg:items-end">
                  <div className="space-y-1.5"><Label>Tipo</Label><Select value={template.type} onValueChange={(value) => { const next = [...draft.templates]; next[index] = { ...template, type: value as ProductType }; setDraft({ ...draft, templates: next }); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRODUCT_TYPE_LABELS.map((item) => <SelectItem key={item.type} value={item.type}>{item.label}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1.5"><Label>Nome do atalho</Label><Input value={template.label} onChange={(e) => { const next = [...draft.templates]; next[index] = { ...template, label: e.target.value }; setDraft({ ...draft, templates: next }); }} /></div>
                  <Button type="button" variant="outline" size="sm" onClick={() => { const next = [...draft.templates]; next[index] = { ...template, capabilities: { ...draft.capabilities } }; setDraft({ ...draft, templates: next }); }}>Usar defaults ({enabledCapabilities.length})</Button>
                  <Button type="button" variant="ghost" size="icon" aria-label="Remover template" onClick={() => setDraft({ ...draft, templates: draft.templates.filter((_, i) => i !== index) })}><Trash2 className="size-4" /></Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-sm"><Switch checked={draft.active} onCheckedChange={(value) => setDraft({ ...draft, active: Boolean(value) })} /> Categoria disponível para novas lojas</label>
          <div className="flex gap-2"><Button variant="ghost" onClick={onCancel} disabled={saving}>Cancelar</Button><Button onClick={onSave} disabled={saving || draft.name.trim().length < 2 || draft.code.trim().length < 2}><Save className="size-4" /> {saving ? "Salvando…" : "Salvar perfil"}</Button></div>
        </div>
      </CardContent>
    </Card>
  );
}
