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

const PRIMARY = "min-h-[62px] w-full rounded-2xl text-[17px] font-extrabold shadow-sm transition active:scale-[.985]";
const SECONDARY = "min-h-[56px] w-full rounded-2xl text-base font-bold transition active:scale-[.985]";
const FIELD = "mt-2 min-h-[58px] rounded-2xl px-4 text-[18px]";
const SELECT_CARD = "flex min-h-[88px] w-full items-center gap-4 rounded-3xl border bg-background p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand/35 hover:shadow-md active:translate-y-0 active:scale-[.99] focus-visible:ring-2 focus-visible:ring-brand";

function StepShell({ title, description, children, footer, progress, onBack, icon }: {
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
    <main className="min-h-svh bg-[radial-gradient(circle_at_top,hsl(var(--brand)/.10),transparent_36%),hsl(var(--background))]" aria-labelledby="wizard-title">
      <div className="mx-auto w-full max-w-xl px-4 pb-36 pt-5 sm:px-6 sm:pt-8">
        <div className="mb-6 flex items-center justify-between">
          {onBack ? <Button variant="ghost" className="min-h-12 rounded-2xl px-4 text-base font-bold" onClick={onBack}>← Voltar</Button> : <span />}
          {progress ? <span className="rounded-full border bg-background/80 px-3 py-1.5 text-xs font-black uppercase tracking-[.12em] text-muted-foreground shadow-sm">{progress}</span> : null}
        </div>

        <section className="rounded-[32px] border bg-background/95 p-5 shadow-lg shadow-black/[.04] backdrop-blur sm:p-7">
          {icon ? <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-brand/10 text-brand">{icon}</div> : null}
          <h1 id="wizard-title" ref={headingRef} tabIndex={-1} className="text-[30px] font-black leading-[1.05] tracking-tight outline-none sm:text-4xl">{title}</h1>
          {description ? <p className="mt-3 text-[17px] leading-relaxed text-muted-foreground">{description}</p> : null}
          <div className="mt-6">{children}</div>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
        <div className="mx-auto w-full max-w-xl">{footer}</div>
      </div>
    </main>
  );
}

function NoticeStack({ wizard, error }: { wizard: ReturnType<typeof useCustomerWizard>; error: string | null }) {
  return <>
    {!wizard.storageAvailable ? <p className="mb-4 rounded-2xl border bg-muted/30 p-4 text-sm">{WIZARD_MESSAGES.storageUnavailable}</p> : null}
    {wizard.configuration && !wizard.configuration.storeIsOpen ? <p className="mb-4 rounded-2xl border bg-muted/30 p-4 text-sm">{WIZARD_MESSAGES.storeClosed}</p> : null}
    {wizard.notice ? <p role="alert" className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/[.07] p-4 text-sm">{wizard.notice}</p> : null}
    {error ? <p role="alert" className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm font-semibold text-destructive">{error}</p> : null}
  </>;
}

function AddressSummary({ address, areaName }: { address: LocalSavedAddress; areaName: string }) {
  return (
    <div className="rounded-3xl border bg-muted/25 p-5">
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

  if (step === "loading_store") return <div className="grid min-h-svh place-items-center bg-background px-6 text-center"><div className="space-y-4"><div className="mx-auto size-12 animate-pulse rounded-2xl bg-brand/15" /><p className="text-lg font-bold">Preparando o cardápio…</p><p className="text-sm text-muted-foreground">Só um instante.</p></div></div>;
  if (step === "error") return <div className="grid min-h-svh place-items-center px-5"><div className="w-full max-w-md rounded-3xl border bg-background p-6 text-center shadow-lg"><p className="text-lg font-bold">{configurationError ?? WIZARD_MESSAGES.fulfillmentLoadFailed}</p><Button className={`mt-5 ${PRIMARY}`} onClick={wizard.reloadConfiguration}>Tentar novamente</Button></div></div>;

  if (step === "read_only") return <StepShell title="Cardápio disponível para consulta" description={WIZARD_MESSAGES.noFulfillment} footer={<Button className={PRIMARY} disabled>Somente consulta</Button>}>{notices}</StepShell>;

  if (step === "confirm_saved_name") return (
    <StepShell title={`Oi, ${profile.firstName}! 👋`} description="Encontramos seus dados salvos neste aparelho. É você mesmo?" progress={progress} icon={<UserRound className="size-7" />} footer={<div className="grid gap-2"><Button className={PRIMARY} onClick={wizard.keepSavedName}>Sim, sou eu</Button><Button variant="outline" className={SECONDARY} onClick={wizard.requestNameChange}>Usar outro nome</Button></div>}>
      {notices}
      <p className="rounded-2xl bg-muted/35 p-4 text-sm leading-relaxed text-muted-foreground">Seus dados ficam somente neste aparelho para facilitar seu próximo pedido.</p>
      <Button variant="ghost" className="mt-3 min-h-12 w-full rounded-xl" onClick={wizard.forgetLocalData}>Apagar dados salvos</Button>
    </StepShell>
  );

  if (step === "identify_customer") return (
    <StepShell title="Qual é o seu nome?" description="Digite só como a loja deve chamar você. É rápido e não precisa criar conta." progress={progress} icon={<UserRound className="size-7" />} footer={<Button className={PRIMARY} onClick={() => setError(wizard.submitName(nameValue || profile.firstName || ""))}>Continuar</Button>}>
      {notices}
      <Label htmlFor="primeiro-nome" className="text-lg font-extrabold">Seu primeiro nome</Label>
      <Input id="primeiro-nome" autoFocus className={FIELD} autoComplete="given-name" maxLength={60} defaultValue={profile.firstName ?? ""} placeholder="Ex.: Maria" onChange={(event) => setNameValue(event.target.value)} />
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Não pedimos CPF, e-mail ou senha para entrar no cardápio.</p>
    </StepShell>
  );

  if (step === "choose_fulfillment") {
    const only = configuration!.deliveryEnabled && !configuration!.pickupEnabled ? "entrega" : !configuration!.deliveryEnabled && configuration!.pickupEnabled ? "retirada" : null;
    return (
      <StepShell title="Como você quer receber?" description="Toque em uma opção para continuar." progress={progress} onBack={back} footer={<p className="text-center text-sm text-muted-foreground">Escolha uma das opções acima.</p>}>
        {notices}
        <div className="grid gap-3">
          {configuration!.deliveryEnabled ? <button type="button" className={SELECT_CARD} onClick={() => wizard.chooseFulfillment("entrega")}><span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand"><Bike className="size-7" /></span><span className="min-w-0 flex-1"><span className="block text-xl font-black">{only === "entrega" ? "Continuar com entrega" : "Quero receber em casa"}</span><span className="mt-1 block text-sm leading-relaxed text-muted-foreground">Informe o endereço e veja a taxa.</span>{profile.lastFulfillmentPreference === "entrega" ? <Badge className="mt-2" variant="secondary">Usado da última vez</Badge> : null}</span><ChevronRight className="size-5 shrink-0 text-muted-foreground" /></button> : null}
          {configuration!.pickupEnabled ? <button type="button" className={SELECT_CARD} onClick={() => wizard.chooseFulfillment("retirada")}><span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand"><Store className="size-7" /></span><span className="min-w-0 flex-1"><span className="block text-xl font-black">{only === "retirada" ? "Continuar com retirada" : "Vou buscar na loja"}</span><span className="mt-1 block text-sm leading-relaxed text-muted-foreground">Sem taxa de entrega · preparo em ~{configuration!.defaultPreparationMinutes} min.</span>{profile.lastFulfillmentPreference === "retirada" ? <Badge className="mt-2" variant="secondary">Usado da última vez</Badge> : null}</span><ChevronRight className="size-5 shrink-0 text-muted-foreground" /></button> : null}
        </div>
      </StepShell>
    );
  }

  if (step === "choose_saved_address") {
    const mostRecent = [...profile.savedAddresses].sort((a,b) => String(b.lastUsedAt ?? b.updatedAt).localeCompare(String(a.lastUsedAt ?? a.updatedAt)))[0];
    return (
      <StepShell title="Onde vamos entregar?" description="Escolha um endereço salvo ou cadastre outro." progress={progress} onBack={back} footer={<Button className={PRIMARY} onClick={wizard.startNewAddress}>+ Cadastrar outro endereço</Button>}>
        {notices}
        <div className="space-y-3">
          {profile.savedAddresses.map((address) => {
            const area = areas.find((a) => a.id === address.neighborhoodId);
            return <div key={address.localId} className="rounded-3xl border bg-background p-4 shadow-sm"><button type="button" className="flex min-h-[72px] w-full items-start gap-3 text-left" aria-pressed={session.selectedAddressLocalId === address.localId} onClick={() => wizard.selectSavedAddress(address.localId)}><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand"><MapPin className="size-5" /></span><span className="min-w-0 flex-1"><span className="font-extrabold">{address.customLabel ?? address.label}</span>{mostRecent?.localId === address.localId ? <Badge className="ml-2" variant="secondary">Mais recente</Badge> : null}<span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{shortAddressLine(address)} · {area?.name ?? address.neighborhoodNameSnapshot}</span>{!area ? <span className="mt-1 block text-sm text-destructive">{WIZARD_MESSAGES.areaUnavailable}</span> : null}</span><ChevronRight className="mt-2 size-5 text-muted-foreground" /></button><div className="mt-2 flex gap-2 border-t pt-3"><Button variant="outline" className="min-h-11 flex-1 rounded-xl" onClick={() => wizard.editAddress(address.localId)}>Editar</Button><Button variant="ghost" className="min-h-11 rounded-xl" onClick={() => wizard.deleteAddress(address.localId)}><Trash2 className="size-4" /> Excluir</Button></div></div>;
          })}
        </div>
      </StepShell>
    );
  }

  if (isAddressStep(step) && step !== "confirm_address") {
    const advance = () => wizard.setStep(nextAddressStep(step));

    if (step === "address_neighborhood") return (
      <StepShell title="Qual é o seu bairro?" description="Escolha o bairro da entrega. A taxa aparece junto para não ter surpresa." progress={progress} onBack={back} icon={<MapPin className="size-7" />} footer={<Button className={PRIMARY} disabled={!draft.neighborhoodId} onClick={advance}>Continuar</Button>}>
        {notices}
        {areas.length > 6 ? <div className="relative"><Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" /><Input className="min-h-[58px] rounded-2xl pl-12 text-lg" value={areaTerm} onChange={(event) => setAreaTerm(event.target.value)} placeholder="Digite seu bairro" /></div> : null}
        <div className="mt-4 space-y-2">{filteredAreas.map((area) => <button key={area.id} type="button" aria-pressed={draft.neighborhoodId === area.id} onClick={() => wizard.updateDraft({ neighborhoodId: area.id, neighborhoodNameSnapshot: area.name })} className={`flex min-h-[68px] w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${draft.neighborhoodId === area.id ? "border-brand bg-brand/5 ring-2 ring-brand/15" : "bg-background"}`}><span className="font-extrabold">{area.name}</span><span className="text-right text-sm text-muted-foreground">{brl(area.deliveryFee)}<br /><span className="text-xs">mín. {brl(area.minimumOrderAmount)}</span></span></button>)}</div>
        {filteredAreas.length === 0 ? <p className="mt-4 rounded-2xl bg-muted p-4 text-sm">Não encontramos esse bairro na área de entrega da loja.</p> : null}
        {configuration!.pickupEnabled ? <Button variant="ghost" className={`mt-4 ${SECONDARY}`} onClick={() => wizard.chooseFulfillment("retirada")}>Prefiro retirar na loja</Button> : null}
      </StepShell>
    );

    if (step === "address_street") return <StepShell title="Qual é a sua rua?" description="Pode ser rua, avenida, praça ou estrada." progress={progress} onBack={back} footer={<Button className={PRIMARY} disabled={draft.street.trim().length < 3} onClick={advance}>Continuar</Button>}><Label htmlFor="rua" className="text-lg font-extrabold">Rua ou avenida</Label><Input id="rua" autoFocus className={FIELD} maxLength={120} value={draft.street} placeholder="Ex.: Rua das Flores" onChange={(event) => wizard.updateDraft({ street: event.target.value })} /></StepShell>;

    if (step === "address_number") return <StepShell title="Qual é o número?" description="Se o local não tiver número, marque a opção abaixo." progress={progress} onBack={back} footer={<Button className={PRIMARY} disabled={!draft.hasNoNumber && draft.number.trim().length === 0} onClick={advance}>Continuar</Button>}><Label htmlFor="numero" className="text-lg font-extrabold">Número</Label><Input id="numero" autoFocus inputMode="numeric" className={FIELD} maxLength={20} disabled={draft.hasNoNumber} value={draft.number} placeholder="Ex.: 125" onChange={(event) => wizard.updateDraft({ number: event.target.value })} /><label className="mt-4 flex min-h-[58px] cursor-pointer items-center gap-3 rounded-2xl border p-4"><Checkbox checked={draft.hasNoNumber} onCheckedChange={(checked) => wizard.updateDraft({ hasNoNumber: checked === true })} /><span className="text-base font-bold">Este endereço não tem número</span></label></StepShell>;

    if (step === "address_complement") return <StepShell title="Tem complemento?" description="Apartamento, bloco, fundos ou portão. Se não tiver, é só continuar." progress={progress} onBack={back} footer={<Button className={PRIMARY} onClick={advance}>Continuar</Button>}><Label htmlFor="complemento" className="text-lg font-extrabold">Complemento <span className="font-normal text-muted-foreground">(opcional)</span></Label><Input id="complemento" autoFocus className={FIELD} maxLength={100} value={draft.complement} placeholder="Ex.: Apto 12, bloco B" onChange={(event) => wizard.updateDraft({ complement: event.target.value })} /></StepShell>;

    if (step === "address_reference") return <StepShell title="Algum ponto de referência?" description="Isso ajuda muito o entregador, mas não é obrigatório." progress={progress} onBack={back} footer={<Button className={PRIMARY} onClick={advance}>Continuar</Button>}><Label htmlFor="referencia" className="text-lg font-extrabold">Referência <span className="font-normal text-muted-foreground">(opcional)</span></Label><Input id="referencia" autoFocus className={FIELD} maxLength={140} value={draft.referencePoint} placeholder="Ex.: Portão azul, perto da escola" onChange={(event) => wizard.updateDraft({ referencePoint: event.target.value })} /></StepShell>;

    const duplicate = wizard.duplicateOf(draft);
    return <StepShell title="Salve este endereço" description="Escolha um nome fácil para encontrar da próxima vez." progress={progress} onBack={back} footer={<Button className={PRIMARY} onClick={() => setError(wizard.saveDraftAndReview())} disabled={draft.label === "Outro" && draft.customLabel.trim().length < 2}>Revisar endereço</Button>}>
      {notices}
      {duplicate ? <p className="mb-4 rounded-2xl border bg-muted/30 p-4 text-sm">Já existe um endereço igual salvo como <strong>{duplicate.customLabel ?? duplicate.label}</strong>.</p> : null}
      <div className="grid grid-cols-3 gap-2">{(["Casa","Trabalho","Outro"] as AddressLabel[]).map((option) => <button key={option} type="button" aria-pressed={draft.label === option} onClick={() => wizard.updateDraft({ label: option })} className={`min-h-[70px] rounded-2xl border px-2 font-extrabold transition ${draft.label === option ? "border-brand bg-brand/5 ring-2 ring-brand/15" : ""}`}>{option}</button>)}</div>
      {draft.label === "Outro" ? <div className="mt-4"><Label htmlFor="rotulo" className="text-lg font-extrabold">Nome do endereço</Label><Input id="rotulo" autoFocus className={FIELD} maxLength={30} value={draft.customLabel} placeholder="Ex.: Casa da vó" onChange={(event) => wizard.updateDraft({ customLabel: event.target.value })} /></div> : null}
    </StepShell>;
  }

  if (step === "confirm_address") {
    const address = selectedAddress;
    const area = address ? areas.find((a) => a.id === address.neighborhoodId) : null;
    return <StepShell title="Está tudo certo?" description="Confira o endereço antes de entrar no cardápio." onBack={back} icon={<Home className="size-7" />} footer={<Button className={PRIMARY} disabled={!address || !area || busy} onClick={() => void wizard.confirmAddress()}><Check className="mr-2 size-5" />{busy ? "Confirmando…" : "Sim, entrar no cardápio"}</Button>}>
      {notices}
      {address ? <><AddressSummary address={address} areaName={area?.name ?? address.neighborhoodNameSnapshot} />{area ? <div className="mt-4 rounded-2xl bg-brand/5 p-4 text-sm"><strong>Taxa de entrega: {brl(area.deliveryFee)}</strong><br /><span className="text-muted-foreground">Pedido mínimo {brl(area.minimumOrderAmount)}{area.estimatedMinutes ? ` · cerca de ${area.estimatedMinutes} min` : ""}</span></div> : <p className="mt-3 text-sm text-destructive">{WIZARD_MESSAGES.areaUnavailable}</p>}</> : null}
      <div className="mt-4 grid gap-2"><Button variant="outline" className={SECONDARY} onClick={() => address && wizard.editAddress(address.localId)}>Corrigir endereço</Button>{profile.savedAddresses.length > 1 ? <Button variant="ghost" className={SECONDARY} onClick={() => wizard.setStep("choose_saved_address")}>Escolher outro endereço</Button> : null}</div>
    </StepShell>;
  }

  if (step === "confirm_pickup") return <StepShell title="Retirar na loja?" description={`${configuration!.storeName} · preparo em cerca de ${configuration!.defaultPreparationMinutes} min.`} progress={progress} onBack={back} icon={<Store className="size-7" />} footer={<Button className={PRIMARY} disabled={busy} onClick={() => void wizard.confirmPickup()}>{busy ? "Confirmando…" : "Sim, entrar no cardápio"}</Button>}>
    {notices}
    <div className="rounded-3xl border bg-muted/30 p-5"><p className="text-lg font-extrabold">{configuration!.storeName}</p><p className="mt-2 text-sm text-muted-foreground">Você faz o pedido agora e busca no estabelecimento quando estiver pronto.</p></div>
    {configuration!.deliveryEnabled ? <Button variant="outline" className={`mt-4 ${SECONDARY}`} onClick={() => wizard.chooseFulfillment("entrega")}>Prefiro entrega</Button> : null}
  </StepShell>;

  return null;
}
