import type { CSSProperties, ReactNode } from "react";

import { CustomerWizard } from "@/components/storefront/CustomerWizard";
import "@/components/storefront/wizard-theme.css";
import {
  getDefaultThemeLogo,
  getDefaultWizardDesktopBackground,
  getDefaultWizardMobileBackground,
  getStorefrontThemeVisual,
} from "@/storefront/default-banners";

type ThemeStyle = CSSProperties & {
  "--foreground": string;
  "--muted-foreground": string;
  "--brand": string;
  "--brand-foreground": string;
  "--background": string;
  "--card": string;
  "--card-foreground": string;
  "--input": string;
  "--ring": string;
  "--wizard-field-bg": string;
  "--wizard-field-fg": string;
  "--wizard-field-placeholder": string;
  "--wizard-field-border": string;
};

export function WizardThemeFrame({
  segment,
  children,
  topSlot,
}: {
  segment: string | null | undefined;
  children: ReactNode;
  topSlot?: ReactNode;
}) {
  const mobileBackgroundUrl = getDefaultWizardMobileBackground(segment);
  const desktopBackgroundUrl = getDefaultWizardDesktopBackground(segment);
  const logoUrl = getDefaultThemeLogo(segment);
  const visual = getStorefrontThemeVisual(segment);
  const themeStyle: ThemeStyle = {
    "--foreground": visual.foreground,
    "--muted-foreground": visual.mutedForeground,
    "--brand": visual.brand,
    "--brand-foreground": visual.brandForeground,
    "--background": visual.background,
    "--card": visual.surface,
    "--card-foreground": visual.surfaceForeground,
    "--input": visual.inputBorder,
    "--ring": visual.brand,
    "--wizard-field-bg": "#ffffff",
    "--wizard-field-fg": "#111111",
    "--wizard-field-placeholder": "rgba(17,17,17,.48)",
    "--wizard-field-border": "rgba(17,17,17,.18)",
  };

  const scrimStyle: CSSProperties = {
    background:
      "linear-gradient(to bottom, transparent 0%, transparent 18%, color-mix(in oklch, var(--background) 10%, transparent) 38%, color-mix(in oklch, var(--background) 22%, transparent) 66%, color-mix(in oklch, var(--background) 38%, transparent) 100%)",
  };

  return (
    <div
      className="wizard-theme-frame relative min-h-svh overflow-x-hidden bg-background text-foreground [&_main]:!bg-transparent"
      style={themeStyle}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-cover bg-center bg-no-repeat md:hidden"
        style={{ backgroundImage: `url(${JSON.stringify(mobileBackgroundUrl)})` }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 hidden bg-cover bg-center bg-no-repeat md:block"
        style={{ backgroundImage: `url(${JSON.stringify(desktopBackgroundUrl)})` }}
      />

      <div aria-hidden="true" className="pointer-events-none fixed inset-0" style={scrimStyle} />

      <div className="relative z-30 mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6 sm:pt-5">
        {topSlot}
        <div className="mx-auto mt-3 flex w-full max-w-xl justify-center sm:mt-4">
          <img
            src={logoUrl}
            alt="Comandiva"
            className="h-auto w-full max-w-[92px] object-contain sm:max-w-[104px] md:max-w-[112px]"
            style={{ filter: visual.logoFilter }}
          />
        </div>
      </div>

      <div className="relative z-20">{children}</div>
    </div>
  );
}

export function ThemedCustomerWizard({ segment }: { segment: string | null | undefined }) {
  return (
    <WizardThemeFrame segment={segment}>
      <CustomerWizard />
    </WizardThemeFrame>
  );
}
