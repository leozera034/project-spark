import { supabase } from "@/integrations/supabase/client";
import { toFriendlyMessage as baseFriendlyMessage } from "@/store-config/errors";

import type {
  CatalogCategory,
  CatalogOverview,
  CatalogProduct,
  CatalogProductPage,
  ProductStatusFilter,
} from "./types";

const BUCKET = "store-catalog";
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

const CATALOG_MESSAGES: Record<string, string> = {
  DUPLICATE_CATEGORY: "Já existe uma categoria com este nome.",
  CATEGORY_NOT_FOUND: "Esta categoria não está mais disponível.",
  CATEGORY_ARCHIVED: "Esta categoria está arquivada e não recebe produtos.",
  PRODUCT_ARCHIVED: "Este produto está arquivado. Restaure antes de alterar.",
  INVALID_PRICE: "Informe um preço válido.",
  INVALID_DESCRIPTION: "A descrição contém conteúdo não permitido.",
  INVALID_FILTER: "Não foi possível aplicar este filtro.",
  INVALID_ORDER: "Não foi possível reordenar a lista.",
  INVALID_AVAILABILITY_DAYS: "Escolha pelo menos um dia válido para a disponibilidade.",
  INVALID_MAX_QUANTITY: "O limite máximo por pedido precisa ser maior que zero.",
  INVALID_STOCK: "O estoque não pode ser negativo.",
  INVALID_LOW_STOCK_THRESHOLD: "O alerta de estoque baixo precisa ser zero ou maior.",
  // Fase 10 — motor avançado
  INVALID_SALE_MODE: "Modo de venda inválido.",
  INVALID_MEASUREMENT_UNIT: "Escolha uma unidade de medida válida.",
  INVALID_QUANTITY_RULES: "A quantidade mínima e o incremento precisam ser maiores que zero.",
  MEASURED_WITH_VARIANTS: "Venda por peso ou volume não aceita variações ativas.",
  INVALID_VARIANT_NAME: "Informe um nome válido para a variação.",
  DUPLICATE_VARIANT: "Já existe uma variação com este nome neste produto.",
  VARIANT_ARCHIVED: "Esta variação está arquivada. Restaure antes de alterar.",
  VARIANT_UNAVAILABLE: "Só uma variação ativa pode ser a padrão.",
  INVALID_PACKAGE: "Informe a quantidade e a unidade da embalagem.",
  INVALID_CONFIGURATION:
    "A configuração ficaria inválida para um produto publicado. Ajuste antes de continuar.",
  INVALID_GROUP_NAME: "Informe um nome válido para o grupo.",
  INVALID_GROUP_DESCRIPTION: "A descrição do grupo contém conteúdo não permitido.",
  DUPLICATE_GROUP: "Já existe um grupo com este nome.",
  GROUP_ARCHIVED: "Este grupo está arquivado. Restaure antes de usar.",
  INVALID_SELECTION_TYPE: "Tipo de escolha inválido.",
  INVALID_SELECTION_LIMITS: "Revise o mínimo e o máximo de escolhas do grupo.",
  INVALID_PRICING_STRATEGY: "Forma de cobrança do grupo inválida.",
  INVALID_PRICE_EFFECT: "Efeito de preço inválido.",
  INVALID_PORTION_COUNT: "A quantidade de porções precisa ficar entre 2 e 8.",
  INVALID_ITEM_NAME: "Informe um nome válido para o item.",
  INVALID_ITEM_DESCRIPTION: "A descrição do item contém conteúdo não permitido.",
  INVALID_MAX_QUANTITY_ITEM: "A quantidade máxima do item precisa ser pelo menos 1.",
  DUPLICATE_ITEM: "Já existe um item com este nome neste grupo.",
  ITEM_ARCHIVED: "Este item está arquivado. Restaure antes de alterar.",
  DUPLICATE_LINK: "Este grupo já está vinculado ao produto.",
  MULTIPLE_REPLACE_BASE: "Apenas um grupo pode substituir o preço do produto.",
  INVALID_PAYLOAD: "Não foi possível salvar estes dados.",
  VARIANT_INVALID: "Variação inválida para este produto.",
  OPTION_INVALID: "Item de opção inválido para este produto.",
};

export function catalogErrorMessage(error: unknown): string {
  const raw =
    typeof error === "string" ? error : ((error as { message?: string } | null)?.message ?? "");
  const token = raw.trim().split(/\s|:/)[0]?.toUpperCase() ?? "";
  return CATALOG_MESSAGES[token] ?? baseFriendlyMessage(error);
}

function unwrap<T>(result: { data: unknown; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data == null) throw new Error("NOT_FOUND");
  return result.data as T;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = supabase.rpc.bind(supabase) as any;

/* ---------------- Visão geral ---------------- */

export async function fetchCatalogOverview(storeId: string | null): Promise<CatalogOverview> {
  return unwrap<CatalogOverview>(await rpc("get_my_catalog_overview", { _store_id: storeId }));
}

/* ---------------- Categorias ---------------- */

export async function listCategories(
  storeId: string | null,
  includeArchived = false,
): Promise<CatalogCategory[]> {
  return unwrap<CatalogCategory[]>(
    await rpc("list_my_catalog_categories", {
      _store_id: storeId,
      _include_archived: includeArchived,
    }),
  );
}

export async function createCategory(params: {
  storeId: string;
  name: string;
  description: string;
  isActive: boolean;
}): Promise<CatalogCategory> {
  return unwrap<CatalogCategory>(
    await rpc("create_catalog_category", {
      _store_id: params.storeId,
      _name: params.name,
      _description: params.description,
      _is_active: params.isActive,
    }),
  );
}

export async function updateCategory(params: {
  storeId: string;
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  expectedUpdatedAt: string;
}): Promise<CatalogCategory> {
  return unwrap<CatalogCategory>(
    await rpc("update_catalog_category", {
      _store_id: params.storeId,
      _id: params.id,
      _name: params.name,
      _description: params.description,
      _is_active: params.isActive,
      _expected_updated_at: params.expectedUpdatedAt,
    }),
  );
}

export async function setCategoryActive(
  storeId: string,
  id: string,
  isActive: boolean,
  expectedUpdatedAt: string,
): Promise<CatalogCategory> {
  return unwrap<CatalogCategory>(
    await rpc("set_catalog_category_active", {
      _store_id: storeId,
      _id: id,
      _is_active: isActive,
      _expected_updated_at: expectedUpdatedAt,
    }),
  );
}

export async function archiveCategory(
  storeId: string,
  id: string,
  archived: boolean,
  expectedUpdatedAt: string,
): Promise<CatalogCategory> {
  return unwrap<CatalogCategory>(
    await rpc("archive_catalog_category", {
      _store_id: storeId,
      _id: id,
      _archived: archived,
      _expected_updated_at: expectedUpdatedAt,
    }),
  );
}

export async function reorderCategories(
  storeId: string,
  ids: string[],
): Promise<CatalogCategory[]> {
  return unwrap<CatalogCategory[]>(
    await rpc("reorder_catalog_categories", { _store_id: storeId, _ids: ids }),
  );
}

export async function setCategoryImage(
  storeId: string,
  id: string,
  imagePath: string | null,
): Promise<CatalogCategory> {
  return unwrap<CatalogCategory>(
    await rpc("set_catalog_category_image", {
      _store_id: storeId,
      _id: id,
      _image_path: imagePath,
    }),
  );
}

/* ---------------- Produtos ---------------- */

export async function listProducts(params: {
  storeId: string | null;
  search: string;
  categoryId: string | null;
  status: ProductStatusFilter;
  limit: number;
  offset: number;
}): Promise<CatalogProductPage> {
  return unwrap<CatalogProductPage>(
    await rpc("list_my_catalog_products", {
      _store_id: params.storeId,
      _search: params.search,
      _category_id: params.categoryId,
      _status: params.status,
      _limit: params.limit,
      _offset: params.offset,
    }),
  );
}

export async function getProduct(storeId: string, id: string): Promise<CatalogProduct> {
  return unwrap<CatalogProduct>(
    await rpc("get_my_catalog_product", { _store_id: storeId, _id: id }),
  );
}

export async function createProduct(params: {
  storeId: string;
  categoryId: string;
  name: string;
  description: string;
  basePrice: number;
  allowsNotes: boolean;
  isActive: boolean;
  isFeatured: boolean;
  isSoldOut: boolean;
}): Promise<CatalogProduct> {
  return unwrap<CatalogProduct>(
    await rpc("create_simple_product", {
      _store_id: params.storeId,
      _category_id: params.categoryId,
      _name: params.name,
      _description: params.description,
      _base_price: params.basePrice,
      _allows_notes: params.allowsNotes,
      _is_active: params.isActive,
      _is_featured: params.isFeatured,
      _is_sold_out: params.isSoldOut,
    }),
  );
}

export async function updateProduct(params: {
  storeId: string;
  id: string;
  categoryId: string;
  name: string;
  description: string;
  basePrice: number;
  allowsNotes: boolean;
  expectedUpdatedAt: string;
}): Promise<CatalogProduct> {
  return unwrap<CatalogProduct>(
    await rpc("update_simple_product", {
      _store_id: params.storeId,
      _id: params.id,
      _category_id: params.categoryId,
      _name: params.name,
      _description: params.description,
      _base_price: params.basePrice,
      _allows_notes: params.allowsNotes,
      _expected_updated_at: params.expectedUpdatedAt,
    }),
  );
}

export async function updateProductAvailability(params: {
  storeId: string;
  id: string;
  availableWeekdays: number[] | null;
  availableFrom: string | null;
  availableTo: string | null;
  maxQuantity: number | null;
  stockQuantity: number | null;
  lowStockThreshold: number;
  expectedUpdatedAt: string;
}): Promise<CatalogProduct> {
  return unwrap<CatalogProduct>(
    await rpc("update_catalog_product_availability", {
      _store_id: params.storeId,
      _id: params.id,
      _available_weekdays: params.availableWeekdays,
      _available_from: params.availableFrom,
      _available_to: params.availableTo,
      _max_quantity: params.maxQuantity,
      _stock_quantity: params.stockQuantity,
      _low_stock_threshold: params.lowStockThreshold,
      _expected_updated_at: params.expectedUpdatedAt,
    }),
  );
}

export async function setProductActive(
  storeId: string,
  id: string,
  value: boolean,
  expectedUpdatedAt: string,
): Promise<CatalogProduct> {
  return unwrap<CatalogProduct>(
    await rpc("set_product_active", {
      _store_id: storeId,
      _id: id,
      _is_active: value,
      _expected_updated_at: expectedUpdatedAt,
    }),
  );
}

export async function setProductSoldOut(
  storeId: string,
  id: string,
  value: boolean,
  expectedUpdatedAt: string,
): Promise<CatalogProduct> {
  return unwrap<CatalogProduct>(
    await rpc("set_product_sold_out", {
      _store_id: storeId,
      _id: id,
      _is_sold_out: value,
      _expected_updated_at: expectedUpdatedAt,
    }),
  );
}

export async function setProductFeatured(
  storeId: string,
  id: string,
  value: boolean,
  expectedUpdatedAt: string,
): Promise<CatalogProduct> {
  return unwrap<CatalogProduct>(
    await rpc("set_product_featured", {
      _store_id: storeId,
      _id: id,
      _is_featured: value,
      _expected_updated_at: expectedUpdatedAt,
    }),
  );
}

export async function archiveProduct(
  storeId: string,
  id: string,
  archived: boolean,
  expectedUpdatedAt: string,
): Promise<CatalogProduct> {
  return unwrap<CatalogProduct>(
    await rpc("archive_catalog_product", {
      _store_id: storeId,
      _id: id,
      _archived: archived,
      _expected_updated_at: expectedUpdatedAt,
    }),
  );
}

export async function moveProductToCategory(
  storeId: string,
  id: string,
  categoryId: string,
  expectedUpdatedAt: string,
): Promise<CatalogProduct> {
  return unwrap<CatalogProduct>(
    await rpc("move_product_to_category", {
      _store_id: storeId,
      _id: id,
      _category_id: categoryId,
      _expected_updated_at: expectedUpdatedAt,
    }),
  );
}

export async function reorderProducts(
  storeId: string,
  categoryId: string,
  ids: string[],
): Promise<void> {
  const { error } = await rpc("reorder_catalog_products", {
    _store_id: storeId,
    _category_id: categoryId,
    _ids: ids,
  });
  if (error) throw new Error(error.message);
}

export async function setProductImage(
  storeId: string,
  id: string,
  imagePath: string | null,
): Promise<CatalogProduct> {
  return unwrap<CatalogProduct>(
    await rpc("set_product_image", { _store_id: storeId, _id: id, _image_path: imagePath }),
  );
}

/* ---------------- Imagens (bucket privado) ---------------- */

/** URL temporária apenas para uso administrativo. Nunca é persistida. */
export async function signCatalogUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function uploadCatalogImage(params: {
  storeId: string;
  scope: "categories" | "products";
  entityId: string;
  file: File;
}): Promise<string> {
  if (!ALLOWED_MIME.includes(params.file.type)) throw new Error("UPLOAD_INVALID_TYPE");
  if (params.file.size > MAX_BYTES) throw new Error("UPLOAD_TOO_LARGE");

  const ext =
    params.file.type === "image/png" ? "png" : params.file.type === "image/webp" ? "webp" : "jpg";
  const path = `${params.storeId}/${params.scope}/${params.entityId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, params.file, { contentType: params.file.type, upsert: false });
  if (error) throw new Error("UPLOAD_FAILED");
  return path;
}

/** Só é chamado depois que a nova referência já foi gravada no banco. */
export async function removeCatalogImage(path: string | null): Promise<void> {
  if (!path) return;
  await supabase.storage.from(BUCKET).remove([path]);
}
