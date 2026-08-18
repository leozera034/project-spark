import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { PUBLIC_SITE_ORIGIN } from "@/lib/site.functions";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

/** Lojas ativas são páginas públicas indexáveis; as demais ficam fora do sitemap. */
async function activeStorePaths(): Promise<SitemapEntry[]> {
  try {
    const { invokePediuPublicSupport } = await import(
      "@/integrations/supabase/public-support.server"
    );
    const slugs = await invokePediuPublicSupport<string[]>({ action: "store_slugs" });
    return slugs
      .filter((slug) => typeof slug === "string" && slug.length > 0)
      .map((slug) => ({ path: `/loja/${slug}`, changefreq: "daily" as const, priority: "0.8" }));
  } catch {
    return [];
  }
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function requestOrigin() {
  try {
    const { getRequestUrl } = await import("@tanstack/react-start/server");
    return getRequestUrl({ xForwardedHost: true, xForwardedProto: true }).origin;
  } catch {
    return PUBLIC_SITE_ORIGIN;
  }
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const baseUrl = (await requestOrigin()).replace(/\/$/, "");
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/criar-loja", changefreq: "monthly", priority: "0.9" },
          ...(await activeStorePaths()),
        ];

        const urls = entries.map((entry) =>
          [
            "  <url>",
            `    <loc>${escapeXml(`${baseUrl}${entry.path}`)}</loc>`,
            entry.changefreq ? `    <changefreq>${entry.changefreq}</changefreq>` : null,
            entry.priority ? `    <priority>${entry.priority}</priority>` : null,
            "  </url>",
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...urls,
          "</urlset>",
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
            "X-Robots-Tag": "noindex, follow",
          },
        });
      },
    },
  },
});
