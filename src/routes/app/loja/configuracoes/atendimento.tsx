import { createFileRoute } from "@tanstack/react-router";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateServiceSettings } from "@/store-config/api";
import { setManualStoreOpen } from "@/store-config/manual-open";
import {
  SectionForm,
  TextField,
  formatCurrencyInput,
  parseCurrencyInput,
  useSectionForm,
} from "@/store-config/form-kit";
import { useStoreConfig } from "@/store-config/StoreConfigProvider";

export const Route = createFileRoute("/app/loja/configuracoes/atendimento")({
  component: AtendimentoSection,
});

function AtendimentoSection() {
  const { configuration, storeId, save, isSaving } = useStoreConfig();
  const store = configuration?.store;
  const settings = configuration?.settings;
  const canEdit = configuration?.can.manage_settings ?? false;

  const form = useSectionForm({
    acceptsDelivery: store?.accepts_delivery ?? true,
    acceptsPickup: store?.accepts_pickup ?? false,
    minOrder: formatCurrencyInput(settings?.min_order_amount ?? 0),
    prepMinutes: String(settings?.default_prep_minutes ?? 30),
    soundAlert: settings?.sound_alert_enabled ?? true,
    autoOpen: settings?.auto_open_by_hours ?? true,
    manualOpen: settings?.manual_override_open ?? false,
  });

  const minOrder = parseCurrencyInput(form.value.minOrder);
  const prep = Number(form.value.prepMinutes);

  const minOrderError =
    form.dirty && (minOrder == null || minOrder < 0) ? "Informe um valor válido." : null;
  const prepError =
    form.dirty && (!Number.isInteger(prep) || prep < 0 || prep > 600)
      ? "Informe o tempo em minutos, entre 0 e 600."
      : null;
  const modeError =
    form.dirty && !form.value.acceptsDelivery && !form.value.acceptsPickup
      ? "Ative ao menos entrega ou retirada."
      : null;

  return (
    <SectionForm
      title="Atendimento"
      description="Define como a loja recebe pedidos e o que o cliente vê antes de finalizar."
      disabled={!canEdit}
      dirty={form.dirty}
      saving={isSaving}
      onReset={form.reset}
      onSubmit={() => {
        if (!storeId || !settings || minOrderError || prepError || modeError) return;
        void save(
          async () => {
            const updated = await updateServiceSettings({
              storeId,
              acceptsDelivery: form.value.acceptsDelivery,
              acceptsPickup: form.value.acceptsPickup,
              minOrderAmount: minOrder ?? 0,
              defaultPrepMinutes: prep,
              soundAlertEnabled: form.value.soundAlert,
              autoOpenByHours: form.value.autoOpen,
              expectedUpdatedAt: settings.updated_at,
            });

            if (!form.value.autoOpen && updated.settings.manual_override_open !== form.value.manualOpen) {
              return setManualStoreOpen({
                storeId,
                open: form.value.manualOpen,
                expectedUpdatedAt: updated.settings.updated_at,
              });
            }
            return updated;
          },
          form.value.autoOpen
            ? "Atendimento atualizado. A loja seguirá os horários cadastrados."
            : form.value.manualOpen
              ? "Atendimento atualizado. A loja está aberta manualmente."
              : "Atendimento atualizado. A loja está fechada manualmente.",
        );
      }}
    >
      <div className="space-y-3">
        <ToggleRow
          id="delivery"
          label="Aceitar entrega"
          hint="Exibe endereços e taxas por bairro no checkout."
          checked={form.value.acceptsDelivery}
          onChange={(v) => form.set("acceptsDelivery", v)}
        />
        <ToggleRow
          id="pickup"
          label="Aceitar retirada no local"
          hint="Cliente escolhe buscar o pedido na loja."
          checked={form.value.acceptsPickup}
          onChange={(v) => form.set("acceptsPickup", v)}
        />
        {modeError ? (
          <p role="alert" className="text-xs text-destructive">
            {modeError}
          </p>
        ) : null}
      </div>

      <TextField
        id="minOrder"
        label="Pedido mínimo padrão"
        hint="Bairros com valor próprio ignoram este padrão."
        inputMode="decimal"
        value={form.value.minOrder}
        error={minOrderError}
        onChange={(v) => form.set("minOrder", v)}
      />
      <TextField
        id="prepMinutes"
        label="Tempo de preparo padrão (minutos)"
        hint="Base do prazo estimado quando o bairro não define um tempo."
        inputMode="numeric"
        value={form.value.prepMinutes}
        error={prepError}
        onChange={(v) => form.set("prepMinutes", v)}
      />

      <div className="space-y-3">
        <ToggleRow
          id="autoOpen"
          label="Abrir e fechar automaticamente pelos horários"
          hint="Ative para seguir a grade de horários. Desative para controlar a loja manualmente."
          checked={form.value.autoOpen}
          onChange={(v) => form.set("autoOpen", v)}
        />
        {!form.value.autoOpen ? (
          <ToggleRow
            id="manualOpen"
            label={form.value.manualOpen ? "Loja aberta manualmente" : "Loja fechada manualmente"}
            hint={form.value.manualOpen ? "O cardápio aceita pedidos até você fechar manualmente ou voltar ao modo por horários." : "O cardápio não aceita novos pedidos até você abrir manualmente ou voltar ao modo por horários."}
            checked={form.value.manualOpen}
            onChange={(v) => form.set("manualOpen", v)}
          />
        ) : null}
        <ToggleRow
          id="soundAlert"
          label="Alerta sonoro de novo pedido"
          hint="Toca um som no painel quando um pedido chega."
          checked={form.value.soundAlert}
          onChange={(v) => form.set("soundAlert", v)}
        />
      </div>

      <Alert>
        <AlertDescription>
          {form.value.autoOpen
            ? "A abertura segue os horários cadastrados. Fora da grade, o cardápio fica fechado automaticamente."
            : form.value.manualOpen
              ? "Modo manual ativo: a loja permanece aberta mesmo fora da grade de horários até você alterar este controle."
              : "Modo manual ativo: a loja permanece fechada mesmo dentro da grade de horários até você alterar este controle."}
        </AlertDescription>
      </Alert>

      <Alert>
        <AlertDescription>
          Sem entrega ativa, os bairros continuam salvos, mas não aparecem para o cliente.
        </AlertDescription>
      </Alert>
    </SectionForm>
  );
}

function ToggleRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
      <div className="space-y-1">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
