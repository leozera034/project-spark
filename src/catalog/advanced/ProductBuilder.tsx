import { useQuery } from "@tanstack/react-query";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

import { getAdvancedBuilder, listOptionGroups } from "../advanced-api";
import { catalogErrorMessage } from "../api";
import { useCatalog } from "../CatalogProvider";

import { ConfiguredPreviewCard } from "./ConfiguredPreviewCard";
import { ProductGroupsCard } from "./ProductGroupsCard";
import { SaleModeCard } from "./SaleModeCard";
import { SmartGroupRulesCard } from "./SmartGroupRulesCard";
import { ValidationSummary } from "./ValidationSummary";
import { VariantPricesCard } from "./VariantPricesCard";
import { VariantsCard } from "./VariantsCard";

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
  const refetch = () => { void builderQuery.refetch(); void libraryQuery.refetch(); };

  return (
    <div className="space-y-4">
      <ValidationSummary report={builder.validation} />
      <SaleModeCard builder={builder} onSaved={refetch} />
      <VariantsCard builder={builder} onSaved={refetch} />
      <SmartGroupRulesCard builder={builder} onSaved={refetch} />
      <ProductGroupsCard builder={builder} library={libraryQuery.data ?? []} onSaved={refetch} />
      <VariantPricesCard builder={builder} onSaved={refetch} />
      <ConfiguredPreviewCard builder={builder} />
    </div>
  );
}
