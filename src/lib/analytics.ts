export type AnalyticsConsent = "accepted" | "rejected" | "unset";

type MetaPixelFn = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  loaded?: boolean;
  version?: string;
};

export const ANALYTICS_CONSENT_KEY = "comandiva.analytics-consent.v1";

const gaMeasurementId = (import.meta.env.VITE_GA_MEASUREMENT_ID ?? "").trim();
const metaPixelId = (import.meta.env.VITE_META_PIXEL_ID ?? "").trim();

let initialized = false;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: MetaPixelFn;
    _fbq?: MetaPixelFn;
  }
}

export function readAnalyticsConsent(): AnalyticsConsent {
  if (typeof window === "undefined") return "unset";
  const value = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
  return value === "accepted" || value === "rejected" ? value : "unset";
}

export function writeAnalyticsConsent(value: Exclude<AnalyticsConsent, "unset">) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ANALYTICS_CONSENT_KEY, value);
}

export function reopenAnalyticsPreferences() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ANALYTICS_CONSENT_KEY);
  // Reload removes third-party scripts from memory when someone revokes a previous acceptance.
  window.location.reload();
}

function injectScript(id: string, src: string) {
  if (document.getElementById(id)) return;
  const script = document.createElement("script");
  script.id = id;
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

function initGa4() {
  if (!gaMeasurementId) return;
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = (...args: unknown[]) => window.dataLayer?.push(args);
  window.gtag("js", new Date());
  window.gtag("config", gaMeasurementId, {
    anonymize_ip: true,
    allow_google_signals: false,
    send_page_view: false,
  });
  injectScript("comandiva-ga4", `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaMeasurementId)}`);
}

function initMetaPixel() {
  if (!metaPixelId || window.fbq) return;
  const fbq: MetaPixelFn = (...args: unknown[]) => {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue?.push(args);
  };
  fbq.queue = [];
  fbq.loaded = true;
  fbq.version = "2.0";
  window.fbq = fbq;
  window._fbq = fbq;
  injectScript("comandiva-meta-pixel", "https://connect.facebook.net/en_US/fbevents.js");
  window.fbq("init", metaPixelId);
}

export function initializeAnalytics() {
  if (typeof window === "undefined" || initialized || readAnalyticsConsent() !== "accepted") return;
  initialized = true;
  initGa4();
  initMetaPixel();
}

export function trackPageView(path: string) {
  if (readAnalyticsConsent() !== "accepted") return;
  initializeAnalytics();
  if (gaMeasurementId && window.gtag) {
    window.gtag("event", "page_view", {
      page_location: window.location.href,
      page_path: path,
      page_title: document.title,
    });
  }
  if (metaPixelId && window.fbq) window.fbq("track", "PageView");
}

export function trackAcquisitionEvent(
  name: "signup_started" | "signup_completed" | "store_created" | "checkout_started" | "subscription_started",
  params: Record<string, string | number | boolean> = {},
) {
  if (readAnalyticsConsent() !== "accepted") return;
  initializeAnalytics();
  if (gaMeasurementId && window.gtag) window.gtag("event", name, params);
  if (metaPixelId && window.fbq) window.fbq("trackCustom", name, params);
}

export function analyticsConfigured() {
  return { ga4: Boolean(gaMeasurementId), metaPixel: Boolean(metaPixelId) };
}
