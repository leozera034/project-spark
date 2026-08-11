import { useState } from "react";
import { Gift, Layers3, Plus, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCatalog } from "../CatalogProvider";
import type { AdvancedBuilder, OptionGroupRole } from "../advanced-types";
import {
  createProductOptionGroupFromTemplate,
  GROUP_ROLE_LABELS,
  updateOptionGroupEngine,
} from "../shark-groups.api";

const ROLE_KEYS = Object.keys(GROUP_ROLE_LABELS);

export function SmartGroupRulesCard({ builder, onSaved }: { builder: AdvancedBuilder; onSaved: () => void }) {
  const { storeId, run, isBusy } = useCatalog();
  const [drafts, setDrafts] = useState<Record<string, { role: string; included: number; freePricing: boolean }>>({});
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickRole, setQuickRole] = useState<OptionGroupRole>("addon");
  const [quickMax, setQuickMax] = useState(1);
  const [quickIncluded, setQuickIncluded] = useState(0);

  if (!builder.can.update || builder.product.is_archived) return null;

  const draftFor = (group: AdvancedBuilder["groups"][number]) => drafts[group.id] ?? {
    role: group.role ?? "generic",
    included: group.included_selections ?? 0,
    freePricing: group.configuration?.price_mode === "none",
  };

  const saveGroup = async (group: AdvancedBuilder["groups"][number]) => {
    if (!storeId) return;
    const draft = draftFor(group);
    const saved = await run(() => updateOptionGroupEngine({
      storeId,
      id: group.id,
      role: draft.role,
      includedSelections: Math.min(Math.max(0, draft.included), group.max_selections),
      configuration: { ...group.configuration, price_mode: draft.freePricing ? "none" : undefined },
    }), "Regra do grupo atualizada.");
    if (saved) onSaved();
  };

  const createQuickGroup = async () => {
    if (!storeId || quickName.trim().length < 2) return;
    const result = await run(() => createProductOptionGroupFromTemplate({
      storeId,
      productId: builder.product.id,
      name: quickName.trim(),
      role: quickRole,
      required: false,
      min: 0,
      max: Math.max(1, quickMax),
      included: Math.min(Math.max(0, quickIncluded), Math.max(1, quickMax)),
      selectionType: quickMax === 1 ? "unica" : "multipla",
    }), "Grupo criado e vinculado.");
    if (result) {
      setQuickName(""); setQuickRole("addon"); setQuickMax(1); setQuickIncluded(0); setQuickOpen(false); onSaved();
    }
  };

  return (
    <Card className="border-violet-400/15">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex items-center gap-2"><Sparkles className="size-4 text-violet-300" /><Badge variant="outline">Progressive disclosure</Badge></div>
            <CardTitle className="text-base">Regras inteligentes dos grupos</CardTitle>
            <CardDescription>Defina o papel de cada grupo e, quando necessário, quantas escolhas já estão incluídas no preço.</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => setQuickOpen((v) => !v)}><Plus className="size-4" /> Grupo rápido</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {quickOpen ? (
          <div className="grid gap-3 rounded-2xl border border-violet-400/15 bg-violet-500/[.04] p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5"><Label>Nome</Label><Input value={quickName} onChange={(e) => setQuickName(e.target.value)} placeholder="Ex.: Escolha os cremes" /></div>
            <div className="space-y-1.5"><Label>Função</Label><Select value={quickRole} onValueChange={setQuickRole}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ROLE_KEYS.map((key)=><SelectItem key={key} value={key}>{GROUP_ROLE_LABELS[key]}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Máximo</Label><Input type="number" min={1} max={50} value={quickMax} onChange={(e)=>setQuickMax(Math.max(1,Number(e.target.value)||1))} /></div>
            <div className="space-y-1.5"><Label>Incluídos grátis</Label><Input type="number" min={0} max={quickMax} value={quickIncluded} onChange={(e)=>setQuickIncluded(Math.max(0,Number(e.target.value)||0))} /></div>
            <div className="sm:col-span-2 lg:col-span-4 flex justify-end"><Button disabled={isBusy||quickName.trim().length<2} onClick={()=>void createQuickGroup()}>Criar grupo</Button></div>
          </div>
        ) : null}

        {builder.groups.length === 0 ? <p className="text-sm text-muted-foreground">Crie um grupo rápido ou vincule um grupo existente abaixo.</p> : (
          <div className="space-y-3">
            {builder.groups.map((group) => {
              const draft = draftFor(group);
              return (
                <div key={group.id} className="grid gap-3 rounded-2xl border border-border bg-card/40 p-4 lg:grid-cols-[1.2fr_1fr_160px_auto] lg:items-end">
                  <div><p className="font-semibold">{group.name}</p><p className="mt-1 text-xs text-muted-foreground">mín {group.min_selections} · máx {group.max_selections}{group.portion_count ? ` · ${group.portion_count} porções` : ""}</p></div>
                  <div className="space-y-1.5"><Label>O que este grupo representa</Label><Select value={draft.role} onValueChange={(role)=>setDrafts((prev)=>({...prev,[group.id]:{...draft,role}}))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ROLE_KEYS.map((key)=><SelectItem key={key} value={key}>{GROUP_ROLE_LABELS[key]}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1.5"><Label className="flex items-center gap-1"><Gift className="size-3.5" /> Incluídos</Label><Input type="number" min={0} max={group.max_selections} value={draft.included} onChange={(e)=>setDrafts((prev)=>({...prev,[group.id]:{...draft,included:Math.max(0,Number(e.target.value)||0)}}))} /></div>
                  <div className="flex flex-col gap-2"><label className="flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={draft.freePricing} onCheckedChange={(v)=>setDrafts((prev)=>({...prev,[group.id]:{...draft,freePricing:Boolean(v)}}))} /><Layers3 className="size-3.5" /> Grupo sem preço</label><Button size="sm" disabled={isBusy} onClick={()=>void saveGroup(group)}>Salvar</Button></div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
