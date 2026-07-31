export const brl = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number.isFinite(value) ? value : 0,
  );

export const WEEKDAY_LABELS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

export const shortTime = (value: string) => value?.slice(0, 5) ?? "";

export const UNIT_LABELS: Record<string, string> = {
  unit: "un",
  kg: "kg",
  g: "g",
  l: "L",
  ml: "ml",
};

/** Remove acentos para que a busca funcione com ou sem acentuação. */
export const foldText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
