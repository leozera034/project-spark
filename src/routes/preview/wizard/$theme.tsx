import type { CSSProperties } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Check, LockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getDefaultThemeLogo,
  getDefaultWizardDesktopBackground,
  getDefaultWizardMobileBackground,
  getStorefrontThemeVisual,
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

type ThemeStyle = CSSProperties & {
  "--foreground": string;
  "--muted-foreground": string;
  "--brand": string;
  "--background": string;
};

function WizardThemePreview() {
  const { theme: rawTheme } = Route.useParams();
  const theme = resolveStorefrontThemeProfile(rawTheme);
  const mobileBackground = getDefaultWizardMobileBackground(theme);
  const desktopBackground = getDefaultWizardDesktopBackground(theme);
  const logo = getDefaultThemeLogo(theme);
  const visual = getStorefrontThemeVisual(theme);

  const style: ThemeStyle = {
    "--foreground": visual.foreground,
    "--muted-foreground": visual.mutedForeground,
    "--brand": visual.brand,
    "--background": visual.background,
  };

  return (
    <main className="relative min-h-svh overflow-hidden bg-background text-foreground" style={style}>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-cover bg-center bg-no-repeat md:hidden"
        style={{ backgroundImage: `url(${JSON.stringify(mobileBackground)})` }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 hidden bg-cover bg-center bg-no-repeat md:block"
        style={{ backgroundImage: `url(${JSON.stringify(desktopBackground)})` }}
      />
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 bg-background/10" />

      <div className="relative z-20 mx-auto flex min-h-svh w-full max-w-6xl flex-col px-4 py-4 sm:px-6 md:py-6">
        <div className="mb-3 flex items-center justify-between gap-3 text-xs font-semibold text-muted-foreground">
          <Link
            to="/preview/wizard"
            className="rounded-full border bg-background/80 px-3 py-2 shadow-sm backdrop-blur"
          >
            ← Todos os temas
          </Link>
          <span className="rounded-full border bg-background/80 px-3 py-2 shadow-sm backdrop-blur">
            Preview · {LABELS[theme]}
          </span>
        </div>

        <section className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center pb-8 md:pb-12">
          <div className="mb-4 flex justify-center md:mb-5">
            <img
              src={logo}
              alt={`Comandiva — ${LABELS[theme]}`}
              className="h-auto w-full max-w-[250px] object-contain drop-shadow-sm sm:max-w-[300px]"
            />
          </div>

          <div className="overflow-hidden rounded-[34px] border border-black/5 bg-background/94 shadow-2xl shadow-black/10 backdrop-blur-md">
            <div className="px-5 pb-2 pt-5 sm:px-7 sm:pt-7">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-extrabold tracking-tight text-brand">Etapa 1 de 4</span>
                <div className="flex gap-1.5" aria-hidden="true">
                  {[0, 1, 2, 3].map((item) => (
                    <span
                      key={item}
                      className={`h-2 w-9 rounded-full ${item === 0 ? "bg-brand" : "bg-foreground/10"}`}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-7">
                <h1 className="text-[31px] font-black leading-[1.05] tracking-tight sm:text-4xl">
                  Como podemos chamar você?
                </h1>
                <p className="mt-3 text-[16px] leading-relaxed text-muted-foreground sm:text-[17px]">
                  Precisamos apenas do seu primeiro nome para continuar. Não é necessário criar conta nem senha.
                </p>
              </div>

              <div className="mt-7">
                <label htmlFor="preview-name" className="text-base font-extrabold">
                  Seu primeiro nome
                </label>
                <Input
                  id="preview-name"
                  className="mt-2 min-h-[58px] rounded-2xl border-foreground/10 bg-background/90 px-4 text-[18px] shadow-sm"
                  placeholder="Ex.: Maria"
                />
              </div>

              <div className="mt-4 flex gap-3 rounded-2xl border border-foreground/[.08] bg-background/70 p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
                  <LockKeyhole className="size-5" />
                </span>
                <div>
                  <p className="font-extrabold">Seus dados ficam neste aparelho</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Usamos apenas o necessário para facilitar seus próximos pedidos nesta loja.
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-foreground/[.07] bg-background/75 p-4 sm:p-5">
              <Button className="min-h-[60px] w-full rounded-2xl text-[17px] font-extrabold shadow-md">
                Continuar
              </Button>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs font-medium text-muted-foreground">
                <Check className="size-3.5" /> Preview visual — nenhuma informação é enviada
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
