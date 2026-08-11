import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { AlertTriangle, ArrowLeft, RefreshCcw } from "lucide-react";

import appCss from "../styles.css?url";
import premiumCss from "../premium.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "@/auth/AuthProvider";
import { SkipToContent } from "@/components/a11y/SkipToContent";
import { NotFoundPage } from "@/components/feedback/NotFoundPage";
import { RouteProgress } from "@/components/feedback/RouteProgress";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider, themeInitScript, useTheme } from "@/lib/theme";

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <main className="pa-error">
      <section className="pa-error-card" role="alert">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#12d8c1]/10 text-[#12d8c1]">
          <AlertTriangle className="size-6" />
        </div>
        <p className="mt-6 text-xs font-black uppercase tracking-[.18em] text-[#8ff5e9]">Pediu Aqui</p>
        <h1 className="pa-display mt-3 text-3xl font-bold sm:text-4xl">Não conseguimos abrir esta tela.</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-white/58">
          A página encontrou uma falha inesperada. Você pode tentar novamente sem perder o restante da aplicação.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#12d8c1] px-5 text-sm font-extrabold text-[#071318] transition hover:bg-[#58ead9]"
          >
            <RefreshCcw className="size-4" /> Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/13 bg-white/4 px-5 text-sm font-bold text-white/78 transition hover:bg-white/8"
          >
            <ArrowLeft className="size-4" /> Voltar ao início
          </a>
        </div>
      </section>
    </main>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { title: "Pediu Aqui · Cardápio digital para o seu negócio" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "author", content: "Pediu Aqui" },
      { name: "theme-color", content: "#071318" },
      { name: "apple-mobile-web-app-title", content: "Pediu Aqui" },
      { property: "og:site_name", content: "Pediu Aqui" },
      { property: "og:locale", content: "pt_BR" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: premiumCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/brand/apple-touch-icon-180x180.png", sizes: "180x180" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundPage,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster position="top-center" richColors closeButton theme={theme} />;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <SkipToContent />
          <RouteProgress />
          <div id="conteudo"><Outlet /></div>
          <ThemedToaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
