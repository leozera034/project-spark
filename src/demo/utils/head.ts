/** Gera metadados de cabeçalho consistentes para as rotas do protótipo. */
export function demoHead(title: string, description: string) {
  return () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  });
}
