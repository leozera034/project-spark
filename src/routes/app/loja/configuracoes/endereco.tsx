import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { LocateFixed } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { lookupCep } from "@/lib/public-data.functions";
import { updateStoreAddress, updateStoreLocationCoordinates } from "@/store-config/address-api";
import { SectionForm, TextField, useSectionForm } from "@/store-config/form-kit";
import { useStoreConfig } from "@/store-config/StoreConfigProvider";

export const Route = createFileRoute("/app/loja/configuracoes/endereco")({
  component: EnderecoSection,
});

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
        setCepMessage(
          result.reason === "not_found"
            ? "CEP não encontrado. Preencha o endereço manualmente."
            : "Consulta indisponível agora. Você pode continuar manualmente.",
        );
        return;
      }

      form.set("postalCode", result.data.cep);
      if (result.data.street) form.set("street", result.data.street);
      if (result.data.neighborhood) form.set("neighborhood", result.data.neighborhood);
      form.set("city", result.data.city);
      form.set("state", result.data.state.toUpperCase());

      setCepMessage(
        result.data.street
          ? "CEP localizado. Endereço preenchido; confira o número e o complemento antes de salvar."
          : "CEP localizado. Cidade e estado preenchidos; complete o logradouro manualmente.",
      );
    } catch {
      setCepMessage("Consulta indisponível agora. Você pode continuar manualmente.");
    } finally {
      setCepBusy(false);
    }
  }

  async function handleCurrentLocation() {
    if (!storeId || !store || !canEdit || form.dirty || isSaving || locationBusy) return;
    setLocationMessage(null);

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationMessage("Este dispositivo não oferece localização pelo navegador.");
      return;
    }

    setLocationBusy(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10_000,
          maximumAge: 30_000,
        });
      });

      const accuracy = Number.isFinite(position.coords.accuracy) ? Math.round(position.coords.accuracy) : null;
      const saved = await save(
        () =>
          updateStoreLocationCoordinates({
            storeId,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            source: "manual_browser",
            accuracyMeters: accuracy,
            expectedUpdatedAt: store.updated_at,
          }),
        "Localização operacional da loja atualizada.",
      );

      if (saved) {
        setLocationMessage(
          accuracy != null
            ? `Coordenada capturada pelo dispositivo com precisão aproximada de ${accuracy} m.`
            : "Coordenada capturada pelo dispositivo.",
        );
      }
    } catch (error) {
      const code = error instanceof GeolocationPositionError ? error.code : null;
      if (code === 1) setLocationMessage("Permissão de localização negada. O endereço continua funcionando normalmente.");
      else if (code === 2) setLocationMessage("O dispositivo não conseguiu determinar a localização agora.");
      else setLocationMessage("A localização demorou demais. Tente novamente quando estiver na loja.");
    } finally {
      setLocationBusy(false);
    }
  }

  return (
    <SectionForm
      title="Endereço da loja"
      description="Endereço operacional usado como base para retirada, distância e estimativas de entrega."
      disabled={!canEdit}
      dirty={form.dirty}
      saving={isSaving}
      onReset={form.reset}
      onSubmit={() => {
        if (!storeId || !store || hasError) return;
        void save(
          () =>
            updateStoreAddress({
              storeId,
              postalCode: normalizedCep,
              street: form.value.street,
              addressNumber: form.value.addressNumber,
              addressComplement: form.value.addressComplement,
              neighborhood: form.value.neighborhood,
              city: form.value.city,
              state: form.value.state.toUpperCase(),
              expectedUpdatedAt: store.updated_at,
            }),
          "Endereço da loja atualizado.",
        );
      }}
    >
      <div className="space-y-2">
        <TextField
          id="postalCode"
          label="CEP"
          hint="Digite o CEP e use a consulta automática. Se o serviço estiver indisponível, o preenchimento manual continua funcionando."
          inputMode="numeric"
          value={form.value.postalCode}
          error={form.dirty ? postalError : null}
          maxLength={10}
          onChange={(value) => {
            form.set("postalCode", value);
            setCepMessage(null);
          }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canLookupCep}
            onClick={() => void handleCepLookup()}
          >
            {cepBusy ? "Buscando..." : "Buscar CEP"}
          </Button>
          {cepMessage ? <p className="text-xs text-muted-foreground">{cepMessage}</p> : null}
        </div>
      </div>

      <TextField
        id="street"
        label="Rua / logradouro"
        value={form.value.street}
        error={form.dirty ? streetError : null}
        maxLength={180}
        onChange={(value) => form.set("street", value)}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          id="addressNumber"
          label="Número"
          hint="Pode usar S/N quando aplicável."
          value={form.value.addressNumber}
          maxLength={40}
          onChange={(value) => form.set("addressNumber", value)}
        />
        <TextField
          id="addressComplement"
          label="Complemento"
          hint="Opcional."
          value={form.value.addressComplement}
          maxLength={120}
          onChange={(value) => form.set("addressComplement", value)}
        />
      </div>

      <TextField
        id="neighborhood"
        label="Bairro"
        value={form.value.neighborhood}
        maxLength={120}
        onChange={(value) => form.set("neighborhood", value)}
      />

      <div className="grid gap-5 sm:grid-cols-[1fr_120px]">
        <TextField
          id="city"
          label="Cidade"
          value={form.value.city}
          error={form.dirty ? cityError : null}
          maxLength={120}
          onChange={(value) => form.set("city", value)}
        />
        <TextField
          id="state"
          label="UF"
          value={form.value.state}
          error={form.dirty ? stateError : null}
          maxLength={2}
          onChange={(value) => form.set("state", value.toUpperCase())}
        />
      </div>

      <div className="rounded-2xl border border-border bg-muted/30 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Localização operacional</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {hasCoordinates
                ? "A coordenada da loja está salva e pode alimentar estimativas locais de distância."
                : "Salve o endereço e, estando na loja, capture a localização do dispositivo. Não usa Google Maps nem API paga."}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={!canEdit || form.dirty || isSaving || locationBusy}
            onClick={() => void handleCurrentLocation()}
          >
            <LocateFixed className="mr-2 size-4" />
            {locationBusy ? "Localizando..." : hasCoordinates ? "Atualizar localização" : "Usar localização atual"}
          </Button>
        </div>
        {form.dirty ? (
          <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">Salve primeiro as alterações do endereço para evitar associar uma coordenada ao endereço antigo.</p>
        ) : null}
        {locationMessage ? <p className="mt-3 text-xs text-muted-foreground">{locationMessage}</p> : null}
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        Se o endereço textual mudar, a coordenada anterior é invalidada automaticamente. O ETA por bairro continua como fallback e não depende de localização.
      </p>
    </SectionForm>
  );
}
