import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
  initializeAnalytics,
  readAnalyticsConsent,
  trackPageView,
  writeAnalyticsConsent,
  type AnalyticsConsent as AnalyticsConsentValue,
} from "@/lib/analytics";

export function AnalyticsConsent() {
  const location = useLocation();
  const [consent, setConsent] = useState<AnalyticsConsentValue>("unset");

  useEffect(() => {
    const current = readAnalyticsConsent();
    setConsent(current);
    if (current === "accepted") initializeAnalytics();
  }, []);

  useEffect(() => {
    if (consent === "accepted") trackPageView(location.href);
  }, [consent, location.href]);

  function choose(value: Exclude<AnalyticsConsentValue, "unset">) {
    writeAnalyticsConsent(value);
    setConsent(value);
    if (value === "accepted") {
      initializeAnalytics();
      trackPageView(location.href);
    }
  }

  if (consent !== "unset") return null;

  return (
    <aside
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-3xl rounded-2xl border border-border bg-background p-4 shadow-2xl sm:bottom-5 sm:p-5"
      role="dialog"
      aria-label="Preferências de privacidade"
      aria-live="polite"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl">
          <p className="font-semibold text-foreground">Privacidade e medição</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Cookies necessários mantêm o site funcionando. Com sua autorização, também podemos usar
            analytics e pixels de publicidade para medir aquisição e melhorar campanhas. Você pode
            rejeitar sem perder as funções essenciais. Veja a{" "}
            <Link to="/privacidade" className="font-medium text-primary underline-offset-4 hover:underline">
              Política de Privacidade
            </Link>.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
          <button
            type="button"
            onClick={() => choose("rejected")}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            Rejeitar opcionais
          </button>
          <button
            type="button"
            onClick={() => choose("accepted")}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Aceitar medição
          </button>
        </div>
      </div>
    </aside>
  );
}
