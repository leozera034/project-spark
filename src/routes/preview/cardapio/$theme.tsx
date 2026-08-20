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
      <div className="fixed left-3 top-3 z-50 flex max-w-[calc(100vw-1.5rem)] items-center gap-2 sm:left-4 sm:top-4">
        <Link
          to="/preview/cardapio"
          className="rounded-full border border-white/25 bg-black/55 px-3 py-2 text-xs font-bold text-white shadow-lg backdrop-blur-md"
        >
          ← Todos os cardápios
        </Link>
        <span className="truncate rounded-full border border-white/25 bg-black/55 px-3 py-2 text-xs font-bold text-white shadow-lg backdrop-blur-md">
          Preview · {STOREFRONT_PREVIEW_THEME_META[theme].label}
        </span>
      </div>
      <StorefrontThemePreview theme={theme} />
    </div>
  );
}
