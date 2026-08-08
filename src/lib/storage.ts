export function getLocalSetting<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  const val = localStorage.getItem(`pediu_aqui_${key}`);
  if (!val) return defaultValue;
  try {
    return JSON.parse(val);
  } catch {
    return val as any;
  }
}

export function setLocalSetting(key: string, value: any): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    `pediu_aqui_${key}`,
    typeof value === "string" ? value : JSON.stringify(value),
  );
}
