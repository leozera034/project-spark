import type { CSSProperties, LucideIcon } from "react";
import {
  Beef,
  Clock,
  Coffee,
  IceCreamBowl,
  MapPin,
  Pizza,
  Search,
  ShoppingBasket,
  ShoppingBag,
  Store,
  UtensilsCrossed,
  Wine,
} from "lucide-react";

import { StorefrontIdentityMark } from "@/components/storefront/StorefrontIdentityMark";
import {
  getDefaultStoreBanner,
  getStorefrontThemeVisual,
  resolveStorefrontThemeProfile,
  type StorefrontThemeProfile,
} from "@/storefront/default-banners";

const THEME_META: Record<
  StorefrontThemeProfile,
  { label: string; storeName: string; city: string; category: string; Icon: LucideIcon }
> = {
  pizzaria: { label: "Pizzaria", storeName: "Forno da Vila", city: "Sua cidade", category: "Pizzaria artesanal", Icon: Pizza },
  hamburgueria: { label: "Hamburgueria", storeName: "Brasa Burger", city: "Sua cidade", category: "Hamburgueria", Icon: Beef },
  acai: { label: "Açaí", storeName: "Açaí do Ponto", city: "Sua cidade", category: "Açaí e complementos", Icon: IceCreamBowl },
  sorveteria: { label: "Sorveteria", storeName: "Doce Gelato", city: "Sua cidade", category: "Sorvetes e sobremesas", Icon: IceCreamBowl },
  restaurante: { label: "Restaurante", storeName: "Casa do Sabor", city: "Sua cidade", category: "Comida brasileira", Icon: UtensilsCrossed },
  lanchonete: { label: "Lanchonete", storeName: "Ponto do Lanche", city: "Sua cidade", category: "Lanches e porções", Icon: Coffee },
  pastelaria: { label: "Pastelaria", storeName: "Pastel & Cia", city: "Sua cidade", category: "Pastéis e porções", Icon: UtensilsCrossed },
  adega: { label: "Adega", storeName: "Adega Reserva", city: "Sua cidade", category: "Bebidas e conveniência", Icon: Wine },
  mercado: { label: "Mercado", storeName: "Mercado da Praça", city: "Sua cidade", category: "Mercado e mercearia", Icon: ShoppingBasket },
  outros: { label: "Outros / Neutro", storeName: "Minha Loja", city: "Sua cidade", category: "Loja local", Icon: Store },
};

const SAMPLE_PRODUCTS: Record<StorefrontThemeProfile, Array<{ name: string; desc: string; price: string; featured?: boolean }>> = {
  pizzaria: [
    { name: "Pizza Calabresa", desc: "Molho artesanal, mussarela, calabresa e cebola.", price: "a partir de R$ 42,90", featured: true },
    { name: "Pizza Marguerita", desc: "Mussarela, tomate, manjericão e azeite.", price: "a partir de R$ 39,90" },
    { name: "Pizza Frango com Catupiry", desc: "Frango temperado, mussarela e catupiry.", price: "a partir de R$ 44,90" },
  ],
  hamburgueria: [
    { name: "Brasa Bacon", desc: "Pão brioche, carne 160g, queijo, bacon e molho da casa.", price: "R$ 31,90", featured: true },
    { name: "Duplo Smash", desc: "Dois smash burgers, cheddar e cebola caramelizada.", price: "R$ 34,90" },
    { name: "Batata Crocante", desc: "Porção individual com tempero especial.", price: "R$ 15,90" },
  ],
  acai: [
    { name: "Açaí 500ml", desc: "Monte do seu jeito com frutas e complementos.", price: "a partir de R$ 22,00", featured: true },
    { name: "Açaí 300ml", desc: "Cremoso e gelado, com até 3 complementos.", price: "a partir de R$ 15,00" },
    { name: "Combo Açaí + Água", desc: "Açaí 500ml acompanhado de água mineral.", price: "R$ 25,90" },
  ],
  sorveteria: [
    { name: "Copo Especial", desc: "3 sabores, cobertura e confeitos.", price: "R$ 19,90", featured: true },
    { name: "Casquinha Dupla", desc: "Escolha dois sabores do dia.", price: "R$ 12,00" },
    { name: "Sundae da Casa", desc: "Sorvete cremoso com calda e crocante.", price: "R$ 16,90" },
  ],
  restaurante: [
    { name: "Prato Executivo", desc: "Arroz, feijão, salada, fritas e proteína do dia.", price: "R$ 29,90", featured: true },
    { name: "Frango Grelhado", desc: "Frango grelhado com arroz, legumes e salada.", price: "R$ 27,90" },
    { name: "Parmegiana", desc: "Filé empanado, molho, queijo, arroz e fritas.", price: "R$ 34,90" },
  ],
  lanchonete: [
    { name: "X-Tudo", desc: "Hambúrguer, presunto, queijo, ovo, bacon e salada.", price: "R$ 26,90", featured: true },
    { name: "Misto Quente", desc: "Pão, presunto e queijo na chapa.", price: "R$ 12,00" },
    { name: "Porção de Fritas", desc: "Batata frita sequinha para compartilhar.", price: "R$ 18,90" },
  ],
  pastelaria: [
    { name: "Pastel Especial", desc: "Carne, queijo, ovo e azeitona.", price: "R$ 14,90", featured: true },
    { name: "Pastel de Queijo", desc: "Mussarela derretida e massa crocante.", price: "R$ 11,90" },
    { name: "Caldo de Cana 500ml", desc: "Feito na hora, bem gelado.", price: "R$ 9,00" },
  ],
  adega: [
    { name: "Kit Noite Especial", desc: "Seleção para acompanhar seu momento.", price: "R$ 59,90", featured: true },
    { name: "Refrigerante 2L", desc: "Escolha a opção disponível.", price: "R$ 13,90" },
    { name: "Gelo 5kg", desc: "Pacote de gelo filtrado.", price: "R$ 12,00" },
  ],
  mercado: [
    { name: "Cesta Essencial", desc: "Seleção prática de itens para o dia a dia.", price: "R$ 79,90", featured: true },
    { name: "Pão Francês", desc: "Fresco, vendido por unidade.", price: "R$ 1,20" },
    { name: "Leite Integral 1L", desc: "Unidade de 1 litro.", price: "R$ 6,49" },
  ],
  outros: [
    { name: "Produto em destaque", desc: "Descrição curta e objetiva do produto principal.", price: "R$ 24,90", featured: true },
    { name: "Produto popular", desc: "Outro item do catálogo da loja.", price: "R$ 19,90" },
    { name: "Produto adicional", desc: "Uma terceira opção para validar o layout.", price: "R$ 14,90" },
  ],
};

type ThemeStyle = CSSProperties & {
  "--foreground": string;
  "--muted-foreground": string;
  "--brand": string;
  "--brand-foreground": string;
  "--background": string;
};

export function StorefrontThemePreview({ theme: rawTheme }: { theme: string }) {
  const theme = resolveStorefrontThemeProfile(rawTheme);
  const meta = THEME_META[theme];
  const visual = getStorefrontThemeVisual(theme);
  const banner = getDefaultStoreBanner(theme);
  const Icon = meta.Icon;
  const style: ThemeStyle = {
    "--foreground": visual.foreground,
    "--muted-foreground": visual.mutedForeground,
    "--brand": visual.brand,
    "--brand-foreground": visual.brandForeground,
    "--background": visual.background,
  };

  return (
    <main className="storefront-global min-h-svh bg-background pb-16 text-foreground" style={style}>
      <div className="border-b bg-foreground px-4 py-2.5 text-center text-xs font-bold text-background">
        Preview interno · nenhuma loja real é alterada
      </div>

      <header className="storefront-hero relative">
        <img src={banner} alt="" className="h-40 w-full object-cover sm:h-60" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-full bg-gradient-to-b from-transparent via-transparent to-background/85" />

        <div className="relative mx-auto max-w-3xl px-4 sm:px-6">
          <div className="-mt-12 flex min-w-0 items-end gap-3 sm:gap-4">
            <StorefrontIdentityMark segment={theme} storeName={meta.storeName} />
            <div className="min-w-0 pb-1.5">
              <h1 className="line-clamp-2 text-[clamp(1.45rem,5.4vw,2.1rem)] font-semibold leading-tight tracking-tight">
                {meta.storeName}
              </h1>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {meta.category} · {meta.city}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success">
              <span className="size-1.5 rounded-full bg-success" /> Aberta agora
            </span>
            <span className="rounded-full border px-3 py-1 text-xs font-semibold">Entrega</span>
            <span className="rounded-full border px-3 py-1 text-xs font-semibold">Retirada</span>
            <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold"><Clock className="mr-1 size-3" />~35 min</span>
          </div>

          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Bem-vindo! Escolha seus favoritos e monte o pedido do seu jeito.
          </p>
        </div>
      </header>

      <div className="sticky top-0 z-20 mt-6 border-b border-border/70 bg-background/92 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl space-y-3 px-4 py-3 sm:px-6">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <div className="flex h-12 items-center rounded-full border bg-background pl-10 pr-4 text-sm text-muted-foreground shadow-sm">
              Buscar no cardápio
            </div>
          </div>
          <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
            {["Destaques", "Mais pedidos", "Combos"].map((category, index) => (
              <span key={category} className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium ${index === 0 ? "border-brand bg-brand/10 text-brand" : "bg-background"}`}>
                {category}
              </span>
            ))}
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <section className="py-7">
          <div className="flex items-baseline gap-3">
            <h2 className="min-w-0 text-lg font-semibold tracking-tight">Destaques</h2>
            <span className="h-px min-w-4 flex-1 bg-border" />
            <span className="shrink-0 text-xs font-medium text-muted-foreground">3 itens</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Uma amostra visual do modelo {meta.label.toLowerCase()}.</p>

          <ul className="mt-4 space-y-3">
            {SAMPLE_PRODUCTS[theme].map((product, index) => (
              <li key={product.name}>
                <button type="button" className="panel flex w-full items-center gap-3 p-3 text-left shadow-sm sm:gap-4 sm:p-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-start gap-2">
                      <p className="line-clamp-2 min-w-0 flex-1 font-semibold leading-snug">{product.name}</p>
                      {product.featured ? <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">Destaque</span> : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{product.desc}</p>
                    <p className="mt-2 text-sm font-semibold tabular-nums text-brand">{product.price}</p>
                  </div>
                  <div className="grid size-20 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand sm:size-24">
                    <Icon className="size-8 sm:size-9" strokeWidth={1.8} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl border bg-muted/25 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <ShoppingBag className="mt-0.5 size-5 shrink-0 text-brand" />
            <div>
              <p className="font-semibold">Identidade da loja preservada</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Se a loja não enviar logo, o Comandiva usa apenas um ícone neutro da categoria. Nunca inventamos uma marca para o lojista. Quando ele cadastrar a própria logo, ela substitui automaticamente este ícone.
              </p>
            </div>
          </div>
        </section>

        <footer className="space-y-3 py-8 text-sm text-muted-foreground">
          <p className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0" /> Endereço demonstrativo · {meta.city}</p>
          <p className="text-xs">Cardápio digital com Comandiva.</p>
        </footer>
      </div>
    </main>
  );
}

export { THEME_META as STOREFRONT_PREVIEW_THEME_META };
