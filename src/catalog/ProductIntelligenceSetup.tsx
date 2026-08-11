import { Sparkles, WandSparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  CAPABILITY_LABELS,
  PRODUCT_TYPE_LABELS,
  recommendedCapabilities,
  type CategoryProfile,
} from "./shark-engine.api";
import type { ProductCapabilities, ProductPricingRules, ProductType } from "./advanced-types";

export type ProductIntelligenceValues = {
  productType: ProductType;
  capabilities: ProductCapabilities;
  pricingRules: ProductPricingRules;
};

export function initialIntelligenceValues(profile: CategoryProfile | null): ProductIntelligenceValues {
  const first = profile?.product_templates[0];
  const type = first?.type ?? "simple";
  return { productType: type, capabilities: recommendedCapabilities(profile, type), pricingRules: {} };
}

export function ProductIntelligenceSetup({
  profile,
  value,
  onChange,
}: {
  profile: CategoryProfile | null;
  value: ProductIntelligenceValues;
  onChange: (next: ProductIntelligenceValues) => void;
}) {
  const visibleCapabilities = Object.entries({
    ...(profile?.default_capabilities ?? {}),
    ...value.capabilities,
  }).filter(([, enabled]) => typeof enabled === "boolean");

  const selectType = (type: ProductType) => {
    onChange({
      productType: type,
      capabilities: recommendedCapabilities(profile, type),
      pricingRules: type === "multi_flavor" ? { multi_flavor_pricing: "highest" } : {},
    });
  };

  const toggleCapability = (key: string, enabled: boolean) =>
    onChange({ ...value, capabilities: { ...value.capabilities, [key]: enabled } });

  return (
    <Card className="overflow-hidden border-violet-400/15 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,.12),transparent_40%),var(--card)]">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-xl bg-violet-500/10 text-violet-300"><WandSparkles className="size-4" /></span>
              <Badge variant="outline">Motor inteligente</Badge>
            </div>
            <CardTitle>Como este produto funciona?</CardTitle>
            <CardDescription className="mt-1">
              {profile ? `${profile.name} sugere uma estrutura inicial, mas você pode mudar tudo.` : "Escolha uma estrutura. A categoria da loja nunca limita o produto."}
            </CardDescription>
          </div>
          {profile ? <span className="text-xs font-semibold text-violet-300">Perfil: {profile.name}</span> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {PRODUCT_TYPE_LABELS.map((item) => {
            const active = value.productType === item.type;
            return (
              <button
                key={item.type}
                type="button"
                onClick={() => selectType(item.type)}
                className={`rounded-2xl border p-3 text-left transition ${active ? "border-violet-400/40 bg-violet-500/12 shadow-[0_0_28px_rgba(139,92,246,.08)]" : "border-border bg-card/50 hover:border-violet-400/20"}`}
              >
                <p className="text-sm font-bold">{item.label}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p>
              </button>
            );
          })}
        </div>

        {visibleCapabilities.length > 0 ? (
          <div>
            <div className="mb-3 flex items-center gap-2"><Sparkles className="size-4 text-violet-300" /><p className="text-sm font-semibold">Recursos deste produto</p></div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {visibleCapabilities.map(([key]) => (
                <label key={key} className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-background/40 px-3 py-2">
                  <span className="text-sm">{CAPABILITY_LABELS[key] ?? key.replaceAll("_", " ")}</span>
                  <Switch checked={Boolean(value.capabilities[key])} onCheckedChange={(checked) => toggleCapability(key, Boolean(checked))} />
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {Boolean(value.capabilities.multi_flavor) ? (
          <div className="rounded-2xl border border-violet-400/15 bg-violet-500/[.05] p-4">
            <p className="text-sm font-semibold">Cobrança quando houver vários sabores</p>
            <p className="mt-1 text-xs text-muted-foreground">A regra fica no produto, não na categoria da loja.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {([
                ["highest", "Maior valor"],
                ["average", "Média dos sabores"],
                ["proportional", "Proporcional às porções"],
                ["fixed_size", "Preço fixo do tamanho"],
              ] as const).map(([rule, label]) => (
                <Button
                  key={rule}
                  type="button"
                  size="sm"
                  variant={value.pricingRules.multi_flavor_pricing === rule ? "default" : "outline"}
                  onClick={() => onChange({ ...value, pricingRules: { ...value.pricingRules, multi_flavor_pricing: rule } })}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
