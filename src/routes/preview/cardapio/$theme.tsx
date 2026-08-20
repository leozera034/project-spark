import { Link, createFileRoute } from "@tanstack/react-router";

import { StorefrontThemePreview, STOREFRONT_PREVIEW_THEME_META } from "@/components/storefront/StorefrontThemePreview";
import { resolveStorefrontThemeProfile } from "@/storefront/default-banners";

export const Route = createFileRoute("/preview/cardapio/$theme")({
  head: ({ params }) => ({
    meta: [
      { title: `Preview Cardápio ${params.theme} | Comandiva` },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: StorefrontThemePreviewRoute,
});

function StorefrontThemePreviewRoute() {
  const { theme: rawTheme } = Route.useParams();
  const theme = resolveStorefrontThemeProfile(rawTheme);

  return (
    <div className="relative">
      <div className="fixed left-4 top-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-2 sm:left-6 sm:top-6">
        <Link
          to="/preview/cardapio"
          className="rounded-2xl border border-black/5 bg-white/95 px-4 py-2.5 text-xs font-extrabold text-[#2b1813] shadow-[0_8px_24px_rgba(48,28,18,.14)] backdrop-blur-md sm:text-sm"
        >
          ← Todos os cardápios
        </Link>
        <span className="truncate rounded-2xl border border-black/5 bg-white/95 px-4 py-2.5 text-xs font-extrabold text-[#2b1813] shadow-[0_8px_24px_rgba(48,28,18,.14)] backdrop-blur-md sm:text-sm">
          Preview · {STOREFRONT_PREVIEW_THEME_META[theme].label}
        </span>
      </div>
      <StorefrontThemePreview theme={theme} />
    </div>
  );
}
