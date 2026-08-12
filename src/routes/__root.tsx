import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import purpleCss from "../purple-overrides.css?url";
import globalPolishCss from "../app-global-polish.css?url";
import storefrontPolishCss from "../storefront-global.css?url";
import referenceUiCss from "../reference-ui.css?url";
import internalOpsCss from "../internal-ops-polish.css?url";
import storefrontExperienceV2Css from "../storefront-experience-v2.css?url";
import storefrontExperienceV3Css from "../storefront-experience-v3.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "@/auth/AuthProvider";
import { SkipToContent } from "@/components/a11y/SkipToContent";
import {
  AppErrorScreen,
  classifyAppError,
  recoverFromStaleBuild,
} from "@/components/feedback/AppErrorScreen";
import { NotFoundPage } from "@/components/feedback/NotFoundPage";
import { RouteProgress } from "@/components/feedback/RouteProgress";
import { DemoAccountSwitcher } from "@/components/qa/DemoAccountSwitcher";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider, themeInitScript, useTheme } from "@/lib/theme";

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const kind = classifyAppError(error);

  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  useEffect(() => {
    if (kind === "stale_build") recoverFromStaleBuild();
  }, [kind]);

  return (
    <AppErrorScreen
      kind={kind}
      detail={import.meta.env.DEV ? (error.stack ?? error.message) : undefined}
      onRetry={() => {
        void router.invalidate();
        reset();
      }}
    />
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { title: "Pediu Aqui · Cardápio digital para o seu negócio" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "author", content: "Pediu Aqui" },
      { name: "theme-color", content: "#07030D" },
      { name: "apple-mobile-web-app-title", content: "Pediu Aqui" },
      { property: "og:site_name", content: "Pediu Aqui" },
      { property: "og:locale", content: "pt_BR" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: purpleCss },
      { rel: "stylesheet", href: globalPolishCss },
      { rel: "stylesheet", href: storefrontPolishCss },
      { rel: "stylesheet", href: referenceUiCss },
      { rel: "stylesheet", href: internalOpsCss },
      { rel: "stylesheet", href: storefrontExperienceV2Css },
      { rel: "stylesheet", href: storefrontExperienceV3Css },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
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

  useEffect(() => {
    function onRejection(event: PromiseRejectionEvent) {
      if (classifyAppError(event.reason) === "stale_build") recoverFromStaleBuild();
    }
    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <SkipToContent />
          <RouteProgress />
          <div id="conteudo">
            <Outlet />
          </div>
          <DemoAccountSwitcher />
          <ThemedToaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
