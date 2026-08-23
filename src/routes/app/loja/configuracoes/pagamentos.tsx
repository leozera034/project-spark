import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Landmark,
  Loader2,
  Smartphone,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { beginStripeConnectOnboarding } from "@/lib/stripe-connect.functions";
import {
  reorderPaymentMethods,
  setStoreManualPix,
  setStoreOnlinePayments,
  updatePaymentMethod,
} from "@/store-config/api";
import { useStoreConfig } from "@/store-config/StoreConfigProvider";
import type { ManualPixKeyType, StoreConfigPaymentMethod } from "@/store-config/types";

export const Route = createFileRoute("/app/loja/configuracoes/pagamentos")({ component: PagamentosSection });

const PIX_TYPES: { value: ManualPixKeyType; label: string }[] = [
  { value: "aleatoria", label: "Chave aleatória" },
  { value: "cpf_cnpj", label: "CPF ou CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "telefone", label: "Telefone" },
  { value: "outro", label: "Outro" },
];

function formatPercentFromBps(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return `${(Number(value) / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

function PagamentosSection() {
  const { configuration, storeId, save, isSaving, refresh } = useStoreConfig();
  const canEdit = configuration?.can.manage_payment_methods ?? false;
  const methods = configuration?.payment_methods ?? [];
  const setup = configuration?.payment_setup;
  const settings = configuration?.settings;
  const manualMethods = useMemo(
    () => methods.filter((method) => method.kind !== "pix" && method.kind !== "stripe_online"),
    [methods],
  );
  const pixMethod = methods.find((method) => method.kind === "pix") ?? null;
  const anyActive = methods.some((method) => method.is_active);
  const onlineEnabled = setup?.online_enabled ?? settings?.online_payments_enabled ?? false;
  const onlineReady = setup?.online_ready ?? false;
  const fee = formatPercentFromBps(setup?.application_fee_bps);

  const [startingStripe, setStartingStripe] = useState(false);
  const [pixEnabled, setPixEnabled] = useState(false);
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState<ManualPixKeyType>("aleatoria");

  useEffect(() => {
    setPixEnabled(Boolean(pixMethod?.is_active && setup?.manual_pix_configured));
    setPixKey(settings?.manual_pix_key ?? "");
    setPixKeyType(settings?.manual_pix_key_type ?? "aleatoria");
  }, [pixMethod?.is_active, settings?.manual_pix_key, settings?.manual_pix_key_type, setup?.manual_pix_configured]);

  const storedPixKey = settings?.manual_pix_key ?? "";
  const storedPixType = settings?.manual_pix_key_type ?? "aleatoria";
  const pixDirty = pixKey.trim() !== storedPixKey || pixKeyType !== storedPixType;

  async function startStripeOnboarding() {
    if (!storeId || startingStripe) return;
    setStartingStripe(true);
    try {
      const result = await beginStripeConnectOnboarding({ data: { storeId } });
      if (result.alreadyReady) {
        toast.success("Conta de recebimento pronta. Agora é só ligar o pagamento online.");
        refresh();
        return;
      }
      if (!result.onboardingUrl) throw new Error("onboarding_url_missing");
      window.location.assign(result.onboardingUrl);
    } catch {
      toast.error("Não foi possível abrir a ativação da Stripe agora.");
    } finally {
      setStartingStripe(false);
    }
  }

  async function toggleOnline(enabled: boolean) {
    if (!storeId) return;
    await save(
      () => setStoreOnlinePayments({ storeId, enabled, acknowledgeFees: enabled }),
      enabled ? "Pagamento online ativado no checkout." : "Pagamento online pausado no checkout.",
    );
  }

  async function persistPix(enabled: boolean, message: string) {
    if (!storeId) return null;
    return save(
      () => setStoreManualPix({ storeId, enabled, pixKey: pixKey.trim() || null, pixKeyType }),
      message,
    );
  }

  async function togglePix(checked: boolean) {
    if (!canEdit || isSaving) return;
    setPixEnabled(checked);
    if (!checked) {
      await persistPix(false, "Pix direto para a loja desativado.");
      return;
    }
    if (pixKey.trim().length < 3) {
      toast.info("Cadastre a chave Pix e toque em “Salvar e ativar Pix”.");
      return;
    }
    await persistPix(true, "Pix direto para a loja ativado.");
  }

  async function savePix() {
    if (!storeId) return;
    const enabled = pixEnabled;
    await persistPix(
      enabled,
      enabled ? (pixDirty ? "Chave Pix atualizada e mantida ativa." : "Pix direto para a loja ativado.") : "Chave Pix salva.",
    );
  }

  const moveManual = (methodId: string, direction: -1 | 1) => {
    if (!storeId) return;
    const manualIndex = manualMethods.findIndex((method) => method.id === methodId);
    const target = manualIndex + direction;
    if (manualIndex < 0 || target < 0 || target >= manualMethods.length) return;
    const firstId = manualMethods[manualIndex].id;
    const secondId = manualMethods[target].id;
    const next = [...methods];
    const firstIndex = next.findIndex((method) => method.id === firstId);
    const secondIndex = next.findIndex((method) => method.id === secondId);
    [next[firstIndex], next[secondIndex]] = [next[secondIndex], next[firstIndex]];
    void save(() => reorderPaymentMethods(storeId, next.map((method) => method.id)), "Ordem atualizada.");
  };

  return (
    <div className="space-y-6 pb-4">
      <div>
        <p className="text-xs font-black uppercase tracking-[.14em] text-muted-foreground">Pagamentos e recebimentos</p>
        <h1 className="mt-1 font-display text-2xl font-black">Como sua loja quer receber?</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Use pagamento online com confirmação automática ou receba direto na loja por Pix, dinheiro e maquininha. Você pode usar os dois modelos ao mesmo tempo.
        </p>
      </div>

      {!anyActive ? (
        <Alert>
          <AlertDescription>Ative pelo menos uma forma de pagamento para o cliente conseguir finalizar o pedido.</AlertDescription>
        </Alert>
      ) : null}

      <Card className="overflow-hidden border-brand/20">
        <CardHeader className="bg-brand-soft/25">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand text-brand-foreground"><Landmark className="size-5" /></span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>Pagamento online</CardTitle>
                  <Badge variant={onlineEnabled ? "success" : onlineReady ? "warning" : "outline"}>
                    {onlineEnabled ? "Ativo no checkout" : onlineReady ? "Pronto para ligar" : setup?.stripe_connected ? "Ativação incompleta" : "Desativado"}
                  </Badge>
                </div>
                <CardDescription className="mt-1 max-w-2xl">
                  O cliente paga online e a Comandiva concilia a venda automaticamente. O valor líquido fica disponível para repasse à sua loja.
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-5">
          {!onlineReady ? (
            <div className="rounded-2xl border border-brand/20 bg-brand-soft/20 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-background text-brand shadow-sm"><CreditCard className="size-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{setup?.stripe_connected ? "Termine a ativação" : "Ative em poucos passos"}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {setup?.stripe_connected
                      ? "Seu cadastro já começou. Continue na Stripe até a conta bancária e as transferências ficarem liberadas."
                      : "Você será levado ao ambiente seguro da Stripe para cadastrar os dados de recebimento. Ao terminar, volta direto para esta tela."}
                  </p>
                  {canEdit ? (
                    <Button type="button" className="mt-4 min-h-12 w-full sm:w-auto" disabled={startingStripe} onClick={() => void startStripeOnboarding()}>
                      {startingStripe ? <Loader2 className="size-4 animate-spin" /> : <Landmark className="size-4" />}
                      {startingStripe ? "Abrindo Stripe…" : setup?.stripe_connected ? "Continuar ativação" : "Ativar pagamento online"}
                    </Button>
                  ) : <p className="mt-3 text-xs text-muted-foreground">Somente quem gerencia pagamentos pode iniciar esta ativação.</p>}
                </div>
              </div>
            </div>
          ) : (
            <div className={`rounded-2xl border p-4 sm:p-5 ${onlineEnabled ? "border-success/25 bg-success-soft/35" : "border-border bg-muted/20"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">Aceitar pagamentos online</p>
                    {onlineEnabled ? <Badge variant="success">Ligado</Badge> : <Badge variant="outline">Desligado</Badge>}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {onlineEnabled
                      ? "O cliente já pode escolher pagamento online no checkout. Para pausar, basta desligar a chave ao lado."
                      : "Ligue para publicar o pagamento online. Desligar depois não desconecta a Stripe nem apaga vendas e repasses."}
                  </p>
                </div>
                <Switch checked={onlineEnabled} disabled={!canEdit || isSaving} aria-label="Aceitar pagamentos online" onCheckedChange={(checked) => void toggleOnline(checked)} />
              </div>
              {!onlineEnabled ? (
                <p className="mt-3 rounded-xl bg-background/75 p-3 text-xs leading-5 text-muted-foreground">
                  Ao ligar, você confirma que entende as taxas exibidas abaixo. O saldo fica disponível para repasse depois da liberação financeira da venda.
                </p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2"><Button asChild variant="outline" size="sm"><Link to="/app/loja/financeiro">Ver saldo e repasses</Link></Button></div>
              )}
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-3">
            <Benefit icon={<CreditCard className="size-4" />} title="Pix e cartão" text="A Stripe mostra os meios online compatíveis com a transação." />
            <Benefit icon={<CheckCircle2 className="size-4" />} title="Confirmação automática" text="Você não precisa conferir manualmente se o pagamento caiu." />
            <Benefit icon={<Landmark className="size-4" />} title="Repasse organizado" text="Vendas, taxas, saldo e repasses aparecem no Financeiro." />
          </div>

          <details className="rounded-2xl border border-border bg-muted/15">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold">Ver taxas e detalhes da ativação</summary>
            <div className="space-y-4 border-t border-border p-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Taxa Comandiva: {fee ?? "conforme contrato"}</Badge>
                <Badge variant="outline">Taxa Stripe: varia por transação</Badge>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                A Comandiva processa a cobrança online e transfere o valor devido à loja. Reembolsos, disputas e processamento podem deixar uma venda temporariamente pendente. Quando liberada, ela aparece na <Link to="/app/loja/financeiro" className="font-bold text-brand underline-offset-4 hover:underline">Central Financeira</Link>.
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                <StatusItem label="Cadastro" ok={Boolean(setup?.details_submitted)} />
                <StatusItem label="Conta de recebimento" ok={Boolean(setup?.payouts_enabled)} />
                <StatusItem label="Transferências" ok={Boolean(setup?.transfers_enabled)} />
              </div>
              {!onlineReady ? (
                <div className="flex items-start gap-2 rounded-xl border border-warning/25 bg-warning-soft/35 p-3 text-sm"><TriangleAlert className="mt-0.5 size-4 shrink-0" /><p>Enquanto algum item estiver pendente, o pagamento online não é publicado para o cliente.</p></div>
              ) : null}
            </div>
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-foreground"><Banknote className="size-5" /></span><div><CardTitle>Receber direto na loja</CardTitle><CardDescription className="mt-1">Sem repasse pela Comandiva. A loja recebe e confere o pagamento por conta própria.</CardDescription></div></div>
        </CardHeader>
        <CardContent className="space-y-5">
          <Alert><AlertDescription>A Comandiva registra a forma escolhida, mas não consegue confirmar se um Pix manual, dinheiro ou pagamento na maquininha realmente caiu. A loja deve conferir antes de tratar o valor como recebido.</AlertDescription></Alert>

          <div className="rounded-2xl border border-border p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted"><Smartphone className="size-5" /></span><div><p className="font-bold">Pix direto para a loja</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Cadastre a chave uma vez. Depois, ligar ou desligar salva automaticamente.</p></div></div>
              <Switch checked={pixEnabled} disabled={!canEdit || isSaving} aria-label="Pix direto para a loja ativo" onCheckedChange={(checked) => void togglePix(checked)} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[180px_1fr]">
              <div className="space-y-1.5"><Label htmlFor="pix-key-type">Tipo da chave</Label><select id="pix-key-type" value={pixKeyType} onChange={(event) => setPixKeyType(event.target.value as ManualPixKeyType)} disabled={!canEdit || isSaving} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-base">{PIX_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></div>
              <div className="space-y-1.5"><Label htmlFor="pix-key">Chave Pix</Label><Input id="pix-key" autoComplete="off" value={pixKey} onChange={(event) => setPixKey(event.target.value)} disabled={!canEdit || isSaving} placeholder="Cadastre a chave que receberá o pagamento" className="h-12 text-base" maxLength={180} /></div>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">{setup?.manual_pix_configured ? "Chave cadastrada. Alterou a chave? Salve para aplicar no checkout." : "Cadastre a chave e ative o Pix."}</p>
              <Button type="button" className="min-h-11" disabled={!canEdit || isSaving || (pixEnabled && pixKey.trim().length < 3) || (!pixDirty && setup?.manual_pix_configured && pixEnabled === Boolean(pixMethod?.is_active))} onClick={() => void savePix()}>
                {pixEnabled ? (setup?.manual_pix_configured ? "Salvar alterações" : "Salvar e ativar Pix") : "Salvar chave"}
              </Button>
            </div>
          </div>

          <div>
            <h3 className="font-bold">Dinheiro e maquininha</h3>
            <p className="mt-1 text-sm text-muted-foreground">Esses meios são presenciais. Ligue ou desligue rapidamente; abra “Editar” somente quando precisar mudar instruções e disponibilidade.</p>
            <div className="mt-3 space-y-3">
              {manualMethods.length === 0 ? <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">Nenhum outro meio manual cadastrado.</p> : manualMethods.map((method, index) => (
                <MethodRow key={method.id} method={method} canEdit={canEdit} saving={isSaving} isFirst={index === 0} isLast={index === manualMethods.length - 1} onMove={(direction) => moveManual(method.id, direction)} />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Benefit({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="rounded-xl border border-border bg-background p-3"><div className="flex items-center gap-2 text-sm font-bold">{icon}<span>{title}</span></div><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p></div>;
}
function StatusItem({ label, ok }: { label: string; ok: boolean }) { return <div className="flex min-h-11 items-center justify-between rounded-xl border border-border px-3 text-sm"><span>{label}</span><span className={ok ? "font-bold text-success" : "text-muted-foreground"}>{ok ? "Pronto" : "Pendente"}</span></div>; }

function MethodRow({ method, canEdit, saving, isFirst, isLast, onMove }: { method: StoreConfigPaymentMethod; canEdit: boolean; saving: boolean; isFirst: boolean; isLast: boolean; onMove: (direction: -1 | 1) => void }) {
  const { storeId, save } = useStoreConfig();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(method.label);
  const [instructions, setInstructions] = useState(method.instructions ?? "");
  const [needsChange, setNeedsChange] = useState(method.needs_change);
  const [delivery, setDelivery] = useState(method.available_for_delivery);
  const [pickup, setPickup] = useState(method.available_for_pickup);
  useEffect(() => { setLabel(method.label); setInstructions(method.instructions ?? ""); setNeedsChange(method.needs_change); setDelivery(method.available_for_delivery); setPickup(method.available_for_pickup); }, [method]);
  const persist = (overrides?: Partial<Parameters<typeof updatePaymentMethod>[0]>) => { if (!storeId) return; void save(() => updatePaymentMethod({ storeId, id: method.id, label, instructions, needsChange, isActive: method.is_active, availableForDelivery: delivery, availableForPickup: pickup, ...overrides }), "Forma de pagamento atualizada."); };
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-sm font-semibold text-foreground">{method.label}</p><p className="mt-0.5 text-xs text-muted-foreground">Manual · {[method.available_for_delivery ? "Entrega" : null, method.available_for_pickup ? "Retirada" : null].filter(Boolean).join(" · ") || "Sem disponibilidade"}</p></div>
        <div className="flex items-center gap-2">
          {canEdit ? <><Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label={`Mover ${method.label} para cima`} disabled={isFirst || saving} onClick={() => onMove(-1)}>↑</Button><Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label={`Mover ${method.label} para baixo`} disabled={isLast || saving} onClick={() => onMove(1)}>↓</Button><Button type="button" variant="outline" className="min-h-11" onClick={() => setOpen((value) => !value)}>{open ? "Fechar" : "Editar"}</Button></> : null}
          <Switch checked={method.is_active} disabled={!canEdit || saving} aria-label={`${method.label} ativo`} onCheckedChange={(checked) => persist({ isActive: checked })} />
        </div>
      </div>
      {open && canEdit ? <div className="mt-4 space-y-4 border-t border-border pt-4">
        <div className="space-y-1.5"><Label htmlFor={`pm-label-${method.id}`}>Nome exibido ao cliente</Label><Input id={`pm-label-${method.id}`} value={label} maxLength={60} className="h-12 text-base" onChange={(event) => setLabel(event.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor={`pm-inst-${method.id}`}>Instruções</Label><Textarea id={`pm-inst-${method.id}`} value={instructions} maxLength={400} className="text-base" onChange={(event) => setInstructions(event.target.value)} /></div>
        {method.kind === "dinheiro" ? <div className="flex items-center justify-between rounded-lg border border-border p-4"><Label htmlFor={`pm-change-${method.id}`} className="text-sm">Perguntar troco ao cliente</Label><Switch id={`pm-change-${method.id}`} checked={needsChange} onCheckedChange={setNeedsChange} /></div> : null}
        <div className="grid gap-3 sm:grid-cols-2"><div className="flex items-center justify-between rounded-lg border border-border p-4"><Label htmlFor={`pm-del-${method.id}`} className="text-sm">Disponível na entrega</Label><Switch id={`pm-del-${method.id}`} checked={delivery} onCheckedChange={setDelivery} /></div><div className="flex items-center justify-between rounded-lg border border-border p-4"><Label htmlFor={`pm-pick-${method.id}`} className="text-sm">Disponível na retirada</Label><Switch id={`pm-pick-${method.id}`} checked={pickup} onCheckedChange={setPickup} /></div></div>
        <div className="flex justify-end"><Button type="button" className="min-h-11" loading={saving} loadingLabel="Salvando" onClick={() => persist()}>Salvar</Button></div>
      </div> : null}
    </div>
  );
}