import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "#recursos", label: "Recursos" },
  { href: "#operacao", label: "Como funciona" },
  { href: "#segmentos", label: "Para lojas" },
  { href: "#planos", label: "Preços" },
  { href: "#duvidas", label: "Dúvidas" },
];

/** Cabeçalho institucional da Comandiva. */
export function SiteHeader() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/88 backdrop-blur-xl supports-[backdrop-filter]:bg-background/78">
      <div className="mx-auto flex h-[72px] max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link to="/" aria-label="Comandiva — início" className="shrink-0">
          <BrandLogo lockup="horizontal" className="h-10 w-auto sm:h-11" />
        </Link>

        <nav aria-label="Navegação principal" className="ml-7 hidden flex-1 items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-brand-soft hover:text-brand"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
            <Link to="/entrar/loja">Entrar</Link>
          </Button>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link to="/criar-loja">Começar agora</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="lg:hidden"
            aria-expanded={open}
            aria-controls="menu-mobile"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </Button>
        </div>
      </div>

      <div
        id="menu-mobile"
        hidden={!open}
        className={cn(
          "fixed inset-x-0 bottom-0 top-[72px] z-50 overflow-y-auto border-t border-border bg-background/98 backdrop-blur-xl lg:hidden",
        )}
      >
        <nav
          aria-label="Navegação principal (mobile)"
          className="mx-auto flex max-w-6xl flex-col gap-1 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4"
        >
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex min-h-12 items-center rounded-xl px-4 text-base font-semibold text-foreground transition-colors hover:bg-brand-soft hover:text-brand"
            >
              {item.label}
            </a>
          ))}
          <div className="mt-4 grid gap-2">
            <Button asChild size="touch" onClick={() => setOpen(false)}>
              <Link to="/criar-loja">Criar minha loja</Link>
            </Button>
            <Button asChild variant="outline" size="touch" onClick={() => setOpen(false)}>
              <Link to="/entrar/loja">Entrar como loja</Link>
            </Button>
            <Button asChild variant="ghost" size="touch" onClick={() => setOpen(false)}>
              <Link to="/entrar/entregador">Sou entregador</Link>
            </Button>
          </div>
        </nav>
      </div>
    </header>
  );
}
