import { Link } from "@tanstack/react-router";

import { BrandLogo } from "@/components/brand/BrandLogo";

/**
 * Rodapé institucional. Só âncoras da própria landing e rotas que existem
 * de fato em src/routes — nenhum link morto.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-carbon text-carbon-foreground">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <BrandLogo lockup="horizontal" tone="white" className="h-7 w-auto" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-carbon-foreground/70">
              Plataforma de cardápio digital, pedidos, cozinha e entrega própria para o comércio
              local. Mensalidade fixa por loja, sem comissão sobre a sua clientela.
            </p>
          </div>

          <FooterColumn
            title="Produto"
            items={[
              { label: "Recursos", href: "#recursos" },
              { label: "Como funciona", href: "#operacao" },
              { label: "Preços", href: "#planos" },
            ]}
          />
          <FooterColumn
            title="Empresa"
            items={[
              { label: "Para lojas", href: "#segmentos" },
              { label: "Criar minha loja", to: "/criar-loja" },
            ]}
          />
          <FooterColumn
            title="Acesso e suporte"
            items={[
              { label: "Entrar como loja", to: "/entrar/loja" },
              { label: "Entrar como entregador", to: "/entrar/entregador" },
              { label: "Recuperar acesso", to: "/recuperar-acesso" },
              { label: "Dúvidas frequentes", href: "#duvidas" },
            ]}
          />
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-carbon-foreground/15 pt-6 text-xs text-carbon-foreground/60 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Pediu Aqui. Todos os direitos reservados.</p>
          <p>
            Termos de uso e política de privacidade são apresentados durante a contratação da loja.
          </p>
        </div>
      </div>
    </footer>
  );
}

type FooterItem = { label: string; href?: string; to?: string };

function FooterColumn({ title, items }: { title: string; items: FooterItem[] }) {
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-carbon-foreground/50">
        {title}
      </h2>
      <ul className="mt-4 space-y-2.5 text-sm">
        {items.map((item) => (
          <li key={item.label}>
            {item.to ? (
              <Link
                to={item.to as never}
                className="text-carbon-foreground/80 transition-colors hover:text-carbon-foreground"
              >
                {item.label}
              </Link>
            ) : (
              <a
                href={item.href}
                className="text-carbon-foreground/80 transition-colors hover:text-carbon-foreground"
              >
                {item.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
