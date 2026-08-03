import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { KeyRound, LogIn, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  getDemoCenterStatus,
  lockDemoCenter,
  requestDemoSession,
  unlockDemoCenter,
} from "@/lib/qa-demo.functions";

type Profile = {
  id: string;
  label: string;
  description: string;
  group: string;
  redirectTo: string;
};

export const Route = createFileRoute("/preview/demo")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Central Demo do Preview | Pediu Aqui" },
      {
        name: "description",
        content:
          "Acesso controlado às áreas do Pediu Aqui no ambiente de Preview, com sessões reais e sem senha fixa.",
      },
      { property: "og:title", content: "Central Demo do Preview | Pediu Aqui" },
      {
        property: "og:description",
        content: "Entrada única para revisar administrador, loja, cozinha e entregador no Preview.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: DemoCenter,
});

/** Encerra tudo que pertence à sessão anterior antes de autenticar outra conta. */
async function teardownSession(clearQueries: () => void) {
  try {
    await supabase.removeAllChannels();
  } catch {
    // sem canais ativos
  }
  await supabase.auth.signOut();
  clearQueries();

  try {
    const doomed = Object.keys(window.localStorage).filter((key) =>
      /cart|carrinho|wizard|checkout|tracking|courier|entregador|store_config/i.test(key),
    );
    doomed.forEach((key) => window.localStorage.removeItem(key));
    window.sessionStorage.clear();
  } catch {
    // storage indisponível
  }

  document.title = document.title.replace(/^\(\d+\)\s+/, "");
}

function DemoCenter() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const status = useServerFn(getDemoCenterStatus);
  const unlock = useServerFn(unlockDemoCenter);
  const lock = useServerFn(lockDemoCenter);
  const requestSession = useServerFn(requestDemoSession);

  const [state, setState] = useState<{
    loading: boolean;
    enabled: boolean;
    unlocked: boolean;
    profiles: Profile[];
  }>({ loading: true, enabled: false, unlocked: false, profiles: [] });
  const [accessKey, setAccessKey] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    const result = await status();
    setState({
      loading: false,
      enabled: result.enabled,
      unlocked: result.unlocked,
      profiles: (result.profiles ?? []) as Profile[],
    });
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUnlock(event: React.FormEvent) {
    event.preventDefault();
    setBusy("unlock");
    const result = await unlock({ data: { accessKey } });
    setBusy(null);
    setAccessKey("");
    if (!result.ok) {
      toast.error(
        result.reason === "rate_limited"
          ? "Muitas tentativas. Aguarde um minuto."
          : "Chave de acesso inválida.",
      );
      return;
    }
    await refresh();
  }

  async function handleEnter(profile: Profile) {
    setBusy(profile.id);
    try {
      const result = await requestSession({ data: { profileId: profile.id } });
      if (!result.ok) {
        toast.error(
          result.reason === "account_missing"
            ? "Conta demo não encontrada neste ambiente."
            : "Não foi possível abrir esta sessão demo.",
        );
        return;
      }

      await teardownSession(() => queryClient.clear());

      const { error } = await supabase.auth.verifyOtp({
        type: "email",
        token_hash: result.tokenHash,
      });
      if (error) {
        toast.error("A sessão demo não foi validada. Tente novamente.");
        return;
      }

      await router.invalidate();
      await router.navigate({ to: result.redirectTo });
    } finally {
      setBusy(null);
    }
  }

  if (state.loading) {
    return <main className="p-6 text-sm text-muted-foreground">Carregando Central Demo…</main>;
  }

  if (!state.enabled) {
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="text-lg font-semibold">Indisponível</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A Central Demo existe apenas em ambientes de Preview, desenvolvimento e staging.
        </p>
      </main>
    );
  }

  const groups = Array.from(new Set(state.profiles.map((profile) => profile.group)));

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header>
        <Badge variant="outline" className="gap-1">
          <ShieldAlert className="size-3" /> Somente Preview
        </Badge>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Central Demo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Entre em cada área com uma sessão de autenticação real. Nenhuma senha fica no código e
          nenhuma conta demo existe em produção.
        </p>
      </header>

      {!state.unlocked ? (
        <form onSubmit={handleUnlock} className="mt-8 space-y-3 rounded-xl border border-border bg-surface p-5">
          <label htmlFor="qa-key" className="text-sm font-medium">
            Chave de acesso do Preview
          </label>
          <Input
            id="qa-key"
            type="password"
            autoComplete="off"
            value={accessKey}
            onChange={(event) => setAccessKey(event.target.value)}
            placeholder="Informe a chave configurada no ambiente"
          />
          <Button type="submit" disabled={busy === "unlock" || accessKey.length < 8} className="gap-2">
            <KeyRound className="size-4" />
            Liberar Central Demo
          </Button>
          <p className="text-xs text-muted-foreground">
            A chave é validada no servidor, em tempo constante, e libera uma capacidade temporária de
            30 minutos.
          </p>
        </form>
      ) : (
        <div className="mt-8 space-y-8">
          {groups.map((group) => (
            <section key={group}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {group}
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {state.profiles
                  .filter((profile) => profile.group === group)
                  .map((profile) => (
                    <article
                      key={profile.id}
                      className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-surface p-4 shadow-e1"
                    >
                      <div>
                        <h3 className="font-semibold">{profile.label}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{profile.description}</p>
                      </div>
                      <Button
                        onClick={() => void handleEnter(profile)}
                        disabled={busy !== null}
                        size="touch"
                        className="gap-2"
                      >
                        <LogIn className="size-4" />
                        {busy === profile.id ? "Abrindo sessão…" : "Entrar"}
                      </Button>
                    </article>
                  ))}
              </div>
            </section>
          ))}

          <div className="flex flex-wrap gap-3 border-t border-border pt-6">
            <Button variant="outline" onClick={() => void router.navigate({ to: "/loja/$slug", params: { slug: "mercado-aurora" } })}>
              Abrir cardápio público
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                await teardownSession(() => queryClient.clear());
                await lock();
                await refresh();
              }}
            >
              Encerrar sessão demo
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
