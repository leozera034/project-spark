import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

/**
 * Tema da aplicacao.
 * - "system": segue prefers-color-scheme (padrao inicial)
 * - "light" / "dark": preferencia explicita do usuario, persistida no localStorage
 */
export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "pediu-aqui:theme";

/** Cores da meta theme-color por tema resolvido (barra do navegador mobile). */
const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: "#F8F5F0",
  dark: "#0B171C",
};

type ThemeContextValue = {
  /** Preferencia escolhida (pode ser "system"). */
  preference: ThemePreference;
  /** Tema efetivamente aplicado no documento. */
  theme: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
  /** Alterna entre claro e escuro a partir do tema resolvido atual. */
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    /* localStorage indisponivel (modo privado) — cai para system */
  }
  return "system";
}

function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  root.dataset.theme = resolved;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLOR[resolved]);
}

/** Habilita a transicao suave apenas durante a troca, evitando animar o carregamento. */
function runThemeTransition() {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;
  const root = document.documentElement;
  root.setAttribute("data-theme-transition", "");
  window.setTimeout(() => root.removeAttribute("data-theme-transition"), 320);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [resolved, setResolved] = useState<ResolvedTheme>("light");

  // hidratacao: le a preferencia salva e o sistema apenas no cliente
  useEffect(() => {
    const stored = readStoredPreference();
    queueMicrotask(() => {
      setPreferenceState(stored);
      setResolved(stored === "system" ? systemTheme() : stored);
    });
  }, []);

  // acompanha mudancas do sistema quando a preferencia e "system"
  useEffect(() => {
    if (preference !== "system" || typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => {
      runThemeTransition();
      setResolved(event.matches ? "dark" : "light");
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [preference]);

  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  const setPreference = useCallback((next: ThemePreference) => {
    runThemeTransition();
    setPreferenceState(next);
    setResolved(next === "system" ? systemTheme() : next);
    try {
      if (next === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
      else window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* persistencia indisponivel — a sessao atual continua funcionando */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setPreference(resolved === "dark" ? "light" : "dark");
  }, [resolved, setPreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, theme: resolved, setPreference, toggleTheme }),
    [preference, resolved, setPreference, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme deve ser usado dentro de <ThemeProvider>.");
  return context;
}

/**
 * Script inline executado antes da pintura para evitar flash de tema errado.
 * Mantido como string simples para rodar no SSR sem hidratacao.
 */
export const themeInitScript = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var s=localStorage.getItem(k);var d=s==="dark"||((s!=="light")&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";r.dataset.theme=d?"dark":"light";}catch(e){}})();`;
