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
import comandivaCss from "../comandiva-theme.css?url";
import tasteSkillCss from "../taste-skill-polish.css?url";
import merchantUiverseCss from "../merchant-uiverse-polish.css?url";
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
import {
  getPublicSupabaseBrowserConfig,
  type PublicSupabaseBrowserConfig,
} from "@/integrations/supabase/public-config.functions";
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

const unavailableSupabaseConfig: PublicSupabaseBrowserConfig = {
  url: "https://ypgteuxzgqmkkkpvibhi.supabase.co",
  publishableKey: null,
};

function serializeSupabaseBootstrap(config: PublicSupabaseBrowserConfig) {
  const serialized = JSON.stringify(config).replace(/</g, "\\u003c");
  return `window.__COMANDIVA_SUPABASE__=${serialized};`;
}

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
  loader: async () => {
    const [canonicalUrl, supabaseConfig] = await Promise.all([
      getCanonicalUrl(),
      getPublicSupabaseBrowserConfig().catch((error) => {
        console.error("[Supabase] public browser bootstrap unavailable", error);
        return unavailableSupabaseConfig;
      }),
    ]);
    return { canonicalUrl, supabaseConfig };
  },
  head: ({ loaderData }) => {
    const canonicalUrl = loaderData?.canonicalUrl || `${PUBLIC_SITE_ORIGIN}/`;
    let siteOrigin = PUBLIC_SITE_ORIGIN;
    try {
      siteOrigin = new URL(canonicalUrl).origin;
    } catch {
      // Mantém o fallback oficial da publicação atual.
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
        { name: "theme-color", content: "#FFF6F1" },
        { name: "color-scheme", content: "light dark" },
        { name: "format-detection", content: "telephone=no" },
        { name: "mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-status-bar-style", content: "default" },
        { name: "apple-mobile-web-app-title", content: "Comandiva" },
        { name: "msapplication-TileColor", content: "#4B1D6D" },
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
        { rel: "stylesheet", href: comandivaCss },
        { rel: "stylesheet", href: tasteSkillCss },
        { rel: "stylesheet", href: merchantUiverseCss },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossOrigin: "anonymous",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Poppins:wght@600;700;800&display=swap",
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
  const { supabaseConfig } = Route.useLoaderData();

  useEffect(() => {
    function onRejection(event: PromiseRejectionEvent) {
      if (classifyAppError(event.reason) === "stale_build") recoverFromStaleBuild();
    }
    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <script
        id="comandiva-supabase-public-config"
        dangerouslySetInnerHTML={{ __html: serializeSupabaseBootstrap(supabaseConfig) }}
      />
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
