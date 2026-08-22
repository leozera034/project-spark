import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Landmark,
  Loader2,
  ShieldCheck,
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

  const [onlineAck, setOnlineAck] = useState(false);
  const [startingStripe, setStartingStripe] = useState(false);
  const [pixEnabled, setPixEnabled] = useState(false);
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState<ManualPixKeyType>("aleatoria");

  useEffect(() => {
    setPixEnabled(Boolean(pixMethod?.is_active && setup?.manual_pix_configured));
    setPixKey(settings?.manual_pix_key ?? "");
    setPixKeyType(settings?.manual_pix_key_type ?? "aleatoria");
  }, [pixMethod?.is_active, settings?.manual_pix_key, settings?.manual_pix_key_type, setup?.manual_pix_configured]);

  async function startStripeOnboarding() {
    if (!storeId || startingStripe) return;
    setStartingStripe(true);
    try {
      const result = await beginStripeConnectOnboarding({ data: { storeId } });
      if (result.alreadyReady) {
        toast.success("Cadastro Stripe pronto. Atualizamos o estado dos recebimentos.");
        refresh();
        return;
      }
      if (!result.onboardingUrl) throw new Error("onboarding_url_missing");
      window.location.assign(result.onboardingUrl);
    } catch {
      toast.error("Não foi possível abrir o cadastro Stripe agora.");
    } finally {
      setStartingStripe(false);
    }
  }

  async function toggleOnline(enabled: boolean) {
    if (!storeId) return;
    const ok = await save(
      () => setStoreOnlinePayments({ storeId, enabled, acknowledgeFees: enabled ? onlineAck : false }),
      enabled ? "Pagamentos online ativados." : "Pagamentos online pausados.",
    );
    if (ok) setOnlineAck(false);
  }

  async function savePix() {
    if (!storeId) return;
    await save(
      () => setStoreManualPix({ storeId, enabled: pixEnabled, pixKey: pixKey.trim() || null, pixKeyType }),
      pixEnabled ? "Pix direto para a loja atualizado." : "Pix direto para a loja desativado.",
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
        <p className="text-xs font-black uppercase tracking-[.14em] text-muted-foreground">Recebimentos</p>
        <h1 className="mt-1 font-display text-2xl font-black">Como sua loja quer receber?</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Você pode aceitar pagamentos online com confirmação automática ou receber diretamente da pessoa cliente. Os dois modelos são independentes e podem ficar ativos ao mesmo tempo.
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
                  <CardTitle>Receber online pela Comandiva</CardTitle>
                  <Badge variant={onlineEnabled ? "success" : onlineReady ? "warning" : "outline"}>
                    {onlineEnabled ? "Ativo" : onlineReady ? "Pronto para ativar" : setup?.stripe_connected ? "Cadastro em andamento" : "Não configurado"}
                  </Badge>
                </div>
                <CardDescription className="mt-1 max-w-2xl">
                  Pagamento antes da confirmação do pedido, processado pela Stripe, com conciliação automática no Financeiro.
                </CardDescription>
              </div>
            </div>
            {onlineEnabled ? <ShieldCheck className="size-7 text-success" /> : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          <div className="grid gap-3 md:grid-cols-3">
            <Benefit icon={<CreditCard className="size-4" />} title="Pix e cartão" text="A Stripe mostra os meios compatíveis com conta, país e moeda." />
            <Benefit icon={<CheckCircle2 className="size-4" />} title="Confirmação automática" text="A operação recebe o status real do processador, sem conferência manual." />
            <Benefit icon={<Landmark className="size-4" />} title="Repasse conciliado" text="Saldo liberado aparece no Financeiro antes de entrar no fluxo de repasse." />
          </div>

          <div className="rounded-2xl border border-border bg-muted/25 p-4 text-sm leading-6">
            <p className="font-bold">Taxas e repasses</p>
            <p className="mt-1 text-muted-foreground">
              Há custos do processador e, quando aplicável, taxa da Comandiva. A taxa do processador pode variar conforme o meio usado; por isso não mostramos um percentual fixo que possa ficar incorreto.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="outline">Taxa Comandiva: {fee ?? "conforme contrato"}</Badge>
              <Badge variant="outline">Taxa Stripe: conforme transação</Badge>
            </div>
            <p className="mt-3 text-muted-foreground">
              O valor só entra como disponível quando o processador liberar o saldo. Isso mantém uma margem operacional para reembolsos e disputas antes do repasse. Veja valores e disponibilidade na <Link to="/app/loja/financeiro" className="font-bold text-brand underline-offset-4 hover:underline">Central Financeira</Link>.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <StatusItem label="Cadastro Stripe" ok={Boolean(setup?.details_submitted)} />
            <StatusItem label="Cobranças" ok={Boolean(setup?.charges_enabled)} />
            <StatusItem label="Repasses" ok={Boolean(setup?.payouts_enabled)} />
            <StatusItem label="Transferências" ok={Boolean(setup?.transfers_enabled)} />
          </div>

          {!onlineReady ? (
            <div className="rounded-2xl border border-warning/30 bg-warning-soft/40 p-4">
              <div className="flex items-start gap-2 text-sm">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <p>Conclua o cadastro seguro da Stripe antes de oferecer pagamento online no checkout.</p>
              </div>
              {canEdit ? (
                <Button type="button" className="mt-3 min-h-11" disabled={startingStripe} onClick={() => void startStripeOnboarding()}>
                  {startingStripe ? <Loader2 className="size-4 animate-spin" /> : <Landmark className="size-4" />}
                  {setup?.stripe_connected ? "Continuar cadastro Stripe" : "Configurar Stripe"}
                </Button>
              ) : null}
            </div>
          ) : onlineEnabled ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-success/25 bg-success-soft/35 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-bold">Pagamentos online estão publicados</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Pausar remove o meio online do checkout, mas não desconecta a Stripe nem apaga o histórico financeiro.</p></div>
              <Button type="button" variant="outline" className="min-h-11 shrink-0" disabled={!canEdit || isSaving} onClick={() => void toggleOnline(false)}>Pausar pagamentos online</Button>
            </div>
          ) : (
            <div className="rounded-2xl border border-brand/20 bg-brand-soft/20 p-4">
              <label className="flex min-h-11 cursor-pointer items-start gap-3">
                <input type="checkbox" checked={onlineAck} onChange={(event) => setOnlineAck(event.target.checked)} disabled={!canEdit || isSaving} className="mt-1 size-5 accent-current" />
                <span className="text-sm leading-6">Li as informações acima e entendo que pagamentos online possuem taxas e seguem a disponibilidade financeira do processador antes do repasse.</span>
              </label>
              <Button type="button" className="mt-3 min-h-12 w-full sm:w-auto" disabled={!canEdit || isSaving || !onlineAck} onClick={() => void toggleOnline(true)}>Ativar pagamentos online</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-foreground"><Banknote className="size-5" /></span>
            <div><CardTitle>Receber direto na loja</CardTitle><CardDescription className="mt-1">Sem repasse pela Comandiva. A loja recebe e confere o pagamento por conta própria.</CardDescription></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <Alert>
            <AlertDescription>
              A Comandiva registra a forma escolhida, mas não consegue confirmar se um Pix manual, dinheiro ou pagamento na maquininha realmente caiu. A loja deve conferir antes de tratar o valor como recebido.
            </AlertDescription>
          </Alert>

          <div className="rounded-2xl border border-border p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted"><Smartphone className="size-5" /></span><div><p className="font-bold">Pix direto para a loja</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">A chave só é mostrada depois que o pedido é criado, usando o link privado de acompanhamento.</p></div></div>
              <Switch checked={pixEnabled} disabled={!canEdit || isSaving} aria-label="Pix direto para a loja ativo" onCheckedChange={setPixEnabled} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[180px_1fr]">
              <div className="space-y-1.5"><Label htmlFor="pix-key-type">Tipo da chave</Label><select id="pix-key-type" value={pixKeyType} onChange={(event) => setPixKeyType(event.target.value as ManualPixKeyType)} disabled={!canEdit || isSaving} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-base">{PIX_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></div>
              <div className="space-y-1.5"><Label htmlFor="pix-key">Chave Pix</Label><Input id="pix-key" autoComplete="off" value={pixKey} onChange={(event) => setPixKey(event.target.value)} disabled={!canEdit || isSaving} placeholder="Cadastre a chave que receberá o pagamento" className="h-12 text-base" maxLength={180} /></div>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">{setup?.manual_pix_configured ? "Chave configurada. O valor completo fica visível somente no campo de edição acima." : "Nenhuma chave configurada."}</p>
              <Button type="button" className="min-h-11" disabled={!canEdit || isSaving || (pixEnabled && pixKey.trim().length < 3)} onClick={() => void savePix()}>Salvar Pix</Button>
            </div>
          </div>

          <div>
            <h3 className="font-bold">Dinheiro e maquininha</h3>
            <p className="mt-1 text-sm text-muted-foreground">Esses meios são presenciais. Edite instruções, disponibilidade e ordem exibida no checkout.</p>
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
  return <div className="rounded-2xl border border-border bg-background p-4"><div className="flex items-center gap-2 font-bold">{icon}<span>{title}</span></div><p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{text}</p></div>;
}

function StatusItem({ label, ok }: { label: string; ok: boolean }) {
  return <div className="flex min-h-11 items-center justify-between rounded-xl border border-border px-3 text-sm"><span>{label}</span><span className={ok ? "font-bold text-success" : "text-muted-foreground"}>{ok ? "Pronto" : "Pendente"}</span></div>;
}

function MethodRow({ method, canEdit, saving, isFirst, isLast, onMove }: { method: StoreConfigPaymentMethod; canEdit: boolean; saving: boolean; isFirst: boolean; isLast: boolean; onMove: (direction: -1 | 1) => void }) {
  const { storeId, save } = useStoreConfig();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(method.label);
  const [instructions, setInstructions] = useState(method.instructions ?? "");
  const [needsChange, setNeedsChange] = useState(method.needs_change);
  const [delivery, setDelivery] = useState(method.available_for_delivery);
  const [pickup, setPickup] = useState(method.available_for_pickup);

  useEffect(() => {
    setLabel(method.label);
    setInstructions(method.instructions ?? "");
    setNeedsChange(method.needs_change);
    setDelivery(method.available_for_delivery);
    setPickup(method.available_for_pickup);
  }, [method]);

  const persist = (overrides?: Partial<Parameters<typeof updatePaymentMethod>[0]>) => {
    if (!storeId) return;
    void save(() => updatePaymentMethod({ storeId, id: method.id, label, instructions, needsChange, isActive: method.is_active, availableForDelivery: delivery, availableForPickup: pickup, ...overrides }), "Forma de pagamento atualizada.");
  };

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
