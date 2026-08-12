import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Shapes, Sparkles } from "lucide-react";

import { listActiveCategoryProfiles } from "@/catalog/category-profiles.admin";
import { getStoreCategoryProfile, setStoreCategoryProfile } from "@/catalog/shark-engine.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useStoreConfig } from "@/store-config/StoreConfigProvider";

export const Route = createFileRoute("/app/loja/configuracoes/categoria")({ component: StoreCategoryProfile });

function StoreCategoryProfile() {
  const { storeId, save, isSaving } = useStoreConfig();
  const profiles = useQuery({
    queryKey: ["category-profiles", "active"],
    queryFn: listActiveCategoryProfiles,
  });
  const current = useQuery({
    queryKey: ["store-category-profile", storeId],
    queryFn: () => getStoreCategoryProfile(storeId!),
    enabled: Boolean(storeId),
  });

  const selectProfile = async (profileId: string) => {
    if (!storeId) return;
    const ok = await save(() => setStoreCategoryProfile(storeId, profileId), "Categoria principal atualizada.");
    if (ok) void current.refetch();
  };

  return (
    <div className="space-y-5">
      <Card className="border-violet-400/15">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2"><Shapes className="size-4 text-violet-500" /><Badge variant="outline">Motor inteligente</Badge></div>
          <CardTitle>Categoria principal da loja</CardTitle>
          <CardDescription>
            A categoria ajusta sugestões e atalhos do cardápio. Ela não limita o que você pode vender: cada produto continua tendo regras próprias.
          </CardDescription>
        </CardHeader>
        {current.data ? (
          <CardContent>
            <div className="rounded-2xl border border-violet-400/15 bg-violet-500/[.04] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Categoria atual</p>
              <p className="mt-1 text-lg font-semibold">{current.data.name}</p>
              {current.data.description ? <p className="mt-1 text-sm text-muted-foreground">{current.data.description}</p> : null}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {current.data.product_templates.map((template) => <Badge key={`${template.type}-${template.label}`} variant="secondary">{template.label}</Badge>)}
              </div>
            </div>
          </CardContent>
        ) : null}
      </Card>

      <div>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div><h2 className="font-semibold">Escolha o perfil que mais se aproxima da operação</h2><p className="text-sm text-muted-foreground">Você pode mudar depois sem converter produtos já existentes.</p></div>
          <Sparkles className="hidden size-5 text-violet-500 sm:block" />
        </div>

        {profiles.isLoading || current.isLoading ? (
          <div className="grid gap-3 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}</div>
        ) : profiles.error ? (
          <Card><CardContent className="py-8 text-sm text-destructive">Não foi possível carregar as categorias disponíveis.</CardContent></Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {(profiles.data ?? []).map((profile) => {
              const selected = current.data?.id === profile.id;
              return (
                <Card key={profile.id} className={selected ? "border-violet-500/40" : undefined}>
                  <CardContent className="flex h-full flex-col gap-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="font-semibold">{profile.name}</p><p className="mt-1 text-sm text-muted-foreground">{profile.description}</p></div>
                      {selected ? <Badge><CheckCircle2 className="mr-1 size-3.5" /> Atual</Badge> : null}
                    </div>
                    <div className="mt-auto flex flex-wrap gap-1.5">
                      {profile.product_templates.slice(0, 4).map((template) => <Badge key={`${template.type}-${template.label}`} variant="outline">{template.label}</Badge>)}
                    </div>
                    <Button variant={selected ? "outline" : "default"} disabled={selected || isSaving} onClick={() => void selectProfile(profile.id)}>{selected ? "Selecionada" : "Usar esta categoria"}</Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
