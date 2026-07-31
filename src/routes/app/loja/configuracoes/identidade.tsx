import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  checkSlugAvailability,
  clearStoreAsset,
  removeBrandingAsset,
  signBrandingUrl,
  updateStoreSlug,
  updateStoreTheme,
  uploadBrandingAsset,
} from "@/store-config/api";
import {
  buildStoreThemeTokens,
  getContrastColor,
  normalizeHexColor,
  validateStoreTheme,
} from "@/store-config/color";
import { SectionForm, useSectionForm } from "@/store-config/form-kit";
import {
  STORE_SLUG_ISSUE_MESSAGES,
  normalizeStoreSlug,
  validateStoreSlug,
} from "@/store-config/slug";
import { useStoreConfig } from "@/store-config/StoreConfigProvider";

export const Route = createFileRoute("/app/loja/configuracoes/identidade")({
  component: IdentidadeSection,
});

function IdentidadeSection() {
  return (
    <div className="space-y-6">
      <SlugCard />
      <ThemeCard />
      <AssetsCard />
    </div>
  );
}

function SlugCard() {
  const { configuration, storeId, save, isSaving } = useStoreConfig();
  const store = configuration?.store;
  const canEdit = configuration?.can.update_profile ?? false;

  const form = useSectionForm({ slug: store?.slug ?? "" });
  const normalized = normalizeStoreSlug(form.value.slug);
  const local = validateStoreSlug(form.value.slug);

  const availability = useQuery({
    queryKey: ["store-config", "slug", storeId, normalized],
    queryFn: () => checkSlugAvailability(storeId as string, normalized),
    enabled: Boolean(storeId) && local.valid && normalized !== store?.slug,
    retry: false,
  });

  const remoteTaken = availability.data ? !availability.data.available : false;
  const error = !form.dirty
    ? null
    : local.issue
      ? STORE_SLUG_ISSUE_MESSAGES[local.issue]
      : remoteTaken
        ? "Este endereço já está em uso."
        : null;

  return (
    <SectionForm
      title="Endereço público"
      description="É por este link que seus clientes acessam o cardápio."
      disabled={!canEdit}
      dirty={form.dirty}
      saving={isSaving}
      onReset={form.reset}
      onSubmit={() => {
        if (!storeId || !store || error || !local.valid) return;
        void save(
          () => updateStoreSlug(storeId, normalized, store.updated_at),
          "Endereço público atualizado.",
        );
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="slug">Endereço do cardápio</Label>
        <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
          <span className="pl-3 text-sm text-muted-foreground">/loja/</span>
          <Input
            id="slug"
            value={form.value.slug}
            onChange={(event) => form.set("slug", event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby="slug-hint"
            className="h-12 border-0 pl-1 text-base shadow-none focus-visible:ring-0"
          />
        </div>
        <p id="slug-hint" className="text-xs text-muted-foreground">
          Ficará assim: <span className="font-mono">/loja/{normalized || "sua-loja"}</span>
        </p>
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
        {form.dirty && local.valid && !remoteTaken && !availability.isFetching ? (
          <p className="text-xs text-muted-foreground">Endereço disponível.</p>
        ) : null}
      </div>
      <Alert>
        <AlertDescription>
          Ao mudar o endereço, o link antigo deixa de funcionar. Avise seus clientes antes de salvar.
        </AlertDescription>
      </Alert>
    </SectionForm>
  );
}

function ThemeCard() {
  const { configuration, storeId, save, isSaving } = useStoreConfig();
  const settings = configuration?.settings;
  const canEdit = configuration?.can.manage_settings ?? false;

  const form = useSectionForm({
    primary: settings?.brand_primary ?? "#0f1114",
    accent: settings?.brand_accent ?? "#14b8a6",
  });

  const validation = validateStoreTheme(form.value.primary, form.value.accent);
  const tokens = buildStoreThemeTokens(form.value.primary, form.value.accent);
  const issueFor = (field: "primary" | "accent") =>
    form.dirty ? (validation.issues.find((i) => i.field === field)?.message ?? null) : null;

  return (
    <SectionForm
      title="Cores da marca"
      description="A loja escolhe apenas as cores. O layout continua padronizado e acessível."
      disabled={!canEdit}
      dirty={form.dirty}
      saving={isSaving}
      onReset={form.reset}
      onSubmit={() => {
        if (!storeId || !settings || !validation.valid) return;
        void save(
          () =>
            updateStoreTheme({
              storeId,
              primary: validation.primary,
              accent: validation.accent,
              expectedUpdatedAt: settings.updated_at,
            }),
          "Cores atualizadas.",
        );
      }}
      footer={
        <div className="rounded-lg border border-border p-4" style={tokens as React.CSSProperties}>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Prévia
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span
              className="inline-flex min-h-11 items-center rounded-md px-4 text-sm font-medium"
              style={{
                background: "var(--store-primary)",
                color: "var(--store-primary-foreground)",
              }}
            >
              Fazer pedido
            </span>
            <span
              className="inline-flex min-h-11 items-center rounded-md px-4 text-sm font-medium"
              style={{
                background: "var(--store-accent)",
                color: "var(--store-accent-foreground)",
              }}
            >
              Em promoção
            </span>
            <Badge variant="secondary">
              Contraste {validation.contrast.primaryOnSurface.toFixed(1)}:1
            </Badge>
          </div>
        </div>
      }
    >
      <ColorInput
        id="primary"
        label="Cor principal"
        value={form.value.primary}
        error={issueFor("primary")}
        onChange={(v) => form.set("primary", v)}
      />
      <ColorInput
        id="accent"
        label="Cor de destaque"
        value={form.value.accent}
        error={issueFor("accent")}
        onChange={(v) => form.set("accent", v)}
      />
    </SectionForm>
  );
}

function ColorInput({
  id,
  label,
  value,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
}) {
  const safe = normalizeHexColor(value) ?? "#000000";
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          aria-label={`${label} — seletor visual`}
          value={safe}
          onChange={(event) => onChange(event.target.value)}
          className="h-12 w-14 cursor-pointer rounded-md border border-input bg-background p-1"
        />
        <Input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          className="h-12 font-mono text-base"
          maxLength={7}
        />
        <span
          className="hidden h-12 w-24 shrink-0 items-center justify-center rounded-md text-xs font-medium sm:flex"
          style={{ background: safe, color: getContrastColor(safe) }}
        >
          Exemplo
        </span>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function AssetsCard() {
  const { configuration } = useStoreConfig();
  const canEdit = configuration?.can.manage_settings ?? false;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logo e capa</CardTitle>
        <CardDescription>
          Imagens ficam em armazenamento privado e são exibidas por link temporário.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-2">
        <AssetSlot slot="logo" label="Logo" disabled={!canEdit} />
        <AssetSlot slot="cover" label="Capa" disabled={!canEdit} />
      </CardContent>
    </Card>
  );
}

function AssetSlot({
  slot,
  label,
  disabled,
}: {
  slot: "logo" | "cover";
  label: string;
  disabled: boolean;
}) {
  const { configuration, storeId, save } = useStoreConfig();
  const settings = configuration?.settings;
  const path = slot === "logo" ? (settings?.logo_path ?? null) : (settings?.cover_path ?? null);

  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void signBrandingUrl(path).then((url) => {
      if (active) setPreview(url);
    });
    return () => {
      active = false;
    };
  }, [path]);

  const handleFile = async (file: File) => {
    if (!storeId || !settings) return;
    setBusy(true);
    const previousPath = path;
    try {
      const uploaded = await uploadBrandingAsset(storeId, slot, file);
      const ok = await save(
        () =>
          updateStoreTheme({
            storeId,
            primary: settings.brand_primary,
            accent: settings.brand_accent,
            logoPath: slot === "logo" ? uploaded : settings.logo_path,
            coverPath: slot === "cover" ? uploaded : settings.cover_path,
            expectedUpdatedAt: settings.updated_at,
          }),
        `${label} atualizada.`,
      );
      if (ok) await removeBrandingAsset(previousPath);
      else await removeBrandingAsset(uploaded);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted/40">
        {preview ? (
          <img src={preview} alt={`${label} da loja`} className="h-full w-full object-contain" />
        ) : (
          <span className="text-xs text-muted-foreground">Nenhuma imagem enviada</span>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 flex-1"
          disabled={disabled}
          loading={busy}
          loadingLabel="Enviando imagem"
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Enviando…" : "Enviar imagem"}
        </Button>
        {path ? (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11"
            disabled={disabled || busy}
            onClick={() => {
              if (!storeId) return;
              const previous = path;
              void save(() => clearStoreAsset(storeId, slot), `${label} removida.`).then((ok) => {
                if (ok) void removeBrandingAsset(previous);
              });
            }}
          >
            Remover
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        PNG, JPEG ou WebP até {slot === "logo" ? "3" : "6"} MB.
      </p>
    </div>
  );
}
