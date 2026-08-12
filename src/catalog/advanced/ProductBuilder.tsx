import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, Layers3, Sparkles } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { getAdvancedBuilder, listOptionGroups } from "../advanced-api";
import { catalogErrorMessage } from "../api";
import { useCatalog } from "../CatalogProvider";
import { PRODUCT_TYPE_LABELS } from "../shark-engine.api";

import { ComboBuilderCard } from "./ComboBuilderCard";
import { ConfiguredPreviewCard } from "./ConfiguredPreviewCard";
import { ProductGroupsCard } from "./ProductGroupsCard";
import { SaleModeCard } from "./SaleModeCard";
import { SmartGroupRulesCard } from "./SmartGroupRulesCard";
import { ValidationSummary } from "./ValidationSummary";
import { VariantPricesCard } from "./VariantPricesCard";
import { VariantsCard } from "./VariantsCard";

function enabled(capabilities: Record<string, unknown> | undefined, ...keys: string[]) {
  return keys.some((key) => capabilities?.[key] === true);
}

export function ProductBuilder({ productId }: { productId: string }) {
  const { storeId } = useCatalog();

  const builderQuery = useQuery({
    queryKey: ["catalog", "builder", storeId, productId],
    queryFn: () => getAdvancedBuilder(storeId!, productId),
    enabled: Boolean(storeId), retry: false,
  });
  const libraryQuery = useQuery({
    queryKey: ["catalog", "option-groups", storeId, false],
    queryFn: () => listOptionGroups(storeId, false),
    enabled: Boolean(storeId), retry: false,
  });

  if (builderQuery.isLoading) return <div className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-48 w-full" /></div>;
  if (builderQuery.error || !builderQuery.data) return <Alert variant="destructive"><AlertTitle>Não foi possível carregar a configuração</AlertTitle><AlertDescription>{catalogErrorMessage(builderQuery.error)}</AlertDescription></Alert>;

  const builder = builderQuery.data;
  const caps = builder.product.capabilities ?? {};
  const type = builder.product.product_type ?? "simple";
  const refetch = () => { void builderQuery.refetch(); void libraryQuery.refetch(); };

  const needsSaleMode = type === "measured" || type === "kit" || enabled(caps, "measured", "stock", "packages", "volume", "kits");
  const needsVariants = type === "variant" || type === "sized" || type === "multi_flavor" || enabled(caps, "sizes", "variants", "packages", "volume");
  const needsCombo = type === "combo" || enabled(caps, "combo_steps", "combos");
  const needsGroups = type === "buildable" || type === "flavors" || type === "multi_flavor" || type === "combo" || enabled(
    caps,
    "option_groups", "flavors", "multi_flavor", "included_choices", "add_ons", "removals", "crust", "dough",
    "doneness", "bread", "sauces", "sides", "beverages", "creams", "fruits", "toppings", "proteins",
    "containers", "portions", "combo_steps",
  );
  const needsVariantPrices = needsVariants && needsGroups;
  const typeLabel = PRODUCT_TYPE_LABELS.find((item) => item.type === type)?.label ?? type;

  const roadmap = [
    { label: "Base", active: true, done: true },
    { label: "Tamanhos / variações", active: needsVariants, done: !needsVariants || builder.variants.length > 0 },
    { label: "Escolhas", active: needsGroups, done: !needsGroups || builder.groups.length > 0 },
    { label: "Combo", active: needsCombo, done: !needsCombo || builder.groups.some((group) => group.role === "combo_step") },
  ].filter((step) => step.active);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-violet-400/15 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,.12),transparent_42%),var(--card)]">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2"><Sparkles className="size-4 text-violet-300" /><span className="text-xs font-semibold uppercase tracking-[.12em] text-violet-300/80">Configuração guiada</span></div>
              <h3 className="mt-2 text-lg font-bold tracking-tight">{typeLabel}</h3>
              <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">O Shark mostra somente as etapas necessárias para este produto. Você não precisa preencher configurações que não usa.</p>
            </div>
            <Badge variant="outline"><Layers3 className="mr-1.5 size-3.5" />Motor v{builder.product.engine_version ?? 1}</Badge>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {roadmap.map((step, index) => (
              <div key={step.label} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${step.done ? "border-emerald-400/15 bg-emerald-500/[.035]" : "border-violet-400/15 bg-violet-500/[.045]"}`}>
                {step.done ? <CheckCircle2 className="size-4 shrink-0 text-emerald-300" /> : <Circle className="size-4 shrink-0 text-violet-300" />}
                <div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Etapa {index + 1}</p><p className="truncate text-sm font-semibold">{step.label}</p></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <ValidationSummary report={builder.validation} />

      {needsSaleMode ? <SaleModeCard builder={builder} onSaved={refetch} /> : null}
      {needsVariants ? <VariantsCard builder={builder} onSaved={refetch} /> : null}
      {needsCombo ? <ComboBuilderCard builder={builder} onSaved={refetch} /> : null}
      {needsGroups ? <SmartGroupRulesCard builder={builder} onSaved={refetch} /> : null}
      {needsGroups ? <ProductGroupsCard builder={builder} library={libraryQuery.data ?? []} onSaved={refetch} /> : null}
      {needsVariantPrices ? <VariantPricesCard builder={builder} onSaved={refetch} /> : null}

      {!needsSaleMode && !needsVariants && !needsGroups && !needsCombo ? (
        <Card className="border-emerald-400/15 bg-emerald-500/[.035]">
          <CardContent className="flex items-start gap-3 p-4">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-300" />
            <div><p className="font-semibold">Produto simples pronto</p><p className="mt-1 text-sm text-muted-foreground">Este produto não precisa de tamanhos, grupos ou etapas extras. Você pode publicar assim e voltar para personalizar depois.</p></div>
          </CardContent>
        </Card>
      ) : null}

      <ConfiguredPreviewCard builder={builder} />
    </div>
  );
}
