import type { CSSProperties } from "react";

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
  "--background": string;
};

export function ThemedCustomerWizard({ segment }: { segment: string | null | undefined }) {
  const mobileBackgroundUrl = getDefaultWizardMobileBackground(segment);
  const desktopBackgroundUrl = getDefaultWizardDesktopBackground(segment);
  const logoUrl = getDefaultThemeLogo(segment);
  const visual = getStorefrontThemeVisual(segment);
  const themeStyle: ThemeStyle = {
    "--foreground": visual.foreground,
    "--muted-foreground": visual.mutedForeground,
    "--brand": visual.brand,
    "--background": visual.background,
  };

  return (
    <div
      className="relative min-h-svh overflow-hidden bg-background [&_main]:!bg-transparent"
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
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 bg-background/10" />

      <div className="relative z-20 mx-auto flex w-full max-w-xl justify-center px-6 pt-5 sm:pt-7">
        <img
          src={logoUrl}
          alt="Comandiva"
          className="h-auto w-full max-w-[250px] object-contain drop-shadow-sm sm:max-w-[300px]"
        />
      </div>

      <div className="relative z-10 -mt-1">
        <CustomerWizard />
      </div>
    </div>
  );
}
