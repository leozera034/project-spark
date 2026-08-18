import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";

import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  className?: string;
  style?: CSSProperties;
  /** "icon" alterna claro/escuro; "segmented" expoe claro, escuro e sistema. */
  variant?: "icon" | "segmented";
};

/**
 * Alternancia de tema acessivel:
 * - botao real, focavel por teclado, com aria-label e aria-pressed
 * - estado do sistema disponivel no modo segmentado
 */
export function ThemeToggle({ className, style, variant = "icon" }: ThemeToggleProps) {
  const { theme, preference, setPreference, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // evita divergencia entre SSR e cliente: o icone so aparece apos hidratar
  useEffect(() => setMounted(true), []);

  if (variant === "segmented") {
    const options = [
      { value: "light", label: "Claro", icon: Sun },
      { value: "dark", label: "Escuro", icon: Moon },
      { value: "system", label: "Sistema", icon: Monitor },
    ] as const;

    return (
      <div
        role="group"
        aria-label="Tema da interface"
        style={style}
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-border bg-surface-muted p-1",
          className,
        )}
      >
        {options.map((option) => {
          const Icon = option.icon;
          const active = mounted && preference === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setPreference(option.value)}
              aria-pressed={active}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
                active
                  ? "bg-surface text-foreground shadow-e1"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {option.label}
            </button>
          );
        })}
      </div>
    );
  }

  const isDark = mounted && theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={isDark}
      aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
      title={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
      style={style}
      className={cn(
        "relative inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      <Sun
        className={cn(
          "size-4 transition-all duration-300",
          isDark ? "scale-0 -rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100",
        )}
        aria-hidden="true"
      />
      <Moon
        className={cn(
          "absolute size-4 transition-all duration-300",
          isDark ? "scale-100 rotate-0 opacity-100" : "scale-0 rotate-90 opacity-0",
        )}
        aria-hidden="true"
      />
      <span className="sr-only">{isDark ? "Tema escuro ativo" : "Tema claro ativo"}</span>
    </button>
  );
}