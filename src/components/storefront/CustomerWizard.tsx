import { useEffect, useMemo, useRef, useState } from "react";
import { Bike, Check, ChevronRight, Home, MapPin, Search, Store, Trash2, UserRound } from "lucide-react";

import { brl } from "@/components/storefront/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { shortAddressLine } from "@/storefront/customer/address-normalization";
import { WIZARD_MESSAGES } from "@/storefront/customer/customer-wizard.errors";
import { isAddressStep, nextAddressStep, progressLabel } from "@/storefront/customer/customer-wizard.machine";
import { useCustomerWizard } from "@/storefront/customer/customer-wizard.context";
import type { AddressLabel, LocalSavedAddress } from "@/storefront/customer/customer-wizard.types";

export const WIZARD_PRIMARY = "min-h-[60px] w-full rounded-2xl bg-brand text-[17px] font-extrabold text-brand-foreground shadow-lg shadow-black/[.08] transition hover:bg-brand/90 active:scale-[.985]";
const SECONDARY = "min-h-[54px] w-full rounded-2xl text-base font-bold transition active:scale-[.985]";
export const WIZARD_FIELD = "mt-2 min-h-[58px] rounded-2xl !border-[var(--wizard-field-border)] !bg-[var(--wizard-field-bg)] px-4 text-[18px] !text-[var(--wizard-field-fg)] shadow-sm placeholder:!text-[var(--wizard-field-placeholder)] focus-visible:!border-brand focus-visible:!ring-brand/25";
const SELECT_CARD = "flex min-h-[88px] w-full items-center gap-4 rounded-3xl border border-foreground/[.08] bg-card/92 p-4 text-left text-card-foreground shadow-md shadow-black/[.05] transition hover:-translate-y-0.5 hover:border-brand/35 hover:shadow-lg active:translate-y-0 active:scale-[.99] focus-visible:ring-2 focus-visible:ring-brand";

export function WizardStepShell({ title, description, children, footer, progress, onBack, icon }: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer: React.ReactNode;
  progress?: string | null;
  onBack?: () => void;
  icon?: React.ReactNode;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, [title]);

  return (
    <main className="min-h-svh text-foreground" aria-labelledby="wizard-title">
      <div className="mx-auto w-full max-w-xl px-5 pb-44 pt-5 sm:px-7 sm:pt-7">
        <div className="mb-7 flex min-h-10 items-center justify-between gap-3">
          {onBack ? (
            <Button
              variant="ghost"
              className="min-h-10 rounded-full border border-foreground/[.07] bg-card/82 px-4 text-sm font-extrabold text-card-foreground shadow-sm backdrop-blur-md"
              onClick={onBack}
            >
              ← Voltar
            </Button>
          ) : <span />}
          {progress ? (
            <span className="rounded-full border border-foreground/[.07] bg-card/82 px-3 py-2 text-[11px] font-black uppercase tracking-[.12em] text-card-foreground/70 shadow-sm backdrop-blur-md">
              {progress}
            </span>
          ) : null}
        </div>

        <section className="pb-4">
          {icon ? (
            <div className="mb-4 grid size-12 place-items-center rounded-2xl border border-brand/15 bg-card/88 text-brand shadow-sm backdrop-blur-md">
              {icon}
            </div>
          ) : null}
          <h1
            id="wizard-title"
            ref={headingRef}
            tabIndex={-1}
            className="max-w-[15ch] text-[32px] font-black leading-[1.02] tracking-[-.035em] outline-none drop-shadow-[0_1px_0_rgba(255,255,255,.12)] sm:text-[40px]"
          >
            {title}
          </h1>
          {description ? (
            <p className="mt-3 max-w-[42ch] text-[16px] font-medium leading-[1.65] text-muted-foreground sm:text-[17px]">
              {description}
            </p>
          ) : null}
          <div className="mt-7">{children}</div>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-background via-background/95 to-transparent px-4 pb-[max(.65rem,env(safe-area-inset-bottom))] pt-9">
        <div className="mx-auto w-full max-w-xl">
          {footer}
          <a
            href="/criar-loja"
            className="mx-auto mt-2.5 block w-fit rounded-full px-3 py-1 text-center text-[11px] font-bold text-muted-foreground transition hover:bg-card/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
          >
            Tem uma loja? Crie seu cardápio no Comandiva →
          </a>
        </div>
      </div>
    </main>
  );
}

function NoticeStack({ wizard, error }: { wizard: ReturnType<typeof useCustomerWizard>; error: string | null }) {
  return <>
    {!wizard.storageAvailable ? <p className="mb-4 rounded-2xl border border-foreground/[.08] bg-card/90 p-4 text-sm text-card-foreground shadow-sm">{WIZARD_MESSAGES.storageUnavailable}</p> : null}
    {wizard.configuration && !wizard.configuration.storeIsOpen ? <p className="mb-4 rounded-2xl border border-foreground/[.08] bg-card/90 p-4 text-sm text-card-foreground shadow-sm">{WIZARD_MESSAGES.storeClosed}</p> : null}
    {wizard.notice ? <p role="alert" className="mb-4 rounded-2xl border border-warning/25 bg-warning-soft/90 p-4 text-sm text-warning-foreground shadow-sm">{wizard.notice}</p> : null}
    {error ? <p role="alert" className="mb-4 rounded-2xl border border-destructive/30 bg-card/95 p-4 text-sm font-semibold text-destructive shadow-sm">{error}</p> : null}
  </>;
}

function AddressSummary({ address, areaName }: { address: LocalSavedAddress; areaName: string }) {
  return (
    <div className="rounded-3xl border border-foreground/[.08] bg-card/92 p-5 text-card-foreground shadow-md shadow-black/[.05]">
      <p className="text-lg font-extrabold">{address.customLabel ?? address.label}</p>
      <p className="mt-2 text-base leading-relaxed">{shortAddressLine(address)}</p>
      <p className="mt-1 text-sm text-muted-foreground">{areaName}</p>
      {address.complement ? <p className="mt-2 text-sm">Complemento: {address.complement}</p> : null}
      {address.referencePoint ? <p className="mt-1 text-sm">Referência: {address.referencePoint}</p> : null}
    </div>
  );
}

export function CustomerWizard() {
  const wizard = useCustomerWizard();
  const { configuration, configurationError, draft, profile, selectedAddress, session, step, busy } = wizard;
  const [error, setError] = useState<string | null>(null);
  const [nameValue, setNameValue] = useState("");
  const [areaTerm, setAreaTerm] = useState("");

  useEffect(() => { setError(null); }, [step]);
  const areas = configuration?.deliveryAreas ?? [];
  const filteredAreas = useMemo(() => {
    const needle = areaTerm.trim().toLocaleLowerCase("pt-BR");
    return needle ? areas.filter((area) => area.name.toLocaleLowerCase("pt-BR").includes(needle)) : areas;
  }, [areaTerm, areas]);
  const progress = progressLabel(step);
  const back = () => wizard.goBack();
  const notices = <NoticeStack wizard={wizard} error={error} />;

  if (step === "loading_store") return <div className="grid min-h-svh place-items-center px-6 text-center"><div className="space-y-4 rounded-3xl bg-card/90 p-6 text-card-foreground shadow-lg backdrop-blur-md"><div className="mx-auto size-12 animate-pulse rounded-2xl bg-brand/15" /><p className="text-lg font-bold">Preparando o cardápio…</p><p className="text-sm text-muted-foreground">Só um instante.</p></div></div>;
  if (step === "error") return <div className="grid min-h-svh place-items-center px-5"><div className="w-full max-w-md rounded-3xl border border-foreground/[.08] bg-card/95 p-6 text-center text-card-foreground shadow-lg"><p className="text-lg font-bold">{configurationError ?? WIZARD_MESSAGES.fulfillmentLoadFailed}</p><Button className={`mt-5 ${WIZARD_PRIMARY}`} onClick={wizard.reloadConfiguration}>Tentar novamente</Button></div></div>;

  if (step === "read_only") return <WizardStepShell title="Cardápio disponível para consulta" description={WIZARD_MESSAGES.noFulfillment} footer={<Button className={WIZARD_PRIMARY} disabled>Somente consulta</Button>}>{notices}</WizardStepShell>;

  if (step === "confirm_saved_name") return (
    <WizardStepShell title={`Oi, ${profile.firstName}! 👋`} description="Encontramos seus dados salvos neste aparelho. É você mesmo?" progress={progress} icon={<UserRound className="size-6" />} footer={<div className="grid gap-2"><Button className={WIZARD_PRIMARY} onClick={wizard.keepSavedName}>Sim, sou eu</Button><Button variant="outline" className={`${SECONDARY} bg-card/90 text-card-foreground`} onClick={wizard.requestNameChange}>Usar outro nome</Button></div>}>
      {notices}
      <p className="rounded-2xl border border-foreground/[.08] bg-card/88 p-4 text-sm leading-relaxed text-card-foreground/75 shadow-sm">Seus dados ficam somente neste aparelho para facilitar seu próximo pedido.</p>
      <Button variant="ghost" className="mt-3 min-h-12 w-full rounded-xl" onClick={wizard.forgetLocalData}>Apagar dados salvos</Button>
    </WizardStepShell>
  );

  if (step === "identify_customer") return (
    <WizardStepShell title="Como podemos chamar você?" description="Precisamos apenas do seu primeiro nome para continuar. Não é necessário criar conta nem senha." progress={progress} footer={<Button className={WIZARD_PRIMARY} onClick={() => setError(wizard.submitName(nameValue || profile.firstName || ""))}>Continuar</Button>}>
      {notices}
      <Label htmlFor="primeiro-nome" className="text-base font-extrabold">Seu primeiro nome</Label>
      <Input id="primeiro-nome" autoFocus className={WIZARD_FIELD} autoComplete="given-name" maxLength={60} defaultValue={profile.firstName ?? ""} placeholder="Ex.: Maria" onChange={(event) => setNameValue(event.target.value)} />
      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-foreground/[.08] bg-card/82 p-4 text-card-foreground shadow-sm backdrop-blur-sm">
        <span className="mt-0.5 size-2.5 shrink-0 rounded-full bg-brand" />
        <p className="text-sm font-medium leading-relaxed text-card-foreground/70">Seus dados ficam neste aparelho. Não pedimos CPF, e-mail ou senha para entrar no cardápio.</p>
      </div>
    </WizardStepShell>
  );

  if (step === "choose_fulfillment") {
    const only = configuration!.deliveryEnabled && !configuration!.pickupEnabled ? "entrega" : !configuration!.deliveryEnabled && configuration!.pickupEnabled ? "retirada" : null;
    return (
      <WizardStepShell title="Como você quer receber?" description="Escolha a opção mais conveniente para este pedido." progress={progress} onBack={back} footer={<p className="pb-1 text-center text-sm font-semibold text-muted-foreground">Escolha uma das opções acima.</p>}>
        {notices}
        <div className="grid gap-3">
          {configuration!.deliveryEnabled ? <button type="button" className={SELECT_CARD} onClick={() => wizard.chooseFulfillment("entrega")}><span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand"><Bike className="size-7" /></span><span className="min-w-0 flex-1"><span className="block text-xl font-black">{only === "entrega" ? "Continuar com entrega" : "Quero receber em casa"}</span><span className="mt-1 block text-sm leading-relaxed text-muted-foreground">Informe o endereço e veja a taxa.</span>{profile.lastFulfillmentPreference === "entrega" ? <Badge className="mt-2" variant="secondary">Usado da última vez</Badge> : null}</span><ChevronRight className="size-5 shrink-0 text-muted-foreground" /></button> : null}
          {configuration!.pickupEnabled ? <button type="button" className={SELECT_CARD} onClick={() => wizard.chooseFulfillment("retirada")}><span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand"><Store className="size-7" /></span><span className="min-w-0 flex-1"><span className="block text-xl font-black">{only === "retirada" ? "Continuar com retirada" : "Vou buscar na loja"}</span><span className="mt-1 block text-sm leading-relaxed text-muted-foreground">Sem taxa de entrega · preparo em ~{configuration!.defaultPreparationMinutes} min.</span>{profile.lastFulfillmentPreference === "retirada" ? <Badge className="mt-2" variant="secondary">Usado da última vez</Badge> : null}</span><ChevronRight className="size-5 shrink-0 text-muted-foreground" /></button> : null}
        </div>
      </WizardStepShell>
    );
  }

  if (step === "choose_saved_address") {
    const mostRecent = [...profile.savedAddresses].sort((a,b) => String(b.lastUsedAt ?? b.updatedAt).localeCompare(String(a.lastUsedAt ?? a.updatedAt)))[0];
    return (
      <WizardStepShell title="Onde vamos entregar?" description="Escolha um endereço salvo ou cadastre outro." progress={progress} onBack={back} footer={<Button className={WIZARD_PRIMARY} onClick={wizard.startNewAddress}>+ Cadastrar outro endereço</Button>}>
        {notices}
        <div className="space-y-3">
          {profile.savedAddresses.map((address) => {
            const area = areas.find((a) => a.id === address.neighborhoodId);
            return <div key={address.localId} className="rounded-3xl border border-foreground/[.08] bg-card/92 p-4 text-card-foreground shadow-md shadow-black/[.05]"><button type="button" className="flex min-h-[72px] w-full items-start gap-3 text-left" aria-pressed={session.selectedAddressLocalId === address.localId} onClick={() => wizard.selectSavedAddress(address.localId)}><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand"><MapPin className="size-5" /></span><span className="min-w-0 flex-1"><span className="font-extrabold">{address.customLabel ?? address.label}</span>{mostRecent?.localId === address.localId ? <Badge className="ml-2" variant="secondary">Mais recente</Badge> : null}<span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{shortAddressLine(address)} · {area?.name ?? address.neighborhoodNameSnapshot}</span>{!area ? <span className="mt-1 block text-sm text-destructive">{WIZARD_MESSAGES.areaUnavailable}</span> : null}</span><ChevronRight className="mt-2 size-5 text-muted-foreground" /></button><div className="mt-2 flex gap-2 border-t border-foreground/[.08] pt-3"><Button variant="outline" className="min-h-11 flex-1 rounded-xl" onClick={() => wizard.editAddress(address.localId)}>Editar</Button><Button variant="ghost" className="min-h-11 rounded-xl" onClick={() => wizard.deleteAddress(address.localId)}><Trash2 className="size-4" /> Excluir</Button></div></div>;
          })}
        </div>
      </WizardStepShell>
    );
  }

  if (isAddressStep(step) && step !== "confirm_address") {
    const advance = () => wizard.setStep(nextAddressStep(step));

    if (step === "address_neighborhood") return (
      <WizardStepShell title="Qual é o seu bairro?" description="Escolha o bairro da entrega. A taxa aparece junto para não ter surpresa." progress={progress} onBack={back} icon={<MapPin className="size-6" />} footer={<Button className={WIZARD_PRIMARY} disabled={!draft.neighborhoodId} onClick={advance}>Continuar</Button>}>
        {notices}
        {areas.length > 6 ? <div className="relative"><Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" /><Input className={`${WIZARD_FIELD} mt-0 pl-12`} value={areaTerm} onChange={(event) => setAreaTerm(event.target.value)} placeholder="Digite seu bairro" /></div> : null}
        <div className="mt-4 space-y-2">{filteredAreas.map((area) => <button key={area.id} type="button" aria-pressed={draft.neighborhoodId === area.id} onClick={() => wizard.updateDraft({ neighborhoodId: area.id, neighborhoodNameSnapshot: area.name })} className={`flex min-h-[68px] w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-card-foreground shadow-sm transition ${draft.neighborhoodId === area.id ? "border-brand bg-card ring-2 ring-brand/15" : "border-foreground/[.08] bg-card/90"}`}><span className="font-extrabold">{area.name}</span><span className="text-right text-sm text-muted-foreground">{brl(area.deliveryFee)}<br /><span className="text-xs">mín. {brl(area.minimumOrderAmount)}</span></span></button>)}</div>
        {filteredAreas.length === 0 ? <p className="mt-4 rounded-2xl bg-card/90 p-4 text-sm text-card-foreground">Não encontramos esse bairro na área de entrega da loja.</p> : null}
        {configuration!.pickupEnabled ? <Button variant="ghost" className={`mt-4 ${SECONDARY}`} onClick={() => wizard.chooseFulfillment("retirada")}>Prefiro retirar na loja</Button> : null}
      </WizardStepShell>
    );

    if (step === "address_street") return <WizardStepShell title="Qual é a sua rua?" description="Pode ser rua, avenida, praça ou estrada." progress={progress} onBack={back} footer={<Button className={WIZARD_PRIMARY} disabled={draft.street.trim().length < 3} onClick={advance}>Continuar</Button>}><Label htmlFor="rua" className="text-lg font-extrabold">Rua ou avenida</Label><Input id="rua" autoFocus className={WIZARD_FIELD} maxLength={120} value={draft.street} placeholder="Ex.: Rua das Flores" onChange={(event) => wizard.updateDraft({ street: event.target.value })} /></WizardStepShell>;

    if (step === "address_number") return <WizardStepShell title="Qual é o número?" description="Se o local não tiver número, marque a opção abaixo." progress={progress} onBack={back} footer={<Button className={WIZARD_PRIMARY} disabled={!draft.hasNoNumber && draft.number.trim().length === 0} onClick={advance}>Continuar</Button>}><Label htmlFor="numero" className="text-lg font-extrabold">Número</Label><Input id="numero" autoFocus inputMode="numeric" className={WIZARD_FIELD} maxLength={20} disabled={draft.hasNoNumber} value={draft.number} placeholder="Ex.: 125" onChange={(event) => wizard.updateDraft({ number: event.target.value })} /><label className="mt-4 flex min-h-[58px] cursor-pointer items-center gap-3 rounded-2xl border border-foreground/[.08] bg-card/88 p-4 text-card-foreground shadow-sm"><Checkbox checked={draft.hasNoNumber} onCheckedChange={(checked) => wizard.updateDraft({ hasNoNumber: checked === true })} /><span className="text-base font-bold">Este endereço não tem número</span></label></WizardStepShell>;

    if (step === "address_complement") return <WizardStepShell title="Tem complemento?" description="Apartamento, bloco, fundos ou portão. Se não tiver, é só continuar." progress={progress} onBack={back} footer={<Button className={WIZARD_PRIMARY} onClick={advance}>Continuar</Button>}><Label htmlFor="complemento" className="text-lg font-extrabold">Complemento <span className="font-normal text-muted-foreground">(opcional)</span></Label><Input id="complemento" autoFocus className={WIZARD_FIELD} maxLength={100} value={draft.complement} placeholder="Ex.: Apto 12, bloco B" onChange={(event) => wizard.updateDraft({ complement: event.target.value })} /></WizardStepShell>;

    if (step === "address_reference") return <WizardStepShell title="Algum ponto de referência?" description="Isso ajuda muito o entregador, mas não é obrigatório." progress={progress} onBack={back} footer={<Button className={WIZARD_PRIMARY} onClick={advance}>Continuar</Button>}><Label htmlFor="referencia" className="text-lg font-extrabold">Referência <span className="font-normal text-muted-foreground">(opcional)</span></Label><Input id="referencia" autoFocus className={WIZARD_FIELD} maxLength={140} value={draft.referencePoint} placeholder="Ex.: Portão azul, perto da escola" onChange={(event) => wizard.updateDraft({ referencePoint: event.target.value })} /></WizardStepShell>;

    const duplicate = wizard.duplicateOf(draft);
    return <WizardStepShell title="Salve este endereço" description="Escolha um nome fácil para encontrar da próxima vez." progress={progress} onBack={back} footer={<Button className={WIZARD_PRIMARY} onClick={() => setError(wizard.saveDraftAndReview())} disabled={draft.label === "Outro" && draft.customLabel.trim().length < 2}>Revisar endereço</Button>}>
      {notices}
      {duplicate ? <p className="mb-4 rounded-2xl border border-foreground/[.08] bg-card/90 p-4 text-sm text-card-foreground shadow-sm">Já existe um endereço igual salvo como <strong>{duplicate.customLabel ?? duplicate.label}</strong>.</p> : null}
      <div className="grid grid-cols-3 gap-2">{(["Casa","Trabalho","Outro"] as AddressLabel[]).map((option) => <button key={option} type="button" aria-pressed={draft.label === option} onClick={() => wizard.updateDraft({ label: option })} className={`min-h-[70px] rounded-2xl border px-2 font-extrabold shadow-sm transition ${draft.label === option ? "border-brand bg-card ring-2 ring-brand/15" : "border-foreground/[.08] bg-card/88 text-card-foreground"}`}>{option}</button>)}</div>
      {draft.label === "Outro" ? <div className="mt-4"><Label htmlFor="rotulo" className="text-lg font-extrabold">Nome do endereço</Label><Input id="rotulo" autoFocus className={WIZARD_FIELD} maxLength={30} value={draft.customLabel} placeholder="Ex.: Casa da vó" onChange={(event) => wizard.updateDraft({ customLabel: event.target.value })} /></div> : null}
    </WizardStepShell>;
  }

  if (step === "confirm_address") {
    const address = selectedAddress;
    const area = address ? areas.find((a) => a.id === address.neighborhoodId) : null;
    return <WizardStepShell title="Está tudo certo?" description="Confira o endereço antes de entrar no cardápio." onBack={back} icon={<Home className="size-6" />} footer={<Button className={WIZARD_PRIMARY} disabled={!address || !area || busy} onClick={() => void wizard.confirmAddress()}><Check className="mr-2 size-5" />{busy ? "Confirmando…" : "Sim, entrar no cardápio"}</Button>}>
      {notices}
      {address ? <><AddressSummary address={address} areaName={area?.name ?? address.neighborhoodNameSnapshot} />{area ? <div className="mt-4 rounded-2xl border border-brand/15 bg-card/90 p-4 text-sm text-card-foreground shadow-sm"><strong className="text-brand">Taxa de entrega: {brl(area.deliveryFee)}</strong><br /><span className="text-muted-foreground">Pedido mínimo {brl(area.minimumOrderAmount)}{area.estimatedMinutes ? ` · cerca de ${area.estimatedMinutes} min` : ""}</span></div> : <p className="mt-3 text-sm text-destructive">{WIZARD_MESSAGES.areaUnavailable}</p>}</> : null}
      <div className="mt-4 grid gap-2"><Button variant="outline" className={`${SECONDARY} bg-card/90`} onClick={() => address && wizard.editAddress(address.localId)}>Corrigir endereço</Button>{profile.savedAddresses.length > 1 ? <Button variant="ghost" className={SECONDARY} onClick={() => wizard.setStep("choose_saved_address")}>Escolher outro endereço</Button> : null}</div>
    </WizardStepShell>;
  }

  if (step === "confirm_pickup") return <WizardStepShell title="Retirar na loja?" description={`${configuration!.storeName} · preparo em cerca de ${configuration!.defaultPreparationMinutes} min.`} progress={progress} onBack={back} icon={<Store className="size-6" />} footer={<Button className={WIZARD_PRIMARY} disabled={busy} onClick={() => void wizard.confirmPickup()}>{busy ? "Confirmando…" : "Sim, entrar no cardápio"}</Button>}>
    {notices}
    <div className="rounded-3xl border border-foreground/[.08] bg-card/90 p-5 text-card-foreground shadow-md"><p className="text-lg font-extrabold">{configuration!.storeName}</p><p className="mt-2 text-sm text-muted-foreground">Você faz o pedido agora e busca no estabelecimento quando estiver pronto.</p></div>
    {configuration!.deliveryEnabled ? <Button variant="outline" className={`mt-4 ${SECONDARY} bg-card/90`} onClick={() => wizard.chooseFulfillment("entrega")}>Prefiro entrega</Button> : null}
  </WizardStepShell>;

  return null;
}