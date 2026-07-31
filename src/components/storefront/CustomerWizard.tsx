/**
 * Wizard público do cliente (Fase 12).
 * Uma decisão por tela, mobile-first, sem conta e sem telefone.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Bike, Check, MapPin, Store, Trash2 } from "lucide-react";

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

const PRIMARY =
  "tappable h-13 min-h-[52px] w-full rounded-xl text-base shadow-e1 active:scale-[0.99]";
const FIELD = "mt-2 h-12 rounded-xl text-[16px]";

function StepShell({
  title,
  description,
  children,
  footer,
  progress,
  onBack,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer: React.ReactNode;
  progress?: string | null;
  onBack?: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, [title]);

  return (
    <section className="flex min-h-svh flex-col bg-background" aria-labelledby="wizard-title">
      <div className="mx-auto w-full max-w-md flex-1 px-5 pb-40 pt-8 sm:max-w-lg sm:px-6 sm:pt-12">
        {progress ? (
          <p
            className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-soft-foreground"
            aria-live="polite"
          >
            {progress}
          </p>
        ) : null}
        <h1
          id="wizard-title"
          ref={headingRef}
          tabIndex={-1}
          className="mt-3 text-[26px] font-semibold leading-tight sm:text-3xl tracking-tight outline-none rise-in"
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-2.5 text-base leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
        <div className="mt-7">{children}</div>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-border/70 glass-bar p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex w-full max-w-md gap-3 sm:max-w-lg">
          {onBack ? (
            <Button
              variant="outline"
              className="tappable h-13 min-h-[52px] rounded-xl active:scale-[0.98]"
              onClick={onBack}
            >
              Voltar
            </Button>
          ) : null}
          <div className="flex-1">{footer}</div>
        </div>
      </div>
    </section>

  );
}

function AddressSummary({ address, areaName }: { address: LocalSavedAddress; areaName: string }) {
  return (
    <dl className="panel space-y-2.5 p-5 text-base">
      <Row label="Identificação" value={address.customLabel ?? address.label} />
      <Row label="Endereço" value={shortAddressLine(address)} />
      <Row label="Bairro" value={areaName} />
      {address.complement ? <Row label="Complemento" value={address.complement} /> : null}
      {address.referencePoint ? <Row label="Referência" value={address.referencePoint} /> : null}
    </dl>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

export function CustomerWizard() {
  const wizard = useCustomerWizard();
  const {
    configuration,
    configurationError,
    draft,
    profile,
    selectedAddress,
    session,
    step,
    notice,
    busy,
  } = wizard;

  const [error, setError] = useState<string | null>(null);
  const [nameValue, setNameValue] = useState("");
  const [areaTerm, setAreaTerm] = useState("");

  useEffect(() => {
    setError(null);
  }, [step]);

  const areas = configuration?.deliveryAreas ?? [];
  const filteredAreas = useMemo(() => {
    const needle = areaTerm.trim().toLowerCase();
    return needle ? areas.filter((a) => a.name.toLowerCase().includes(needle)) : areas;
  }, [areaTerm, areas]);

  const draftArea = areas.find((a) => a.id === draft.neighborhoodId) ?? null;
  const progress = progressLabel(step);
  const back = () => wizard.goBack();

  if (step === "loading_store") {
    return (
      <div className="grid min-h-svh place-items-center px-6 text-center">
        <p className="text-sm text-muted-foreground">Carregando as opções de atendimento…</p>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="mx-auto grid min-h-svh max-w-md place-items-center px-6 text-center">
        <div>
          <p className="text-base">{configurationError ?? WIZARD_MESSAGES.fulfillmentLoadFailed}</p>
          <Button className="mt-5 min-h-[52px]" onClick={wizard.reloadConfiguration}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  const banner = (
    <>
      {!wizard.storageAvailable ? (
        <p className="mb-4 rounded-lg border border-border p-3 text-sm text-muted-foreground">
          {WIZARD_MESSAGES.storageUnavailable}
        </p>
      ) : null}
      {configuration && !configuration.storeIsOpen ? (
        <p className="mb-4 rounded-lg border border-border p-3 text-sm text-muted-foreground">
          {WIZARD_MESSAGES.storeClosed}
        </p>
      ) : null}
      {notice ? (
        <p role="alert" className="mb-4 rounded-lg border border-destructive/40 p-3 text-sm">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </>
  );

  if (step === "read_only") {
    return (
      <StepShell
        title="Cardápio disponível para consulta"
        description={WIZARD_MESSAGES.noFulfillment}
        footer={
          <Button className={PRIMARY} onClick={() => wizard.setStep("read_only")} disabled>
            Somente consulta
          </Button>
        }
      >
        {banner}
      </StepShell>
    );
  }

  if (step === "confirm_saved_name") {
    return (
      <StepShell
        title={`Olá, ${profile.firstName}. É você?`}
        description={WIZARD_MESSAGES.localOnly}
        progress={progress}
        footer={
          <div className="space-y-2">
            <Button className={PRIMARY} onClick={wizard.keepSavedName}>
              Sim, continuar
            </Button>
            <Button variant="outline" className={PRIMARY} onClick={wizard.requestNameChange}>
              Alterar nome
            </Button>
          </div>
        }
      >
        {banner}
        <Button variant="ghost" className="min-h-[52px] w-full" onClick={wizard.forgetLocalData}>
          Esquecer meus dados neste aparelho
        </Button>
      </StepShell>
    );
  }

  if (step === "identify_customer") {
    return (
      <StepShell
        title="Como podemos chamar você?"
        description="Só o primeiro nome. Não pedimos sobrenome, CPF, e-mail, telefone nem senha."
        progress={progress}
        footer={
          <Button
            className={PRIMARY}
            onClick={() => {
              const message = wizard.submitName(nameValue || profile.firstName || "");
              setError(message);
            }}
          >
            Continuar
          </Button>
        }
      >
        {banner}
        <Label htmlFor="primeiro-nome" className="text-base">
          Primeiro nome
        </Label>
        <Input
          id="primeiro-nome"
          className={FIELD}
          autoComplete="given-name"
          maxLength={60}
          defaultValue={profile.firstName ?? ""}
          onChange={(event) => setNameValue(event.target.value)}
          aria-describedby="nome-ajuda"
        />
        <p id="nome-ajuda" className="mt-2 text-sm text-muted-foreground">
          {WIZARD_MESSAGES.localOnly}
        </p>
      </StepShell>
    );
  }

  if (step === "choose_fulfillment") {
    const only =
      configuration!.deliveryEnabled && !configuration!.pickupEnabled
        ? "entrega"
        : !configuration!.deliveryEnabled && configuration!.pickupEnabled
          ? "retirada"
          : null;

    return (
      <StepShell
        title="Como você quer receber?"
        description={
          only
            ? "Esta loja está atendendo apenas nesta modalidade. Confirme para continuar."
            : "Você pode mudar depois, antes de enviar o pedido."
        }
        progress={progress}
        onBack={back}
        footer={<span className="sr-only">Escolha uma modalidade acima</span>}
      >
        {banner}
        <div className="grid gap-4">
          {configuration!.deliveryEnabled ? (
            <button
              type="button"
              onClick={() => wizard.chooseFulfillment("entrega")}
              className="flex min-h-[104px] flex-col items-start gap-2 rounded-2xl border p-5 text-left hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Bike aria-hidden="true" className="size-6" />
              <span className="text-lg font-semibold">
                {only === "entrega" ? "Continuar com entrega" : "Entrega"}
              </span>
              <span className="text-sm text-muted-foreground">
                A taxa depende do bairro e é confirmada na próxima etapa.
              </span>
              {profile.lastFulfillmentPreference === "entrega" ? (
                <Badge variant="secondary">Usado da última vez</Badge>
              ) : null}
            </button>
          ) : null}

          {configuration!.pickupEnabled ? (
            <button
              type="button"
              onClick={() => wizard.chooseFulfillment("retirada")}
              className="flex min-h-[104px] flex-col items-start gap-2 rounded-2xl border p-5 text-left hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Store aria-hidden="true" className="size-6" />
              <span className="text-lg font-semibold">
                {only === "retirada" ? "Continuar com retirada" : "Retirada no estabelecimento"}
              </span>
              <span className="text-sm text-muted-foreground">
                Sem taxa de entrega. Preparo em ~{configuration!.defaultPreparationMinutes} min.
              </span>
              {profile.lastFulfillmentPreference === "retirada" ? (
                <Badge variant="secondary">Usado da última vez</Badge>
              ) : null}
            </button>
          ) : null}
        </div>
      </StepShell>
    );
  }

  if (step === "choose_saved_address") {
    const mostRecent = [...profile.savedAddresses].sort((a, b) =>
      String(b.lastUsedAt ?? b.updatedAt).localeCompare(String(a.lastUsedAt ?? a.updatedAt)),
    )[0];

    return (
      <StepShell
        title="Para qual endereço?"
        description="Escolher um endereço apenas o seleciona. A confirmação vem na próxima tela."
        progress={progress}
        onBack={back}
        footer={
          <Button variant="outline" className={PRIMARY} onClick={wizard.startNewAddress}>
            Cadastrar novo endereço
          </Button>
        }
      >
        {banner}
        <ul className="space-y-3">
          {profile.savedAddresses.map((address) => {
            const area = areas.find((a) => a.id === address.neighborhoodId);
            return (
              <li key={address.localId} className="rounded-2xl border p-4">
                <button
                  type="button"
                  className="w-full text-left"
                  aria-pressed={session.selectedAddressLocalId === address.localId}
                  onClick={() => wizard.selectSavedAddress(address.localId)}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <MapPin aria-hidden="true" className="size-4" />
                    {address.customLabel ?? address.label}
                    {mostRecent?.localId === address.localId ? (
                      <Badge variant="secondary">Sugestão</Badge>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {shortAddressLine(address)} — {area?.name ?? address.neighborhoodNameSnapshot}
                  </span>
                  {!area ? (
                    <span className="mt-1 block text-sm text-destructive">
                      {WIZARD_MESSAGES.areaUnavailable}
                    </span>
                  ) : null}
                </button>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-[44px]"
                    onClick={() => wizard.editAddress(address.localId)}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-[44px]"
                    onClick={() => wizard.deleteAddress(address.localId)}
                  >
                    <Trash2 aria-hidden="true" className="mr-1 size-4" />
                    Excluir
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </StepShell>
    );
  }

  if (isAddressStep(step) && step !== "confirm_address") {
    const advance = () => wizard.setStep(nextAddressStep(step));

    if (step === "address_neighborhood") {
      return (
        <StepShell
          title="Em qual bairro será a entrega?"
          description="A taxa e o pedido mínimo mudam conforme o bairro."
          progress={progress}
          onBack={back}
          footer={
            <Button className={PRIMARY} disabled={!draft.neighborhoodId} onClick={advance}>
              Continuar
            </Button>
          }
        >
          {banner}
          {areas.length > 6 ? (
            <>
              <Label htmlFor="busca-bairro" className="text-base">
                Buscar bairro
              </Label>
              <Input
                id="busca-bairro"
                className={FIELD}
                value={areaTerm}
                onChange={(event) => setAreaTerm(event.target.value)}
              />
            </>
          ) : null}
          <div className="mt-4 space-y-2">
            {filteredAreas.map((area) => (
              <button
                key={area.id}
                type="button"
                aria-pressed={draft.neighborhoodId === area.id}
                onClick={() =>
                  wizard.updateDraft({
                    neighborhoodId: area.id,
                    neighborhoodNameSnapshot: area.name,
                  })
                }
                className={`flex min-h-[56px] w-full items-center justify-between rounded-xl border px-4 py-3 text-left ${
                  draft.neighborhoodId === area.id ? "border-foreground bg-muted" : ""
                }`}
              >
                <span className="font-medium">{area.name}</span>
                <span className="text-sm text-muted-foreground">
                  Taxa {brl(area.deliveryFee)} · mínimo {brl(area.minimumOrderAmount)}
                </span>
              </button>
            ))}
            {filteredAreas.length === 0 ? (
              <p className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
                Esta loja ainda não entrega neste bairro.
              </p>
            ) : null}
          </div>
          {configuration!.pickupEnabled ? (
            <Button
              variant="ghost"
              className="mt-4 min-h-[52px] w-full"
              onClick={() => wizard.chooseFulfillment("retirada")}
            >
              Mudar para retirada
            </Button>
          ) : null}
        </StepShell>
      );
    }

    if (step === "address_street") {
      return (
        <StepShell
          title="Qual é a rua ou avenida?"
          progress={progress}
          onBack={back}
          footer={
            <Button
              className={PRIMARY}
              disabled={draft.street.trim().length < 3}
              onClick={advance}
            >
              Continuar
            </Button>
          }
        >
          {banner}
          <Label htmlFor="rua" className="text-base">
            Rua ou avenida
          </Label>
          <Input
            id="rua"
            className={FIELD}
            maxLength={120}
            value={draft.street}
            onChange={(event) => wizard.updateDraft({ street: event.target.value })}
          />
        </StepShell>
      );
    }

    if (step === "address_number") {
      return (
        <StepShell
          title="Qual é o número?"
          progress={progress}
          onBack={back}
          footer={
            <Button
              className={PRIMARY}
              disabled={!draft.hasNoNumber && draft.number.trim().length === 0}
              onClick={advance}
            >
              Continuar
            </Button>
          }
        >
          {banner}
          <Label htmlFor="numero" className="text-base">
            Número
          </Label>
          <Input
            id="numero"
            className={FIELD}
            maxLength={20}
            disabled={draft.hasNoNumber}
            value={draft.number}
            onChange={(event) => wizard.updateDraft({ number: event.target.value })}
          />
          <div className="mt-4 flex items-center gap-3">
            <Checkbox
              id="sem-numero"
              checked={draft.hasNoNumber}
              onCheckedChange={(checked) => wizard.updateDraft({ hasNoNumber: checked === true })}
            />
            <Label htmlFor="sem-numero" className="text-base">
              Sem número
            </Label>
          </div>
        </StepShell>
      );
    }

    if (step === "address_complement") {
      return (
        <StepShell
          title="Tem algum complemento?"
          description="Apartamento, bloco, fundos, portão."
          progress={progress}
          onBack={back}
          footer={
            <div className="space-y-2">
              <Button className={PRIMARY} onClick={advance}>
                Continuar
              </Button>
              <Button
                variant="ghost"
                className={PRIMARY}
                onClick={() => {
                  wizard.updateDraft({ complement: "" });
                  advance();
                }}
              >
                Não tenho complemento
              </Button>
            </div>
          }
        >
          {banner}
          <Label htmlFor="complemento" className="text-base">
            Complemento
          </Label>
          <Input
            id="complemento"
            className={FIELD}
            maxLength={100}
            value={draft.complement}
            onChange={(event) => wizard.updateDraft({ complement: event.target.value })}
          />
        </StepShell>
      );
    }

    if (step === "address_reference") {
      return (
        <StepShell
          title="Algum ponto de referência?"
          description="Ajuda quem entrega a chegar mais rápido."
          progress={progress}
          onBack={back}
          footer={
            <div className="space-y-2">
              <Button className={PRIMARY} onClick={advance}>
                Continuar
              </Button>
              <Button
                variant="ghost"
                className={PRIMARY}
                onClick={() => {
                  wizard.updateDraft({ referencePoint: "" });
                  advance();
                }}
              >
                Continuar sem referência
              </Button>
            </div>
          }
        >
          {banner}
          <Label htmlFor="referencia" className="text-base">
            Ponto de referência
          </Label>
          <Input
            id="referencia"
            className={FIELD}
            maxLength={140}
            value={draft.referencePoint}
            onChange={(event) => wizard.updateDraft({ referencePoint: event.target.value })}
          />
        </StepShell>
      );
    }

    // address_label
    const duplicate = wizard.duplicateOf(draft);
    return (
      <StepShell
        title="Como você quer identificar este endereço?"
        progress={progress}
        onBack={back}
        footer={
          <Button
            className={PRIMARY}
            onClick={() => setError(wizard.saveDraftAndReview())}
            disabled={draft.label === "Outro" && draft.customLabel.trim().length < 2}
          >
            Continuar
          </Button>
        }
      >
        {banner}
        {duplicate ? (
          <p className="mb-4 rounded-lg border border-border p-3 text-sm">
            Você já tem um endereço igual salvo ({duplicate.customLabel ?? duplicate.label}).{" "}
            <button
              type="button"
              className="underline"
              onClick={() => wizard.editAddress(duplicate.localId)}
            >
              Editar o existente
            </button>
          </p>
        ) : null}
        <div className="grid gap-3">
          {(["Casa", "Trabalho", "Outro"] as AddressLabel[]).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={draft.label === option}
              onClick={() => wizard.updateDraft({ label: option })}
              className={`min-h-[56px] rounded-xl border px-4 py-3 text-base font-medium ${
                draft.label === option ? "border-foreground bg-muted" : ""
              }`}
            >
              {option}
            </button>
          ))}
        </div>
        {draft.label === "Outro" ? (
          <div className="mt-4">
            <Label htmlFor="rotulo" className="text-base">
              Nome deste endereço
            </Label>
            <Input
              id="rotulo"
              className={FIELD}
              maxLength={30}
              value={draft.customLabel}
              onChange={(event) => wizard.updateDraft({ customLabel: event.target.value })}
            />
          </div>
        ) : null}
      </StepShell>
    );
  }

  if (step === "confirm_address") {
    const address = selectedAddress;
    const area = address ? areas.find((a) => a.id === address.neighborhoodId) : null;

    return (
      <StepShell
        title="Você quer receber neste endereço?"
        description="Nada é confirmado só por chegar nesta tela."
        onBack={back}
        footer={
          <Button
            className={PRIMARY}
            disabled={!address || !area || busy}
            onClick={() => void wizard.confirmAddress()}
          >
            <Check aria-hidden="true" className="mr-2 size-4" />
            {busy ? "Confirmando…" : "Sim, usar este endereço"}
          </Button>
        }
      >
        {banner}
        {address ? (
          <>
            <AddressSummary
              address={address}
              areaName={area?.name ?? address.neighborhoodNameSnapshot}
            />
            {area ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Taxa informativa {brl(area.deliveryFee)} · pedido mínimo{" "}
                {brl(area.minimumOrderAmount)}
                {area.estimatedMinutes ? ` · ~${area.estimatedMinutes} min` : ""}. Os valores são
                recalculados no envio do pedido.
              </p>
            ) : (
              <p className="mt-3 text-sm text-destructive">{WIZARD_MESSAGES.areaUnavailable}</p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Escolha um endereço para continuar.</p>
        )}

        <div className="mt-5 grid gap-2">
          <Button
            variant="outline"
            className="min-h-[52px]"
            onClick={() => address && wizard.editAddress(address.localId)}
          >
            Editar endereço
          </Button>
          {profile.savedAddresses.length > 1 ? (
            <Button
              variant="outline"
              className="min-h-[52px]"
              onClick={() => wizard.setStep("choose_saved_address")}
            >
              Escolher outro
            </Button>
          ) : null}
          <Button variant="outline" className="min-h-[52px]" onClick={wizard.startNewAddress}>
            Cadastrar novo
          </Button>
          {configuration!.pickupEnabled ? (
            <Button
              variant="ghost"
              className="min-h-[52px]"
              onClick={() => wizard.chooseFulfillment("retirada")}
            >
              Mudar para retirada
            </Button>
          ) : null}
        </div>
      </StepShell>
    );
  }

  if (step === "confirm_pickup") {
    return (
      <StepShell
        title="Você vai retirar o pedido no estabelecimento?"
        description={`${configuration!.storeName} · preparo em ~${configuration!.defaultPreparationMinutes} min`}
        progress={progress}
        onBack={back}
        footer={
          <Button className={PRIMARY} disabled={busy} onClick={() => void wizard.confirmPickup()}>
            {busy ? "Confirmando…" : "Sim, vou retirar"}
          </Button>
        }
      >
        {banner}
        <Badge variant={configuration!.storeIsOpen ? "default" : "secondary"}>
          {configuration!.storeIsOpen ? "Aberta agora" : "Fechada"}
        </Badge>
        {configuration!.deliveryEnabled ? (
          <Button
            variant="outline"
            className="mt-5 min-h-[52px] w-full"
            onClick={() => wizard.chooseFulfillment("entrega")}
          >
            Escolher entrega
          </Button>
        ) : null}
      </StepShell>
    );
  }

  return null;
}
