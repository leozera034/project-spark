import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ExternalLink,
  Link2,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStoreGoogleBusinessActions, useStoreGoogleBusinessConnection } from "@/store/integrations/store-google-business.queries";
import { useStoreScope } from "@/store-scope/StoreScopeProvider";

export const Route = createFileRoute("/app/loja/google-business")({
  head: () => ({
    meta: [
      { title: "Google Business Sync | Comandiva" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: GoogleBusinessPage,
});

function statusCopy(status: string | undefined) {
  if (status === "connected") return "Conectado";
  if (status === "degraded") return "Conectado com pendência";
  if (status === "pending") return "Conectando";
  if (status === "disabled") return "Desativado";
  return "Não conectado";
}

function actionErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "GOOGLE_BUSINESS_RUNTIME_NOT_CONFIGURED") {
    return "O OAuth do Google Business ainda não foi configurado no backend.";
  }
  if (message === "FORBIDDEN") return "Sua conta não tem permissão para conectar o Google desta loja.";
  return "Não foi possível iniciar a conexão com o Google Business.";
}

function GoogleBusinessPage() {
  const { storeId } = useStoreScope();
  const connection = useStoreGoogleBusinessConnection(storeId);
  const actions = useStoreGoogleBusinessActions();
  const data = connection.data;
  const oauthConnected = data?.status === "connected" || data?.status === "degraded";
  const apiReady = Boolean(data?.api_healthy);
  const locationSelected = Boolean(data?.selected_location_name);

  if (!storeId) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-muted-foreground">
        Nenhuma loja vinculada a esta conta.
      </div>
    );
  }

  const startConnection = async () => {
    try {
      const result = await actions.start.mutateAsync(storeId);
      window.location.assign(result.authorizationUrl);
    } catch (error) {
      toast.error(actionErrorMessage(error));
    }
  };

  const disconnect = async () => {
    try {
      await actions.disconnect.mutateAsync(storeId);
      toast.success("Google Business desconectado desta loja.");
    } catch {
      toast.error("Não foi possível desconectar o Google Business agora.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#4B1D6D] p-6 text-white shadow-e2 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-[#FF6A4D]/20 blur-3xl" />
        <div className="relative max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold">
            <Building2 className="size-3.5 text-[#FFB4A2]" /> Google Business Profile
          </div>
          <h1 className="font-display text-3xl font-black tracking-tight sm:text-4xl">Google Business Sync</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
            Conecte o Perfil da Empresa com OAuth seguro. Nesta primeira etapa o Comandiva apenas autentica, verifica acesso e prepara a sincronização — nenhum dado do Google é sobrescrito automaticamente.
          </p>
        </div>
      </header>

      {connection.isError ? (
        <Card className="border-destructive/30">
          <CardContent className="flex items-start gap-3 p-5 text-sm text-muted-foreground">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
            Não foi possível consultar o estado da integração. Nenhuma sincronização é executada enquanto o backend não confirmar a conexão.
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border bg-muted/30">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="size-5 text-primary" /> Conexão da loja
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                OAuth e acesso à Business Profile API são gates separados. O Google pode autorizar sua conta antes de liberar a API para o projeto do Comandiva.
              </p>
            </div>
            <Badge variant={apiReady ? "default" : "outline"}>{statusCopy(data?.status)}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatusItem
              label="OAuth Google"
              value={oauthConnected ? "Autorizado" : "Pendente"}
              ready={oauthConnected}
            />
            <StatusItem
              label="Business Profile API"
              value={apiReady ? "Disponível" : oauthConnected ? "Aguardando liberação" : "Não validada"}
              ready={apiReady}
            />
            <StatusItem
              label="Contas encontradas"
              value={String(data?.account_count ?? 0)}
              ready={(data?.account_count ?? 0) > 0}
            />
            <StatusItem
              label="Unidade selecionada"
              value={data?.selected_location_title ?? "Ainda não selecionada"}
              ready={locationSelected}
            />
          </div>

          {data?.status === "degraded" ? (
            <div className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning-soft/40 p-4 text-sm text-muted-foreground">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" />
              <div>
                <p className="font-semibold text-foreground">OAuth concluído, mas a API ainda não está pronta.</p>
                <p className="mt-1">
                  As credenciais foram guardadas com segurança. O Comandiva não considera a integração operacional até a Business Profile API responder corretamente.
                </p>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button onClick={startConnection} disabled={actions.start.isPending || connection.isLoading}>
              <ExternalLink className="mr-2 size-4" />
              {oauthConnected ? "Reconectar Google" : "Conectar Google"}
            </Button>
            {data?.configured ? (
              <Button variant="outline" onClick={disconnect} disabled={actions.disconnect.isPending}>
                <Unplug className="mr-2 size-4" /> Desconectar
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-5 text-success" /> Proteções já aplicadas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <ProtectionItem>Tokens OAuth não ficam no frontend nem em tabelas públicas.</ProtectionItem>
            <ProtectionItem>O callback usa state aleatório, hash no banco e expiração curta.</ProtectionItem>
            <ProtectionItem>Falha ou falta de aprovação da API deixa a conexão em modo degradado.</ProtectionItem>
            <ProtectionItem>O Comandiva continua como fonte de verdade; ainda não há escrita automática no Google.</ProtectionItem>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Próxima etapa da integração</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Depois que a API estiver saudável, o fluxo seguirá esta ordem:</p>
            <ol className="space-y-2 pl-5 list-decimal">
              <li>listar contas e unidades acessíveis;</li>
              <li>o lojista escolher explicitamente a unidade correta;</li>
              <li>importar e comparar dados Google × Comandiva;</li>
              <li>habilitar sincronização por campo somente após confirmação.</li>
            </ol>
            <p className="rounded-2xl bg-muted/60 p-3">
              Cardápio, avaliações e posts ficam bloqueados até essa seleção e comparação estarem concluídas.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatusItem({ label, value, ready }: { label: string; value: string; ready: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {ready ? <CheckCircle2 className="size-4 text-success" /> : <span className="size-2 rounded-full bg-muted-foreground/40" />}
        {label}
      </div>
      <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ProtectionItem({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
      <span>{children}</span>
    </div>
  );
}
