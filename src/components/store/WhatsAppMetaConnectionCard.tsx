import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, ExternalLink, Link2, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStoreMetaWhatsAppConnection, useStoreMetaWhatsAppOnboardingActions } from "@/store/growth/store-whatsapp-onboarding.queries";

type FacebookLoginResponse = {
  authResponse?: { code?: string } | null;
};

type FacebookSdk = {
  init: (config: { appId: string; version: string; cookie?: boolean; xfbml?: boolean }) => void;
  login: (
    callback: (response: FacebookLoginResponse) => void,
    options: {
      config_id: string;
      response_type: "code";
      override_default_response_type: true;
      extras: { setup: Record<string, never>; sessionInfoVersion: string };
    },
  ) => void;
};

declare global {
  interface Window {
    FB?: FacebookSdk;
  }
}

type EmbeddedAssets = {
  wabaId: string;
  phoneNumberId: string;
  businessId: string | null;
};

type EmbeddedEvent =
  | { kind: "finish"; assets: EmbeddedAssets }
  | { kind: "cancel" }
  | { kind: "ignore" };

let facebookSdkPromise: Promise<FacebookSdk> | null = null;

function loadFacebookSdk(): Promise<FacebookSdk> {
  if (window.FB) return Promise.resolve(window.FB);
  if (facebookSdkPromise) return facebookSdkPromise;

  facebookSdkPromise = new Promise<FacebookSdk>((resolve, reject) => {
    const existing = document.getElementById("facebook-jssdk") as HTMLScriptElement | null;
    const finish = () => {
      if (window.FB) resolve(window.FB);
      else reject(new Error("FACEBOOK_SDK_UNAVAILABLE"));
    };

    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", () => reject(new Error("FACEBOOK_SDK_UNAVAILABLE")), { once: true });
      window.setTimeout(finish, 1_500);
      return;
    }

    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", () => reject(new Error("FACEBOOK_SDK_UNAVAILABLE")), { once: true });
    document.head.appendChild(script);
  }).catch((error) => {
    facebookSdkPromise = null;
    throw error;
  });

  return facebookSdkPromise!;
}

function safeObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function safeId(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  return /^\d{5,40}$/.test(text) ? text : null;
}

function parseEmbeddedSignupEvent(event: MessageEvent): EmbeddedEvent {
  if (event.origin !== "https://www.facebook.com" && event.origin !== "https://web.facebook.com") {
    return { kind: "ignore" };
  }

  let payload: unknown = event.data;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      return { kind: "ignore" };
    }
  }

  const root = safeObject(payload);
  if (root.type !== "WA_EMBEDDED_SIGNUP") return { kind: "ignore" };
  const eventName = typeof root.event === "string" ? root.event.toUpperCase() : "";

  if (eventName === "CANCEL" || eventName === "ERROR") return { kind: "cancel" };
  if (eventName !== "FINISH" && eventName !== "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING") {
    return { kind: "ignore" };
  }

  const data = safeObject(root.data);
  const wabaId = safeId(data.waba_id ?? data.wabaId);
  const phoneNumberId = safeId(data.phone_number_id ?? data.phoneNumberId);
  const businessId = safeId(data.business_id ?? data.businessId);

  if (!wabaId || !phoneNumberId) return { kind: "cancel" };
  return { kind: "finish", assets: { wabaId, phoneNumberId, businessId } };
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("META_APP_NOT_CONFIGURED")) {
    return "Configuração Meta pendente no Comandiva. Nenhuma conta foi conectada.";
  }
  if (message.includes("META_ONBOARDING_SESSION_EXPIRED")) {
    return "A sessão de conexão expirou. Inicie a conexão novamente.";
  }
  if (message.includes("FORBIDDEN")) return "Sua conta não tem permissão para conectar o WhatsApp desta loja.";
  if (message.includes("META_ONBOARDING_UNAVAILABLE")) return "O onboarding não está disponível para esta loja agora.";
  if (message.includes("FACEBOOK_SDK_UNAVAILABLE")) return "Não foi possível carregar a janela segura da Meta.";
  return "Não foi possível concluir a conexão com a Meta. Nenhum token foi salvo no navegador.";
}

export function WhatsAppMetaConnectionCard({
  storeId,
  automaticEntitled,
}: {
  storeId: string;
  automaticEntitled: boolean;
}) {
  const connection = useStoreMetaWhatsAppConnection(storeId);
  const actions = useStoreMetaWhatsAppOnboardingActions();
  const [statusText, setStatusText] = useState<string | null>(null);
  const [uiError, setUiError] = useState<string | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  const codeRef = useRef<string | null>(null);
  const assetsRef = useRef<EmbeddedAssets | null>(null);
  const completingRef = useRef(false);

  const resetFlow = useCallback(() => {
    sessionIdRef.current = null;
    codeRef.current = null;
    assetsRef.current = null;
    completingRef.current = false;
  }, []);

  const completeIfReady = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    const code = codeRef.current;
    const assets = assetsRef.current;
    if (!sessionId || !code || !assets || completingRef.current) return;

    completingRef.current = true;
    setUiError(null);
    setStatusText("Validando conta, número e webhooks com a Meta...");
    try {
      await actions.complete.mutateAsync({
        storeId,
        sessionId,
        code,
        wabaId: assets.wabaId,
        phoneNumberId: assets.phoneNumberId,
        businessId: assets.businessId,
      });
      setStatusText("WhatsApp conectado com segurança.");
      resetFlow();
    } catch (error) {
      setUiError(errorMessage(error));
      setStatusText(null);
      resetFlow();
    }
  }, [actions.complete, resetFlow, storeId]);

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      const parsed = parseEmbeddedSignupEvent(event);
      if (parsed.kind === "ignore") return;
      if (parsed.kind === "cancel") {
        setUiError("A conexão foi cancelada ou não retornou um número WhatsApp válido.");
        setStatusText(null);
        resetFlow();
        return;
      }
      assetsRef.current = parsed.assets;
      setStatusText("Conta selecionada. Finalizando validação...");
      void completeIfReady();
    };

    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [completeIfReady, resetFlow]);

  const startConnection = async () => {
    if (!automaticEntitled || actions.start.isPending || actions.complete.isPending) return;
    setUiError(null);
    setStatusText("Preparando conexão segura com a Meta...");
    resetFlow();

    try {
      const start = await actions.start.mutateAsync(storeId);
      sessionIdRef.current = start.sessionId;
      const fb = await loadFacebookSdk();
      fb.init({
        appId: start.appId,
        version: start.graphApiVersion,
        cookie: false,
        xfbml: false,
      });

      setStatusText("Conclua a seleção da empresa e do número na janela da Meta.");
      fb.login(
        (response) => {
          const code = response.authResponse?.code?.trim() ?? "";
          if (!code) {
            setUiError("A Meta não retornou autorização para concluir a conexão.");
            setStatusText(null);
            resetFlow();
            return;
          }
          codeRef.current = code;
          void completeIfReady();
        },
        {
          config_id: start.configurationId,
          response_type: "code",
          override_default_response_type: true,
          extras: {
            setup: {},
            sessionInfoVersion: start.sessionInfoVersion,
          },
        },
      );
    } catch (error) {
      setUiError(errorMessage(error));
      setStatusText(null);
      resetFlow();
    }
  };

  const data = connection.data;
  const busy = actions.start.isPending || actions.complete.isPending || completingRef.current;

  return (
    <Card className="overflow-hidden border-[#25D366]/25">
      <CardHeader className="bg-[#25D366]/5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Link2 className="size-5 text-[#128C7E]" />
              <CardTitle>Conexão oficial Meta WhatsApp</CardTitle>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              O restaurante conecta a própria conta pela janela oficial da Meta. O Comandiva valida WABA e número no backend e guarda a credencial no Vault; nenhum token é exibido nesta tela.
            </p>
          </div>
          <Badge variant={data?.connected ? "default" : "secondary"} className="w-fit">
            {data?.connected ? "Conectado" : "Não conectado"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-6">
        {data?.connected ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ConnectionMetric label="Número" value={data.display_phone_number || data.phone_number_id || "—"} />
            <ConnectionMetric label="Nome verificado" value={data.verified_name || "—"} />
            <ConnectionMetric label="Qualidade" value={data.quality_rating || "—"} />
            <ConnectionMetric label="Templates na Meta" value={String(data.template_count ?? 0)} />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-5">
            <p className="font-semibold">Nenhuma conta Meta conectada</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {automaticEntitled
                ? "Quando a configuração do app Meta estiver liberada, a conexão será feita por Embedded Signup sem colar tokens manualmente."
                : "O envio automático é um add-on. Ative o módulo para liberar a conexão oficial."}
            </p>
          </div>
        )}

        {data?.connected ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-xl border border-border p-3">
              <ShieldCheck className="size-5 text-[#128C7E]" />
              <div>
                <p className="text-xs text-muted-foreground">Webhook</p>
                <p className="text-sm font-semibold">{data.webhook_subscribed ? "Assinado" : "Pendente"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border p-3">
              <CheckCircle2 className="size-5 text-[#128C7E]" />
              <div>
                <p className="text-xs text-muted-foreground">Conectado em</p>
                <p className="text-sm font-semibold">{formatDate(data.connected_at)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border p-3">
              <RefreshCw className="size-5 text-[#128C7E]" />
              <div>
                <p className="text-xs text-muted-foreground">Credencial</p>
                <p className="text-sm font-semibold">{data.token_expires_at ? `até ${formatDate(data.token_expires_at)}` : "Gerenciada no backend"}</p>
              </div>
            </div>
          </div>
        ) : null}

        {data?.last_error ? (
          <p className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            A integração anterior precisa de atenção. Use Reconectar para gerar uma nova sessão segura.
          </p>
        ) : null}
        {uiError ? (
          <p className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{uiError}</p>
        ) : null}
        {statusText ? (
          <p className="flex items-center gap-2 rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            {statusText}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void startConnection()} disabled={!automaticEntitled || busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
            {data?.connected ? "Reconectar WhatsApp" : "Conectar WhatsApp"}
          </Button>
          {!automaticEntitled ? (
            <span className="text-xs font-medium text-muted-foreground">Add-on WhatsApp Automático necessário.</span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function ConnectionMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-semibold" title={value}>{value}</p>
    </div>
  );
}
