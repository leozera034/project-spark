import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, Tags } from "lucide-react";

import {
  searchCatalogProductSearchAliases,
  updateCatalogProductSearchAliases,
  type CatalogProductSearchAliases,
} from "@/catalog/search-aliases";
import { useCatalog } from "@/catalog/CatalogProvider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

const MAX_ALIASES = 12;
const MAX_ALIAS_LENGTH = 40;
const PAGE_SIZE = 50;

export const Route = createFileRoute("/app/loja/cardapio/busca")({
  component: CatalogSearchAliasesPage,
});

function fold(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseAliases(value: string) {
  const seen = new Set<string>();
  const aliases: string[] = [];
  for (const raw of value.split(/[,;\n]+/)) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = fold(trimmed);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    aliases.push(trimmed);
  }
  return aliases;
}

function CatalogSearchAliasesPage() {
  const { storeId, overview, run, isBusy } = useCatalog();
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(term.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [term]);

  const aliasesQuery = useQuery({
    queryKey: ["catalog", "search-aliases", storeId, search],
    queryFn: () => searchCatalogProductSearchAliases({
      storeId: storeId!,
      search,
      limit: PAGE_SIZE,
      offset: 0,
    }),
    enabled: Boolean(storeId),
    retry: false,
  });

  const items = aliasesQuery.data?.items ?? [];
  const parsedDraft = useMemo(() => parseAliases(draft), [draft]);
  const draftTooMany = parsedDraft.length > MAX_ALIASES;
  const draftTooLong = parsedDraft.some((alias) => alias.length > MAX_ALIAS_LENGTH);
  const draftInvalid = draftTooMany || draftTooLong;
  const canUpdate = Boolean(overview?.can.update);

  function startEditing(item: CatalogProductSearchAliases) {
    setEditingId(item.product_id);
    setDraft(item.search_aliases.join(", "));
  }

  async function save(item: CatalogProductSearchAliases) {
    if (!storeId || !canUpdate || draftInvalid) return;
    const saved = await run(
      () => updateCatalogProductSearchAliases({
        storeId,
        productId: item.product_id,
        aliases: parsedDraft,
      }),
      "Termos de busca atualizados.",
    );
    if (saved) {
      await aliasesQuery.refetch();
      setEditingId(null);
      setDraft("");
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.14em] text-brand">
          <Search className="size-4" /> Encontrabilidade
        </p>
        <h2 className="mt-1 text-2xl font-black tracking-tight">Termos de busca</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Cadastre palavras que seus clientes usam para procurar o mesmo produto, sem alterar o nome exibido no cardápio.
        </p>
      </div>

      <Alert>
        <Tags className="size-4" />
        <AlertTitle>Exemplos úteis</AlertTitle>
        <AlertDescription>
          Um produto “Coca-Cola 2L” pode usar “coca, refrigerante, refri”. Um “X-Salada” pode usar “hambúrguer, burger, lanche”. Use somente termos realmente equivalentes ao produto.
        </AlertDescription>
      </Alert>

      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Buscar produto, categoria ou termo cadastrado"
          aria-label="Buscar produtos por nome, categoria ou termo"
          className="h-12 pl-10"
        />
      </div>

      {aliasesQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      ) : aliasesQuery.error ? (
        <Alert variant="destructive">
          <AlertTitle>Não foi possível carregar os termos</AlertTitle>
          <AlertDescription>Tente novamente. Nenhum produto foi alterado.</AlertDescription>
        </Alert>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="font-semibold">Nenhum produto encontrado.</p>
            <p className="mt-1 text-sm text-muted-foreground">Ajuste a busca para localizar outro item.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const editing = editingId === item.product_id;
            return (
              <Card key={item.product_id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <CardTitle className="text-base">{item.name}</CardTitle>
                      <CardDescription className="mt-1">{item.category_name ?? "Categoria sem nome"}</CardDescription>
                      {item.search_aliases.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {item.search_aliases.map((alias) => <Badge key={alias} variant="secondary">{alias}</Badge>)}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">Nenhum termo alternativo cadastrado.</p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant={editing ? "secondary" : "outline"}
                      disabled={!canUpdate || isBusy}
                      onClick={() => editing ? setEditingId(null) : startEditing(item)}
                    >
                      {editing ? "Fechar" : "Editar termos"}
                    </Button>
                  </div>
                </CardHeader>

                {editing ? (
                  <CardContent className="space-y-3 border-t pt-4">
                    <div>
                      <Textarea
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        maxLength={650}
                        placeholder="Ex.: coca, refrigerante, refri"
                        className="min-h-24"
                        aria-label={`Termos alternativos para ${item.name}`}
                      />
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>Separe os termos por vírgula, ponto e vírgula ou nova linha.</span>
                        <span className={draftTooMany ? "font-bold text-destructive" : "font-semibold"}>{parsedDraft.length}/{MAX_ALIASES}</span>
                      </div>
                      {draftTooMany ? <p className="mt-2 text-xs font-medium text-destructive">Use no máximo {MAX_ALIASES} termos.</p> : null}
                      {draftTooLong ? <p className="mt-2 text-xs font-medium text-destructive">Cada termo pode ter no máximo {MAX_ALIAS_LENGTH} caracteres.</p> : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        disabled={!canUpdate || isBusy || draftInvalid}
                        loading={isBusy}
                        loadingLabel="Salvando termos"
                        onClick={() => void save(item)}
                      >
                        Salvar termos
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={isBusy}
                        onClick={() => {
                          setEditingId(null);
                          setDraft("");
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </CardContent>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      {aliasesQuery.data?.has_more ? (
        <p className="rounded-xl bg-muted/35 p-3 text-xs leading-relaxed text-muted-foreground">
          Existem mais de {PAGE_SIZE} produtos para esta busca. Digite parte do nome, categoria ou termo para localizar o item rapidamente.
        </p>
      ) : (
        <p className="rounded-xl bg-muted/35 p-3 text-xs leading-relaxed text-muted-foreground">
          Os termos são normalizados pela Comandiva antes de salvar: diferenças de maiúsculas, acentos e espaços não criam duplicatas.
        </p>
      )}
    </div>
  );
}
