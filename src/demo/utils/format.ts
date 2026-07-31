/**
 * Utilidades de apresentação do protótipo.
 *
 * Valores demonstrativos; a validação real ocorrerá no backend em fase futura.
 */

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function elapsedLabel(minutes: number): string {
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `há ${hours} h` : `há ${hours} h ${rest} min`;
}

export function maskName(name: string): string {
  const [first, ...rest] = name.trim().split(" ");
  if (rest.length === 0) return first;
  return `${first} ${rest.map((part) => `${part.charAt(0)}.`).join(" ")}`;
}
