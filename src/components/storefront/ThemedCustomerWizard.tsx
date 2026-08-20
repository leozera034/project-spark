import { CustomerWizard } from "@/components/storefront/CustomerWizard";
import { getDefaultWizardMobileBackground } from "@/storefront/default-banners";

export function ThemedCustomerWizard({ segment }: { segment: string | null | undefined }) {
  const backgroundUrl = getDefaultWizardMobileBackground(segment);

  return (
    <div className="relative min-h-svh overflow-hidden bg-background max-md:[&>main]:!bg-transparent">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 hidden bg-cover bg-center bg-no-repeat max-md:block"
        style={{ backgroundImage: `url(${JSON.stringify(backgroundUrl)})` }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 hidden bg-background/20 max-md:block"
      />
      <CustomerWizard />
    </div>
  );
}
