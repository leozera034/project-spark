import { Link, createFileRoute } from "@tanstack/react-router";
import { Eye, Store } from "lucide-react";

import { STOREFRONT_PREVIEW_THEME_META } from "@/components/storefront/StorefrontThemePreview";
import { getDefaultStoreBanner, type StorefrontThemeProfile } from "@/storefront/default-banners";

export const Route = createFileRoute("/preview/cardapio/")({
  head: () => ({
    meta: [
      { title: "Previews de cardápio | Comandiva" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: StorefrontPreviewGallery,
});

const THEMES = Object.keys(STOREFRONT_PREVIEW_THEME_META) as StorefrontThemeProfile[];

function StorefrontPreviewGallery() {
  return (
    <main className="min-h-svh bg-background px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-surface px-3 py-1.5 text-xs font-bold text-muted-foreground shadow-sm">
              <Eye className="size-3.5" /> QA visual permanente
            </div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Previews dos cardápios</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Acompanhe como cada modelo predefinido aparece para o cliente. Estes previews não usam nenhuma loja real.
            </p>
          </div>
          <Link to="/preview/wizard" className="inline-flex min-h-11 items-center justify-center rounded-xl border bg-surface px-4 text-sm font-bold shadow-sm">
            Ver previews do Wizard
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {THEMES.map((theme) => {
            const meta = STOREFRONT_PREVIEW_THEME_META[theme];
            const Icon = meta.Icon;
            return (
              <Link
                key={theme}
                to="/preview/cardapio/$theme"
                params={{ theme }}
                className="group overflow-hidden rounded-3xl border bg-surface shadow-sm transition hover:-translate-y-0.5 hover:shadow-e2"
              >
                <div className="relative h-36 overflow-hidden">
                  <img src={getDefaultStoreBanner(theme)} alt="" className="size-full object-cover transition duration-300 group-hover:scale-[1.02]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />
                  <div className="absolute bottom-3 left-3 grid size-11 place-items-center rounded-2xl border border-white/30 bg-white/90 text-brand shadow-lg backdrop-blur">
                    <Icon className="size-5" />
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-extrabold">{meta.label}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{meta.storeName}</p>
                    </div>
                    <Store className="size-5 text-muted-foreground transition group-hover:text-brand" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
