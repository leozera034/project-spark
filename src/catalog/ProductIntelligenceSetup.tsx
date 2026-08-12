import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Sparkles, WandSparkles } from "lucide-react";

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

function humanize(key: string) {
  return CAPABILITY_LABELS[key] ?? key.replaceAll("_", " ");
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
  const [showAdvancedTypes, setShowAdvancedTypes] = useState(false);
  const [showCapabilities, setShowCapabilities] = useState(false);

  const recommendedTemplates = profile?.product_templates ?? [];
  const recommendedTypes = new Set(recommendedTemplates.map((template) => template.type));
  const otherTypes = PRODUCT_TYPE_LABELS.filter((item) => !recommendedTypes.has(item.type));

  const visibleCapabilities = useMemo(() => {
    const keys = new Set<string>();
    for (const [key, enabled] of Object.entries(value.capabilities)) {
      if (typeof enabled === "boolean") keys.add(key);
    }
    return [...keys].map((key) => [key, Boolean(value.capabilities[key])] as const);
  }, [value.capabilities]);

  const selectType = (type: ProductType, explicitCapabilities?: ProductCapabilities) => {
    onChange({
      productType: type,
      capabilities: explicitCapabilities ?? recommendedCapabilities(profile, type),
      pricingRules: type === "multi_flavor" ? { multi_flavor_pricing: "highest" } : {},
    });
  };

  const toggleCapability = (key: string, enabled: boolean) =>
    onChange({ ...value, capabilities: { ...value.capabilities, [key]: enabled } });

  return (
    <Card className="overflow-hidden border-violet-400/15 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,.14),transparent_38%),var(--card)] shadow-[0_24px_80px_-48px_rgba(139,92,246,.75)]">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-2xl bg-violet-500/12 text-violet-300"><WandSparkles className="size-4" /></span>
              <Badge variant="outline">Passo 1 · Estrutura</Badge>
            </div>
            <CardTitle className="text-xl sm:text-2xl">O que você está vendendo?</CardTitle>
            <CardDescription className="mt-2 max-w-xl text-sm leading-6">
              Escolha o modelo mais parecido. O Shark prepara as opções certas e esconde o que não é necessário.
            </CardDescription>
          </div>
          {profile ? <span className="rounded-full border border-violet-400/15 bg-violet-500/[.06] px-3 py-1.5 text-xs font-semibold text-violet-300">Sugestões para {profile.name}</span> : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {recommendedTemplates.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recommendedTemplates.map((template, index) => {
              const active = value.productType === template.type;
              return (
                <button
                  key={`${template.type}-${template.label}`}
                  type="button"
                  onClick={() => selectType(template.type, template.capabilities)}
                  className={`group relative overflow-hidden rounded-[1.35rem] border p-4 text-left transition-all duration-200 ${active ? "border-violet-400/45 bg-violet-500/12 shadow-[0_14px_40px_-28px_rgba(139,92,246,.9)]" : "border-border/80 bg-background/35 hover:-translate-y-0.5 hover:border-violet-400/25"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className={`grid size-9 place-items-center rounded-xl text-sm font-black ${active ? "bg-violet-500 text-white" : "bg-muted text-muted-foreground"}`}>{index + 1}</span>
                    {active ? <Badge className="bg-violet-500/20 text-violet-200 hover:bg-violet-500/20">Selecionado</Badge> : null}
                  </div>
                  <p className="mt-4 text-base font-bold tracking-tight">{template.label}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {PRODUCT_TYPE_LABELS.find((item) => item.type === template.type)?.description ?? "Estrutura sugerida para este produto."}
                  </p>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PRODUCT_TYPE_LABELS.slice(0, 3).map((item) => {
              const active = value.productType === item.type;
              return (
                <button key={item.type} type="button" onClick={() => selectType(item.type)} className={`rounded-[1.35rem] border p-4 text-left transition ${active ? "border-violet-400/45 bg-violet-500/12" : "border-border bg-background/35 hover:border-violet-400/25"}`}>
                  <p className="font-bold">{item.label}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p>
                </button>
              );
            })}
          </div>
        )}

        {otherTypes.length > 0 ? (
          <div>
            <Button type="button" variant="ghost" size="sm" className="px-0 text-muted-foreground" onClick={() => setShowAdvancedTypes((current) => !current)}>
              {showAdvancedTypes ? <ChevronUp className="mr-2 size-4" /> : <ChevronDown className="mr-2 size-4" />}
              {showAdvancedTypes ? "Ocultar outros formatos" : "Meu produto funciona de outro jeito"}
            </Button>
            {showAdvancedTypes ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {otherTypes.map((item) => {
                  const active = value.productType === item.type;
                  return (
                    <button key={item.type} type="button" onClick={() => selectType(item.type)} className={`rounded-2xl border p-3 text-left transition ${active ? "border-violet-400/40 bg-violet-500/12" : "border-border bg-card/40 hover:border-violet-400/20"}`}>
                      <p className="text-sm font-bold">{item.label}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-2xl border border-emerald-400/10 bg-emerald-500/[.035] p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2"><Sparkles className="size-4 text-emerald-300" /><p className="text-sm font-semibold">O Shark já preparou este produto</p></div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {visibleCapabilities.filter(([, enabled]) => enabled).length > 0
                  ? visibleCapabilities.filter(([, enabled]) => enabled).slice(0, 5).map(([key]) => humanize(key)).join(" · ")
                  : "Produto simples, sem configurações extras."}
              </p>
            </div>
            {visibleCapabilities.length > 0 ? (
              <Button type="button" size="sm" variant="outline" onClick={() => setShowCapabilities((current) => !current)}>
                {showCapabilities ? "Fechar ajustes" : "Personalizar"}
              </Button>
            ) : null}
          </div>

          {showCapabilities && visibleCapabilities.length > 0 ? (
            <div className="mt-4 grid gap-2 border-t border-border/60 pt-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleCapabilities.map(([key]) => (
                <label key={key} className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-background/40 px-3 py-2">
                  <span className="text-sm">{humanize(key)}</span>
                  <Switch checked={Boolean(value.capabilities[key])} onCheckedChange={(checked) => toggleCapability(key, Boolean(checked))} />
                </label>
              ))}
            </div>
          ) : null}
        </div>

        {Boolean(value.capabilities.multi_flavor) ? (
          <div className="rounded-2xl border border-violet-400/15 bg-violet-500/[.05] p-4">
            <p className="text-sm font-semibold">Quando o cliente escolher mais de um sabor, como cobrar?</p>
            <p className="mt-1 text-xs text-muted-foreground">Você pode mudar isso depois. A regra pertence a este produto.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {([
                ["highest", "Cobrar o sabor mais caro"],
                ["average", "Fazer a média"],
                ["proportional", "Calcular pelas porções"],
                ["fixed_size", "Usar preço fixo do tamanho"],
              ] as const).map(([rule, label]) => (
                <Button key={rule} type="button" size="sm" variant={value.pricingRules.multi_flavor_pricing === rule ? "default" : "outline"} onClick={() => onChange({ ...value, pricingRules: { ...value.pricingRules, multi_flavor_pricing: rule } })}>
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
