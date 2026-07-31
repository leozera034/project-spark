import { useEffect, useState } from "react";

import { signCatalogUrl } from "./api";

/** Carrega uma URL assinada temporária para exibição administrativa. */
export function useSignedCatalogImage(path: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setUrl(null);
    void signCatalogUrl(path).then((value) => {
      if (active) setUrl(value);
    });
    return () => {
      active = false;
    };
  }, [path]);

  return url;
}

export function CatalogImage({
  path,
  alt,
  className,
  fallback = "Sem imagem",
}: {
  path: string | null;
  alt: string;
  className?: string;
  fallback?: string;
}) {
  const url = useSignedCatalogImage(path);

  if (!url) {
    return (
      <div
        className={`flex items-center justify-center rounded-md border border-dashed border-border bg-muted/40 text-[11px] text-muted-foreground ${className ?? ""}`}
      >
        {fallback}
      </div>
    );
  }

  return <img src={url} alt={alt} className={`rounded-md object-cover ${className ?? ""}`} />;
}
