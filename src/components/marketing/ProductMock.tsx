import { Bike, ChefHat, Clock3, ShoppingBag } from "lucide-react";

/**
 * Composição de produto do hero. Não é imagem: é uma reconstrução em CSS
 * da linguagem real das telas do Pediu Aqui (painel de pedidos + cardápio
 * no celular), usando os mesmos tokens do design system.
 */
export function ProductMock() {
  return (
    <div className="relative select-none" aria-hidden="true">
      {/* halo teal atrás da composição */}
      <div className="pointer-events-none absolute -inset-10 rounded-[3rem] bg-brand/20 blur-3xl" />

      {/* painel do lojista */}
      <div className="relative rounded-3xl border border-carbon-foreground/12 bg-surface/95 p-3 shadow-e3 backdrop-blur-xl sm:p-4">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <span className="size-2.5 rounded-full bg-danger/70" />
          <span className="size-2.5 rounded-full bg-warning/70" />
          <span className="size-2.5 rounded-full bg-success/70" />
          <p className="ml-2 truncate text-[11px] font-semibold text-muted-foreground">
            Painel da loja · Pedidos
          </p>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <MockKpi label="Na fila" value="4" icon={ShoppingBag} tone="brand" />
          <MockKpi label="Cozinha" value="2" icon={ChefHat} tone="highlight" />
          <MockKpi label="Na rua" value="3" icon={Bike} tone="info" />
        </div>

        <div className="mt-3 space-y-2">
          <MockOrder code="#1042" title="2 itens · Entrega" status="Aceito" tone="brand" time="2 min" />
          <MockOrder code="#1041" title="4 itens · Retirada" status="Em preparo" tone="highlight" time="9 min" />
          <MockOrder code="#1040" title="1 item · Entrega" status="Saiu p/ entrega" tone="info" time="17 min" />
        </div>
      </div>

      {/* cardápio no celular, sobreposto */}
      <div className="absolute -bottom-8 -right-3 w-[38%] min-w-[132px] max-w-[190px] rounded-[1.75rem] border border-carbon-foreground/15 bg-carbon p-2 shadow-e3 sm:-right-8">
        <div className="rounded-[1.35rem] bg-surface p-2.5">
          <div className="h-12 rounded-lg bg-brand/25" />
          <div className="mt-2 flex gap-1.5">
            <span className="rounded-full bg-brand px-2 py-0.5 text-[8px] font-bold text-brand-foreground">
              Destaques
            </span>
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[8px] font-semibold text-muted-foreground">
              Bebidas
            </span>
          </div>
          <div className="mt-2 space-y-1.5">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex items-center gap-1.5 rounded-lg border border-border p-1.5">
                <div className="size-7 shrink-0 rounded-md bg-surface-muted" />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="h-1.5 w-3/4 rounded-full bg-muted-foreground/30" />
                  <div className="h-1.5 w-1/3 rounded-full bg-brand/60" />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex h-6 items-center justify-center rounded-lg bg-brand text-[8px] font-bold text-brand-foreground">
            Ver carrinho
          </div>
        </div>
      </div>
    </div>
  );
}

const TONES = {
  brand: "bg-brand-soft text-brand-soft-foreground",
  highlight: "bg-highlight-soft text-highlight-soft-foreground",
  info: "bg-info-soft text-info",
} as const;

function MockKpi({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: typeof ShoppingBag;
  tone: keyof typeof TONES;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-2.5">
      <span className={`inline-flex size-6 items-center justify-center rounded-md ${TONES[tone]}`}>
        <Icon className="size-3" />
      </span>
      <p className="mt-1.5 font-display text-lg font-bold leading-none text-foreground">{value}</p>
      <p className="mt-1 text-[10px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

function MockOrder({
  code,
  title,
  status,
  tone,
  time,
}: {
  code: string;
  title: string;
  status: string;
  tone: keyof typeof TONES;
  time: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-bold text-foreground">{code}</p>
        <p className="truncate text-[10px] text-muted-foreground">{title}</p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${TONES[tone]}`}
      >
        {status}
      </span>
      <span className="hidden shrink-0 items-center gap-1 text-[9px] text-muted-foreground sm:inline-flex">
        <Clock3 className="size-2.5" />
        {time}
      </span>
    </div>
  );
}
