import { Outlet, createFileRoute } from "@tanstack/react-router";
import type { CSSProperties } from "react";

import { useDemo } from "@/demo/state/useDemo";

export const Route = createFileRoute("/loja/mercado-aurora")({
  component: StoreThemeLayout,
});

/**
 * A marca predominante nesta área é a da loja. O Pediu Aqui aparece somente
 * como assinatura discreta no rodapé de cada tela.
 */
function StoreThemeLayout() {
  const { store } = useDemo();

  const themeVars = {
    "--brand": store.theme.brand,
    "--brand-strong": store.theme.brand,
    "--brand-foreground": store.theme.brandForeground,
    "--brand-soft": store.theme.brandSoft,
    "--brand-soft-foreground": store.theme.brandSoftForeground,
    "--accent": store.theme.brandSoft,
    "--accent-foreground": store.theme.brandSoftForeground,
    "--ring": store.theme.brand,
  } as CSSProperties;

  return (
    <div style={themeVars} className="min-h-screen bg-background">
      <Outlet />
    </div>
  );
}
