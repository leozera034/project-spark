/**
 * Rota neutra para a antiga URL de acompanhamento (`/pedido/{token}`).
 *
 * A rota antiga colocava o segredo no caminho. Aqui o valor recebido NUNCA é
 * lido, consultado ou registrado: apenas trocamos a URL visível por `/pedido`
 * e mostramos uma orientação genérica.
 */
import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/pedido/$")({
  headers: () => ({
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  }),
  head: () => ({
    meta: [
      { title: "Acompanhamento · Pediu Aqui" },
      { name: "description", content: "Use o link seguro recebido ao finalizar o pedido." },
      { name: "robots", content: "noindex, nofollow, noarchive" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: LegacyTrackingNotice,
});

function LegacyTrackingNotice() {
  useEffect(() => {
    window.history.replaceState(window.history.state, "", "/pedido");
  }, []);

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <ShieldAlert className="size-8 text-muted-foreground" />
      <h1 className="text-lg font-semibold">Este endereço não acompanha mais pedidos</h1>
      <p className="text-sm text-muted-foreground">
        Por segurança, o acompanhamento mudou de endereço. Abra o link completo que você recebeu ao
        finalizar o pedido — ele leva direto à página da loja.
      </p>
      <Button asChild variant="outline" className="mt-2">
        <Link to="/">Ir para o início</Link>
      </Button>
    </main>
  );
}
