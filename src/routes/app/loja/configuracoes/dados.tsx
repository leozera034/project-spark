import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { lookupCnpj } from "@/lib/public-data.functions";
import { updateStoreProfile } from "@/store-config/api";
import { SectionForm, TextField, useSectionForm } from "@/store-config/form-kit";
import { useStoreConfig } from "@/store-config/StoreConfigProvider";

export const Route = createFileRoute("/app/loja/configuracoes/dados")({
  component: DadosSection,
});

function DadosSection() {
  const { configuration, storeId, save, isSaving } = useStoreConfig();
  const consultCnpj = useServerFn(lookupCnpj);
  const store = configuration?.store;
  const settings = configuration?.settings;

  const form = useSectionForm({
    name: store?.name ?? "",
    legalName: store?.legal_name ?? "",
    document: store?.document ?? "",
    phone: store?.phone ?? "",
    whatsapp: store?.whatsapp ?? "",
    email: store?.email ?? "",
    description: settings?.description ?? "",
    welcomeMessage: settings?.welcome_message ?? "",
    closedMessage: settings?.closed_message ?? "",
  });

  const [cnpjBusy, setCnpjBusy] = useState(false);
  const [cnpjMessage, setCnpjMessage] = useState<string | null>(null);

  const canEdit = configuration?.can.update_profile ?? false;
  const nameError = form.value.name.trim().length < 2 ? "Informe o nome da loja." : null;
  const normalizedDocument = form.value.document.replace(/\D/g, "");
  const canLookupCnpj = canEdit && normalizedDocument.length === 14 && !cnpjBusy;

  async function handleCnpjLookup() {
    if (!canLookupCnpj) return;
    setCnpjBusy(true);
    setCnpjMessage(null);

    try {
      const result = await consultCnpj({ data: { cnpj: normalizedDocument } });
      if (!result.ok) {
        setCnpjMessage(
          result.reason === "not_found"
            ? "CNPJ não encontrado. Você pode preencher os dados manualmente."
            : "Consulta indisponível agora. Você pode continuar preenchendo manualmente.",
        );
        return;
      }

      form.set("legalName", result.data.legalName);
      setCnpjMessage(
        result.data.tradeName
          ? `CNPJ localizado: ${result.data.tradeName}. Razão social preenchida automaticamente.`
          : "CNPJ localizado. Razão social preenchida automaticamente.",
      );
    } catch {
      setCnpjMessage("Consulta indisponível agora. Você pode continuar preenchendo manualmente.");
    } finally {
      setCnpjBusy(false);
    }
  }

  return (
    <SectionForm
      title="Dados da loja"
      description="Informações usadas no cardápio público e no contato com o cliente."
      disabled={!canEdit}
      dirty={form.dirty}
      saving={isSaving}
      onReset={form.reset}
      onSubmit={() => {
        if (!storeId || !store || nameError) return;
        void save(
          () =>
            updateStoreProfile({
              storeId,
              name: form.value.name,
              legalName: form.value.legalName,
              document: form.value.document,
              phone: form.value.phone,
              whatsapp: form.value.whatsapp,
              email: form.value.email,
              timezone: store.timezone,
              description: form.value.description,
              welcomeMessage: form.value.welcomeMessage,
              closedMessage: form.value.closedMessage,
              expectedUpdatedAt: store.updated_at,
            }),
          "Dados da loja atualizados.",
        );
      }}
    >
      <TextField id="name" label="Nome da loja" value={form.value.name} error={form.dirty ? nameError : null} maxLength={120} onChange={(v) => form.set("name", v)} />
      <TextField id="legalName" label="Razão social" hint="Opcional. Aparece apenas em documentos internos." value={form.value.legalName} maxLength={160} onChange={(v) => form.set("legalName", v)} />
      <div className="space-y-2">
        <TextField
          id="document"
          label="CNPJ ou CPF"
          hint="Para CNPJ, a Comandiva pode consultar os dados públicos automaticamente."
          inputMode="numeric"
          value={form.value.document}
          maxLength={18}
          onChange={(v) => { form.set("document", v); setCnpjMessage(null); }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" size="sm" disabled={!canLookupCnpj} onClick={() => void handleCnpjLookup()}>
            {cnpjBusy ? "Consultando..." : "Consultar CNPJ"}
          </Button>
          {cnpjMessage ? <p className="text-xs text-muted-foreground">{cnpjMessage}</p> : null}
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField id="phone" label="Telefone" inputMode="tel" value={form.value.phone} maxLength={20} onChange={(v) => form.set("phone", v)} />
        <TextField id="whatsapp" label="WhatsApp" inputMode="tel" value={form.value.whatsapp} maxLength={20} onChange={(v) => form.set("whatsapp", v)} />
      </div>
      <TextField id="email" label="E-mail de contato" inputMode="email" value={form.value.email} maxLength={160} onChange={(v) => form.set("email", v)} />
      <TextField id="description" label="Descrição pública" hint="Texto curto exibido no topo do cardápio." multiline value={form.value.description} maxLength={280} onChange={(v) => form.set("description", v)} />
      <TextField id="welcomeMessage" label="Mensagem de boas-vindas" multiline value={form.value.welcomeMessage} maxLength={280} onChange={(v) => form.set("welcomeMessage", v)} />
      <TextField id="closedMessage" label="Mensagem com a loja fechada" multiline value={form.value.closedMessage} maxLength={280} onChange={(v) => form.set("closedMessage", v)} />
    </SectionForm>
  );
}
