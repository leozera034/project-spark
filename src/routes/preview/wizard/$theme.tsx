import { Link, createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";

import { WizardThemeFrame } from "@/components/storefront/ThemedCustomerWizard";
import { WIZARD_FIELD, WIZARD_PRIMARY, WizardStepShell } from "@/components/storefront/CustomerWizard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  resolveStorefrontThemeProfile,
  type StorefrontThemeProfile,
} from "@/storefront/default-banners";

export const Route = createFileRoute("/preview/wizard/$theme")({
  head: ({ params }) => ({
    meta: [
      { title: `Preview Wizard ${params.theme} | Comandiva` },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: WizardThemePreview,
});

const LABELS: Record<StorefrontThemeProfile, string> = {
  pizzaria: "Pizzaria",
  hamburgueria: "Hamburgueria",
  acai: "Açaí",
  sorveteria: "Sorveteria",
  restaurante: "Restaurante",
  lanchonete: "Lanchonete",
  pastelaria: "Pastelaria",
  adega: "Adega",
  mercado: "Mercado",
  outros: "Outros / Neutro",
};

function WizardThemePreview() {
  const { theme: rawTheme } = Route.useParams();
  const theme = resolveStorefrontThemeProfile(rawTheme);

  const toolbar = (
    <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-3 text-xs font-semibold">
      <Link
        to="/preview/wizard"
        className="rounded-full border border-foreground/[.07] bg-card/88 px-3 py-2 text-card-foreground shadow-sm backdrop-blur-md"
      >
        ← Todos os temas
      </Link>
      <span className="rounded-full border border-foreground/[.07] bg-card/88 px-3 py-2 text-card-foreground/75 shadow-sm backdrop-blur-md">
        Preview · {LABELS[theme]}
      </span>
    </div>
  );

  return (
    <WizardThemeFrame segment={theme} topSlot={toolbar}>
      <WizardStepShell
        title="Como podemos chamar você?"
        description="Precisamos apenas do seu primeiro nome para continuar. Não é necessário criar conta nem senha."
        progress="Etapa 1 de 4"
        footer={
          <div>
            <Button className={WIZARD_PRIMARY}>Continuar</Button>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] font-semibold text-muted-foreground">
              <Check className="size-3.5" /> Preview visual — nenhuma informação é enviada
            </p>
          </div>
        }
      >
        <Label htmlFor="preview-name" className="text-base font-extrabold">Seu primeiro nome</Label>
        <Input id="preview-name" className={WIZARD_FIELD} placeholder="Ex.: Maria" />
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-foreground/[.08] bg-card/82 p-4 text-card-foreground shadow-sm backdrop-blur-sm">
          <span className="mt-0.5 size-2.5 shrink-0 rounded-full bg-brand" />
          <p className="text-sm font-medium leading-relaxed text-card-foreground/70">
            Seus dados ficam neste aparelho. Não pedimos CPF, e-mail ou senha para entrar no cardápio.
          </p>
        </div>
      </WizardStepShell>
    </WizardThemeFrame>
  );
}
