import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Beef,
  Bike,
  Clock,
  Coffee,
  Flame,
  Gift,
  IceCreamBowl,
  MapPin,
  Pizza,
  Search,
  ShoppingBag,
  ShoppingBasket,
  Star,
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
  "--card": string;
  "--border": string;
};

export function StorefrontThemePreview({ theme: rawTheme }: { theme: string }) {
  const theme = resolveStorefrontThemeProfile(rawTheme);
  const meta = THEME_META[theme];
  const visual = getStorefrontThemeVisual(theme);
  const banner = getDefaultStoreBanner(theme);
  const Icon = meta.Icon;
  const style: ThemeStyle = {
    "--foreground": "#2b1813",
    "--muted-foreground": "#705d56",
    "--brand": visual.brand,
    "--brand-foreground": visual.brandForeground,
    "--background": "#fffaf5",
    "--card": "#ffffff",
    "--border": "rgba(82,55,43,.14)",
  };

  return (
    <main className="storefront-global min-h-svh bg-background pb-16 text-foreground" style={style}>
      <header className="relative overflow-hidden">
        <div className="relative h-[236px] sm:h-[300px]">
          <img src={banner} alt="" className="size-full object-cover" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/12" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-px left-1/2 h-10 w-[130%] -translate-x-1/2 bg-background sm:h-14"
            style={{ borderRadius: "50% 50% 0 0 / 100% 100% 0 0" }}
          />
        </div>

        <div className="relative mx-auto max-w-3xl px-4 sm:px-6">
          <div className="-mt-[54px] flex min-w-0 items-end gap-4 sm:-mt-[62px] sm:gap-5">
            <StorefrontIdentityMark segment={theme} storeName={meta.storeName} />
            <div className="min-w-0 pb-2.5 sm:pb-3">
              <h1 className="line-clamp-2 text-[clamp(1.65rem,6vw,2.35rem)] font-black leading-[1.02] tracking-[-0.035em]">
                {meta.storeName}
              </h1>
              <p className="mt-1 truncate text-sm font-medium text-muted-foreground sm:text-base">
                {meta.category} · {meta.city}
              </p>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-2.5">
            <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-emerald-600/20 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-700 shadow-sm">
              <span className="size-2 rounded-full bg-emerald-500" /> Aberta agora
            </span>
            <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-black/8 bg-white/75 px-3.5 py-1.5 text-xs font-bold shadow-sm"><Bike className="size-3.5 text-brand" />Entrega</span>
            <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-black/8 bg-white/75 px-3.5 py-1.5 text-xs font-bold shadow-sm"><ShoppingBag className="size-3.5 text-brand" />Retirada</span>
            <span className="inline-flex min-h-9 items-center rounded-full border border-black/8 bg-white/75 px-3.5 py-1.5 text-xs font-bold shadow-sm"><Clock className="mr-1 size-3.5" />~35 min</span>
          </div>

          <p className="mt-5 text-[15px] font-medium leading-relaxed text-foreground/82 sm:text-base">
            Bem-vindo! Escolha seus favoritos e monte o pedido do seu jeito.
          </p>
        </div>
      </header>

      <div className="sticky top-0 z-20 mt-5 border-b border-black/5 bg-background/94 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl space-y-3.5 px-4 py-3.5 sm:px-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-foreground/65" />
            <div className="flex h-14 items-center rounded-2xl border border-black/8 bg-white pl-12 pr-4 text-[15px] font-medium text-black/45 shadow-[0_8px_24px_rgba(74,43,29,.08)]">
              Buscar no cardápio
            </div>
          </div>
          <nav className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
            {[
              { label: "Destaques", Icon: Star },
              { label: "Mais pedidos", Icon: Flame },
              { label: "Combos", Icon: Gift },
            ].map(({ label, Icon: CategoryIcon }, index) => (
              <span
                key={label}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold ${index === 0 ? "border-brand bg-brand text-brand-foreground shadow-sm" : "border-black/7 bg-white/70 text-foreground"}`}
              >
                <CategoryIcon className="size-4" />
                {label}
              </span>
            ))}
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <section className="py-8">
          <div className="flex items-end gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-black tracking-[-0.025em] sm:text-2xl">Destaques</h2>
              <p className="mt-1 text-sm text-muted-foreground">Uma amostra visual do modelo {meta.label.toLowerCase()}.</p>
            </div>
            <span className="shrink-0 pb-0.5 text-xs font-semibold text-muted-foreground">3 itens</span>
          </div>

          <ul className="mt-4 space-y-3">
            {SAMPLE_PRODUCTS[theme].map((product) => (
              <li key={product.name}>
                <button type="button" className="group flex w-full items-center gap-3 rounded-2xl border border-black/[0.055] bg-white p-3.5 text-left shadow-[0_8px_22px_rgba(61,37,25,.07)] transition-all duration-200 hover:-translate-y-0.5 sm:gap-4 sm:p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-start gap-2">
                      <p className="line-clamp-2 min-w-0 flex-1 text-[15px] font-extrabold leading-snug sm:text-base">{product.name}</p>
                      {product.featured ? <span className="shrink-0 rounded-full bg-brand/10 px-2.5 py-1 text-[10px] font-bold text-brand sm:text-[11px]">Destaque</span> : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{product.desc}</p>
                    <p className="mt-2 text-sm font-extrabold tabular-nums text-brand">{product.price}</p>
                  </div>
                  <div className="grid size-20 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand sm:size-24">
                    <Icon className="size-8 sm:size-9" strokeWidth={1.8} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl border border-black/8 bg-white/70 p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3">
            <ShoppingBag className="mt-0.5 size-5 shrink-0 text-brand" />
            <div>
              <p className="font-bold">Identidade da loja preservada</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Se a loja não enviar logo, o Comandiva usa apenas um ícone neutro da categoria. Nunca inventamos uma marca para o lojista. Quando ele cadastrar a própria logo, ela substitui automaticamente este ícone.
              </p>
            </div>
          </div>
        </section>

        <footer className="space-y-3 py-8 text-sm text-muted-foreground">
          <p className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0" /> Endereço demonstrativo · {meta.city}</p>
          <div className="flex flex-col gap-2 border-t border-black/5 pt-5 text-xs sm:flex-row sm:items-center sm:justify-between">
            <p>Cardápio digital com Comandiva.</p>
            <a href="/criar-loja" className="font-bold text-brand">Tem uma loja? Crie seu cardápio no Comandiva →</a>
          </div>
        </footer>
      </div>
    </main>
  );
}

export { THEME_META as STOREFRONT_PREVIEW_THEME_META };
