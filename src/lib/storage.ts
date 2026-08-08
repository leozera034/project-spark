export function getLocalSetting<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  const val = localStorage.getItem(`pediu_aqui_${key}`);
  if (!val) return defaultValue;
  try {
    const parsed: unknown = JSON.parse(val);
    return parsed as T;
  } catch {
    return val as unknown as T;
  }
}

export function setLocalSetting(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    `pediu_aqui_${key}`,
    typeof value === "string" ? value : JSON.stringify(value),
  );
}
