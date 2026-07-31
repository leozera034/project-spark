import { createFileRoute } from "@tanstack/react-router";

import { updateStoreProfile } from "@/store-config/api";
import { SectionForm, TextField, useSectionForm } from "@/store-config/form-kit";
import { useStoreConfig } from "@/store-config/StoreConfigProvider";

export const Route = createFileRoute("/app/loja/configuracoes/dados")({
  component: DadosSection,
});

function DadosSection() {
  const { configuration, storeId, save, isSaving } = useStoreConfig();
  const store = configuration?.store;
  const settings = configuration?.settings;

  const form = useSectionForm({
    name: store?.name ?? "",
    legalName: store?.legal_name ?? "",
    document: store?.document ?? "",
    phone: store?.phone ?? "",
    whatsapp: store?.whatsapp ?? "",
    email: store?.email ?? "",
    timezone: store?.timezone ?? "America/Sao_Paulo",
    description: settings?.description ?? "",
    welcomeMessage: settings?.welcome_message ?? "",
    closedMessage: settings?.closed_message ?? "",
  });

  const canEdit = configuration?.can.update_profile ?? false;
  const nameError = form.value.name.trim().length < 2 ? "Informe o nome da loja." : null;

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
              timezone: form.value.timezone,
              description: form.value.description,
              welcomeMessage: form.value.welcomeMessage,
              closedMessage: form.value.closedMessage,
              expectedUpdatedAt: store.updated_at,
            }),
          "Dados da loja atualizados.",
        );
      }}
    >
      <TextField
        id="name"
        label="Nome da loja"
        value={form.value.name}
        error={form.dirty ? nameError : null}
        maxLength={120}
        onChange={(v) => form.set("name", v)}
      />
      <TextField
        id="legalName"
        label="Razão social"
        hint="Opcional. Aparece apenas em documentos internos."
        value={form.value.legalName}
        maxLength={160}
        onChange={(v) => form.set("legalName", v)}
      />
      <TextField
        id="document"
        label="CNPJ ou CPF"
        hint="Somente números."
        inputMode="numeric"
        value={form.value.document}
        maxLength={18}
        onChange={(v) => form.set("document", v)}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          id="phone"
          label="Telefone"
          inputMode="tel"
          value={form.value.phone}
          maxLength={20}
          onChange={(v) => form.set("phone", v)}
        />
        <TextField
          id="whatsapp"
          label="WhatsApp"
          inputMode="tel"
          value={form.value.whatsapp}
          maxLength={20}
          onChange={(v) => form.set("whatsapp", v)}
        />
      </div>
      <TextField
        id="email"
        label="E-mail de contato"
        inputMode="email"
        value={form.value.email}
        maxLength={160}
        onChange={(v) => form.set("email", v)}
      />
      <TextField
        id="timezone"
        label="Fuso horário"
        hint="Usado para abrir e fechar a loja automaticamente."
        value={form.value.timezone}
        maxLength={64}
        onChange={(v) => form.set("timezone", v)}
      />
      <TextField
        id="description"
        label="Descrição pública"
        hint="Texto curto exibido no topo do cardápio."
        multiline
        value={form.value.description}
        maxLength={280}
        onChange={(v) => form.set("description", v)}
      />
      <TextField
        id="welcomeMessage"
        label="Mensagem de boas-vindas"
        multiline
        value={form.value.welcomeMessage}
        maxLength={280}
        onChange={(v) => form.set("welcomeMessage", v)}
      />
      <TextField
        id="closedMessage"
        label="Mensagem com a loja fechada"
        multiline
        value={form.value.closedMessage}
        maxLength={280}
        onChange={(v) => form.set("closedMessage", v)}
      />
    </SectionForm>
  );
}
