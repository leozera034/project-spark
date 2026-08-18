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
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider, themeInitScript, useTheme } from "@/lib/theme";
import {
  OG_IMAGE_PATH,
  PUBLIC_SITE_ORIGIN,
  SOCIAL_IMAGE_ALT,
  TWITTER_IMAGE_PATH,
  absoluteUrl,
  getCanonicalUrl,
} from "@/lib/site.functions";

const defaultDescription =
  "Cardápio digital, pedidos, cozinha, entregas e gestão em uma plataforma completa para restaurantes, lanchonetes, pizzarias e comércio local.";

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
  loader: () => getCanonicalUrl(),
  head: ({ loaderData }) => {
    const canonicalUrl = loaderData || `${PUBLIC_SITE_ORIGIN}/`;
    let siteOrigin = PUBLIC_SITE_ORIGIN;
    try {
      siteOrigin = new URL(canonicalUrl).origin;
    } catch {
      // Mantém o fallback oficial do Lovable.
    }
    const ogImage = absoluteUrl(siteOrigin, OG_IMAGE_PATH);
    const twitterImage = absoluteUrl(siteOrigin, TWITTER_IMAGE_PATH);
    const logo = absoluteUrl(siteOrigin, "/brand/android-icon-512x512.png");

    return {
      meta: [
        { charSet: "utf-8" },
        { title: "Comandiva · Cardápio digital para o seu negócio" },
        { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
        { name: "author", content: "Comandiva" },
        { name: "application-name", content: "Comandiva" },
        { name: "theme-color", content: "#06030D" },
        { name: "color-scheme", content: "dark light" },
        { name: "format-detection", content: "telephone=no" },
        { name: "mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
        { name: "apple-mobile-web-app-title", content: "Comandiva" },
        { name: "msapplication-TileColor", content: "#06030D" },
        { property: "og:site_name", content: "Comandiva" },
        { property: "og:locale", content: "pt_BR" },
        { property: "og:type", content: "website" },
        { property: "og:url", content: canonicalUrl },
        { property: "og:image", content: ogImage },
        { property: "og:image:secure_url", content: ogImage },
        { property: "og:image:type", content: "image/png" },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:image:alt", content: SOCIAL_IMAGE_ALT },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: twitterImage },
        { name: "twitter:image:alt", content: SOCIAL_IMAGE_ALT },
      ],
      links: [
        { rel: "canonical", href: canonicalUrl },
        { rel: "stylesheet", href: appCss },
        { rel: "stylesheet", href: purpleCss },
        { rel: "stylesheet", href: globalPolishCss },
        { rel: "stylesheet", href: storefrontPolishCss },
        { rel: "stylesheet", href: referenceUiCss },
        { rel: "stylesheet", href: internalOpsCss },
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
        { rel: "icon", href: "/brand/favicon-32x32.png", type: "image/png", sizes: "32x32" },
        { rel: "icon", href: "/brand/favicon-16x16.png", type: "image/png", sizes: "16x16" },
        { rel: "apple-touch-icon", href: "/brand/apple-touch-icon-180x180.png", sizes: "180x180" },
        { rel: "manifest", href: "/site.webmanifest" },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Organization",
                "@id": `${siteOrigin}/#organization`,
                name: "Comandiva",
                url: `${siteOrigin}/`,
                logo: {
                  "@type": "ImageObject",
                  url: logo,
                  width: 512,
                  height: 512,
                },
                description: defaultDescription,
              },
              {
                "@type": "WebSite",
                "@id": `${siteOrigin}/#website`,
                url: `${siteOrigin}/`,
                name: "Comandiva",
                description: defaultDescription,
                inLanguage: "pt-BR",
                publisher: { "@id": `${siteOrigin}/#organization` },
              },
              {
                "@type": "WebApplication",
                "@id": `${siteOrigin}/#app`,
                name: "Comandiva",
                url: `${siteOrigin}/`,
                applicationCategory: "BusinessApplication",
                operatingSystem: "Web",
                inLanguage: "pt-BR",
                description: defaultDescription,
                image: ogImage,
                featureList: [
                  "Cardápio digital",
                  "Gestão de pedidos",
                  "Operação de cozinha",
                  "Entregas próprias",
                  "Relatórios operacionais",
                  "Gestão multi-loja",
                ],
                publisher: { "@id": `${siteOrigin}/#organization` },
              },
            ],
          }),
        },
      ],
    };
  },

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
          <ThemedToaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
