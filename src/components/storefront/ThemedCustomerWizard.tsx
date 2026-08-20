import type { CSSProperties, ReactNode } from "react";

import { CustomerWizard } from "@/components/storefront/CustomerWizard";
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
  };

  const scrimStyle: CSSProperties = {
    background:
      "linear-gradient(to bottom, transparent 0%, transparent 11%, color-mix(in oklch, var(--background) 54%, transparent) 31%, color-mix(in oklch, var(--background) 88%, transparent) 56%, color-mix(in oklch, var(--background) 98%, transparent) 100%)",
  };

  return (
    <div
      className="relative min-h-svh overflow-x-hidden bg-background text-foreground [&_main]:!bg-transparent"
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
        <div className="mx-auto mt-2 flex w-full max-w-xl justify-center sm:mt-3">
          <div className="rounded-[24px] border border-foreground/[.06] bg-card/90 px-4 py-2.5 shadow-lg shadow-black/[.06] backdrop-blur-md sm:px-5 sm:py-3">
            <img
              src={logoUrl}
              alt="Comandiva"
              className="h-auto w-full max-w-[176px] object-contain sm:max-w-[210px] md:max-w-[226px]"
            />
          </div>
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
