import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, RefreshCcw } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "@/auth/AuthProvider";
import { SkipToContent } from "@/components/a11y/SkipToContent";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { NotFoundPage } from "@/components/feedback/NotFoundPage";
import { RouteProgress } from "@/components/feedback/RouteProgress";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider, themeInitScript, useTheme } from "@/lib/theme";

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  function retry() {
    void router.invalidate().finally(() => reset());
  }

  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden bg-carbon px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] text-carbon-foreground">
      <div className="pointer-events-none absolute -left-40 -top-40 size-[34rem] rounded-full bg-brand/14 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 -right-32 size-[34rem] rounded-full bg-brand/8 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.045] [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:46px_46px]" />

      <div className="relative w-full max-w-lg">
        <a href="/" className="mb-5 inline-flex" aria-label="Pediu Aqui, voltar ao início">
          <BrandLogo lockup="horizontal" className="h-8 w-auto" />
        </a>

        <section className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_32px_100px_-42px_rgba(0,0,0,0.9)] backdrop-blur-2xl sm:p-7">
          <div className="flex size-11 items-center justify-center rounded-xl border border-danger/20 bg-danger/10 text-danger">
            <AlertTriangle className="size-5" />
          </div>
          <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.16em] text-brand">
            Falha temporária
          </p>
          <h1 className="mt-2 text-3xl font-bold leading-tight tracking-[-0.035em] text-white sm:text-4xl">
            Não conseguimos carregar esta página.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-white/52">
            Ocorreu uma falha inesperada. Tente carregar novamente; se o problema continuar, volte
            ao início e refaça o acesso.
          </p>

          <div className="mt-5 flex items-start gap-3 rounded-xl border border-white/8 bg-black/15 p-3.5 text-xs leading-5 text-white/48">
            <span className="mt-1 size-2 shrink-0 rounded-full bg-brand shadow-[0_0_14px_color-mix(in_oklab,var(--color-brand)_75%,transparent)]" />
            <span>O erro foi encaminhado para a observabilidade da aplicação sem expor dados sensíveis.</span>
          </div>

          <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
            <Button variant="brand" size="touch" onClick={retry}>
              <RefreshCcw className="size-4" />
              Tentar novamente
            </Button>
            <Button asChild variant="outline" size="touch" className="border-white/15 bg-white/[0.03] text-white hover:bg-white/8 hover:text-white">
              <a href="/">
                <ArrowLeft className="size-4" />
                Voltar ao início
              </a>
            </Button>
          </div>
        </section>
      </div>
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
      { name: "theme-color", content: "#0B171C" },
      { name: "apple-mobile-web-app-title", content: "Pediu Aqui" },
      { property: "og:site_name", content: "Pediu Aqui" },
      { property: "og:locale", content: "pt_BR" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Manrope:wght@400;500;600;700&display=swap",
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
          <div id="conteudo">
            <Outlet />
          </div>
          <ThemedToaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
