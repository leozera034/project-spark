export interface CatalogCategory {
  id: string;
  name: string;
  description: string | null;
  image_path: string | null;
  is_active: boolean;
  is_archived: boolean;
  sort_order: number;
  updated_at: string;
  product_count: number;
}

export interface CatalogProduct {
  id: string;
  category_id: string;
  category_name: string | null;
  name: string;
  description: string | null;
  image_path: string | null;
  base_price: number;
  pricing_unit: string;
  minimum_quantity: number;
  quantity_step: number;
  allows_notes: boolean;
  is_active: boolean;
  is_featured: boolean;
  is_sold_out: boolean;
  is_archived: boolean;
  has_variants: boolean;
  /** Janela opcional de venda no fuso da loja. Null = sem restrição. */
  available_from?: string | null;
  available_to?: string | null;
  /** 0=domingo ... 6=sábado. Null = todos os dias. */
  available_weekdays?: number[] | null;
  /** Limite máximo deste produto dentro de um pedido. */
  max_quantity?: number | null;
  /** Estoque canônico. Null = sem controle de estoque por quantidade. */
  stock_quantity?: number | null;
  low_stock_threshold?: number;
  /** Disponibilidade real agora, já considerando agenda, estoque e variações. */
  runtime_available?: boolean;
  sort_order: number;
  updated_at: string;
}

export interface CatalogAbilities {
  view: boolean;
  create: boolean;
  update: boolean;
  archive: boolean;
}

export interface CatalogOverview {
  store_id: string;
  counts: {
    categories_active: number;
    categories_total: number;
    products_active: number;
    products_total: number;
    products_sold_out: number;
    products_featured: number;
    products_archived: number;
  };
  can: CatalogAbilities;
}

export type ProductStatusFilter =
  | "todos"
  | "ativos"
  | "inativos"
  | "esgotados"
  | "destaques"
  | "arquivados";

export const PRODUCT_STATUS_FILTERS: { value: ProductStatusFilter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "ativos", label: "Ativos" },
  { value: "inativos", label: "Inativos" },
  { value: "esgotados", label: "Esgotados" },
  { value: "destaques", label: "Destaques" },
  { value: "arquivados", label: "Arquivados" },
];

export interface CatalogProductPage {
  items: CatalogProduct[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export const CATALOG_PAGE_SIZE = 20;

/** Nesta fase o produto simples é sempre vendido por unidade. */
export const SIMPLE_PRODUCT_UNIT = "unidade";

export function formatPriceBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(value ?? 0),
  );
}

export function parsePriceInput(value: string): number | null {
  const cleaned = value.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  if (cleaned.trim() === "") return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100) / 100;
}
