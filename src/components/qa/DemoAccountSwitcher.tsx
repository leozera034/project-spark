import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, FlaskConical, LogIn, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getDemoCenterStatus, requestDemoSession } from "@/lib/qa-demo.functions";

type Profile = {
  id: string;
  label: string;
  description: string;
  group: string;
  redirectTo: string;
};

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
}

export function DemoAccountSwitcher() {
  const router = useRouter();
  const location = useLocation();
  const queryClient = useQueryClient();
  const status = useServerFn(getDemoCenterStatus);
  const requestSession = useServerFn(requestDemoSession);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void status().then((result) => {
      if (!active) return;
      setEnabled(Boolean(result.enabled && result.unlocked));
      setProfiles((result.profiles ?? []) as Profile[]);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [status]);

  if (!enabled || location.pathname.startsWith("/preview/demo")) return null;

  async function switchTo(profile: Profile) {
    setBusy(profile.id);
    try {
      const result = await requestSession({ data: { profileId: profile.id } });
      if (!result.ok) {
        toast.error(result.reason === "account_missing" ? "Conta demo não encontrada." : "Não foi possível trocar a conta demo.");
        return;
      }

      await teardownSession(() => queryClient.clear());
      const { error } = await supabase.auth.verifyOtp({ type: "email", token_hash: result.tokenHash });
      if (error) {
        toast.error("A nova sessão demo não pôde ser validada.");
        return;
      }

      setOpen(false);
      await router.invalidate();
      await router.navigate({ to: result.redirectTo });
      toast.success(`Sessão alterada para ${profile.label}.`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] right-3 z-[100] sm:bottom-5 sm:right-5">
      {open ? (
        <div className="mb-2 w-[min(92vw,360px)] overflow-hidden rounded-2xl border border-violet-400/20 bg-[#0b0712]/95 shadow-[0_24px_80px_rgba(0,0,0,.55)] backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <FlaskConical className="size-4 text-violet-300" /> Central QA
              </div>
              <p className="mt-1 text-xs leading-5 text-white/55">Troque de papel sem digitar senha. A sessão anterior é encerrada antes da nova.</p>
            </div>
            <Button size="icon" variant="ghost" className="size-8 text-white/60 hover:text-white" onClick={() => setOpen(false)} aria-label="Fechar troca de conta">
              <X className="size-4" />
            </Button>
          </div>

          <div className="space-y-2 p-3">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                disabled={busy !== null}
                onClick={() => void switchTo(profile)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[.035] p-3 text-left transition hover:border-violet-400/25 hover:bg-violet-500/[.08] disabled:opacity-50"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-white">{profile.label}</span>
                  <span className="mt-0.5 block text-xs leading-4 text-white/45">{profile.description}</span>
                </span>
                <LogIn className="size-4 shrink-0 text-violet-300" />
              </button>
            ))}
          </div>

          <div className="border-t border-white/10 px-4 py-3 text-[11px] text-white/40">
            Admin SaaS global não é disponibilizado como conta demo porque possui acesso a lojas reais.
          </div>
        </div>
      ) : null}

      <Button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="h-11 gap-2 rounded-full border border-violet-300/20 bg-violet-600 px-4 text-white shadow-[0_12px_35px_rgba(124,58,237,.35)] hover:bg-violet-500"
      >
        <FlaskConical className="size-4" />
        Trocar conta
        <ChevronDown className={`size-3.5 transition ${open ? "rotate-180" : ""}`} />
      </Button>
    </div>
  );
}
