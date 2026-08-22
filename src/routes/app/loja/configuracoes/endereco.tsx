import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, LocateFixed } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { lookupCep } from "@/lib/public-data.functions";
import { updateStoreAddress, updateStoreLocationCoordinates } from "@/store-config/address-api";
import { SectionForm, TextField, useSectionForm } from "@/store-config/form-kit";
import { useStoreConfig } from "@/store-config/StoreConfigProvider";

export const Route = createFileRoute("/app/loja/configuracoes/endereco")({ component: EnderecoSection });

function geolocationErrorCode(error: unknown): number | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "number" && Number.isFinite(code) ? code : null;
}

function EnderecoSection() {
  const { configuration, storeId, save, isSaving } = useStoreConfig();
  const consultCep = useServerFn(lookupCep);
  const store = configuration?.store;
  const form = useSectionForm({
    postalCode: store?.postal_code ?? "",
    street: store?.street ?? "",
    addressNumber: store?.address_number ?? "",
    addressComplement: store?.address_complement ?? "",
    neighborhood: store?.neighborhood ?? "",
    city: store?.city ?? "",
    state: store?.state ?? "",
  });
  const [cepBusy, setCepBusy] = useState(false);
  const [cepMessage, setCepMessage] = useState<string | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);

  const canEdit = configuration?.can.update_profile ?? false;
  const normalizedCep = form.value.postalCode.replace(/\D/g, "");
  const canLookupCep = canEdit && normalizedCep.length === 8 && !cepBusy;
  const hasCoordinates = store?.latitude != null && store?.longitude != null;
  const postalError = normalizedCep.length !== 8 ? "Informe um CEP com 8 dígitos." : null;
  const streetError = form.value.street.trim().length < 2 ? "Informe a rua ou logradouro." : null;
  const cityError = form.value.city.trim().length < 2 ? "Informe a cidade." : null;
  const stateError = form.value.state.trim().length !== 2 ? "Use a sigla do estado com 2 letras." : null;
  const hasError = Boolean(postalError || streetError || cityError || stateError);

  async function handleCepLookup() {
    if (!canLookupCep) return;
    setCepBusy(true);
    setCepMessage(null);
    try {
      const result = await consultCep({ data: { cep: normalizedCep } });
      if (!result.ok) {
        setCepMessage(result.reason === "not_found" ? "CEP não encontrado. Preencha o endereço manualmente." : "A busca está indisponível agora. Você pode continuar manualmente.");
        return;
      }
      form.set("postalCode", result.data.cep);
      if (result.data.street) form.set("street", result.data.street);
      if (result.data.neighborhood) form.set("neighborhood", result.data.neighborhood);
      form.set("city", result.data.city);
      form.set("state", result.data.state.toUpperCase());
      setCepMessage("Endereço localizado. Confira o número e o complemento antes de salvar.");
    } catch {
      setCepMessage("A busca está indisponível agora. Você pode continuar manualmente.");
    } finally {
      setCepBusy(false);
    }
  }

  async function handleCurrentLocation() {
    if (!storeId || !store || !canEdit || form.dirty || isSaving || locationBusy) return;
    setLocationMessage(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationMessage("Este dispositivo não permite usar a localização atual.");
      return;
    }
    setLocationBusy(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 });
      });
      const accuracy = Number.isFinite(position.coords.accuracy) ? Math.round(position.coords.accuracy) : null;
      const saved = await save(() => updateStoreLocationCoordinates({
        storeId,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        source: "manual_browser",
        accuracyMeters: accuracy,
        expectedUpdatedAt: store.updated_at,
      }), "Localização da loja atualizada.");
      if (saved) setLocationMessage("Localização confirmada. As estimativas de distância podem usar este ponto como origem.");
    } catch (error) {
      const code = geolocationErrorCode(error);
      if (code === 1) setLocationMessage("Permissão de localização negada. Você pode continuar usando apenas o endereço.");
      else if (code === 2) setLocationMessage("Não foi possível identificar sua localização agora.");
      else setLocationMessage("A localização demorou demais. Tente novamente quando estiver na loja.");
    } finally {
      setLocationBusy(false);
    }
  }

  return (
    <SectionForm
      title="Endereço da loja"
      description="Usado para retirada e para calcular entregas a partir da sua loja."
      disabled={!canEdit}
      dirty={form.dirty}
      saving={isSaving}
      onReset={form.reset}
      onSubmit={() => {
        if (!storeId || !store || hasError) return;
        void save(() => updateStoreAddress({
          storeId,
          postalCode: normalizedCep,
          street: form.value.street,
          addressNumber: form.value.addressNumber,
          addressComplement: form.value.addressComplement,
          neighborhood: form.value.neighborhood,
          city: form.value.city,
          state: form.value.state.toUpperCase(),
          expectedUpdatedAt: store.updated_at,
        }), "Endereço da loja atualizado.");
      }}
    >
      <div className="space-y-2">
        <TextField id="postalCode" label="CEP" hint="Digite o CEP para preencher parte do endereço automaticamente." inputMode="numeric" value={form.value.postalCode} error={form.dirty ? postalError : null} maxLength={10} onChange={(value) => { form.set("postalCode", value); setCepMessage(null); }} />
        <div className="flex flex-wrap items-center gap-3"><Button type="button" variant="outline" size="sm" disabled={!canLookupCep} onClick={() => void handleCepLookup()}>{cepBusy ? "Buscando..." : "Buscar CEP"}</Button>{cepMessage ? <p className="text-xs text-muted-foreground">{cepMessage}</p> : null}</div>
      </div>
      <TextField id="street" label="Rua / logradouro" value={form.value.street} error={form.dirty ? streetError : null} maxLength={180} onChange={(value) => form.set("street", value)} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField id="addressNumber" label="Número" hint="Pode usar S/N quando aplicável." value={form.value.addressNumber} maxLength={40} onChange={(value) => form.set("addressNumber", value)} />
        <TextField id="addressComplement" label="Complemento" hint="Opcional." value={form.value.addressComplement} maxLength={120} onChange={(value) => form.set("addressComplement", value)} />
      </div>
      <TextField id="neighborhood" label="Bairro" value={form.value.neighborhood} maxLength={120} onChange={(value) => form.set("neighborhood", value)} />
      <div className="grid gap-5 sm:grid-cols-[1fr_120px]">
        <TextField id="city" label="Cidade" value={form.value.city} error={form.dirty ? cityError : null} maxLength={120} onChange={(value) => form.set("city", value)} />
        <TextField id="state" label="UF" value={form.value.state} error={form.dirty ? stateError : null} maxLength={2} onChange={(value) => form.set("state", value.toUpperCase())} />
      </div>

      <div className="rounded-2xl border border-border bg-muted/30 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            {hasCoordinates ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" /> : <LocateFixed className="mt-0.5 size-5 shrink-0 text-brand" />}
            <div><p className="text-sm font-semibold text-foreground">Confirmar localização da loja</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{hasCoordinates ? "Localização confirmada para melhorar cálculos de distância." : "Se estiver na loja, use a localização do dispositivo para deixar as estimativas mais precisas."}</p></div>
          </div>
          <Button type="button" variant="outline" disabled={!canEdit || form.dirty || isSaving || locationBusy} onClick={() => void handleCurrentLocation()}><LocateFixed className="mr-2 size-4" />{locationBusy ? "Localizando..." : hasCoordinates ? "Atualizar localização" : "Usar localização atual"}</Button>
        </div>
        {form.dirty ? <p className="mt-3 text-xs text-warning">Salve o endereço antes de confirmar a localização.</p> : null}
        {locationMessage ? <p className="mt-3 text-xs text-muted-foreground">{locationMessage}</p> : null}
      </div>
    </SectionForm>
  );
}
