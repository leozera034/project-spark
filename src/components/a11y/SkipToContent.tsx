import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";

/**
 * Atalho de teclado para pular direto ao conteudo principal.
 * Fica invisivel ate receber foco, entao nao altera o visual das telas.
 * O id do alvo e aplicado ao <main> de cada rota apos a navegacao.
 */
export function SkipToContent() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    const apply = () => {
      const main = document.querySelector("main");
      if (main && main.id !== "conteudo") main.id = "conteudo";
    };
    apply();
    // rotas que montam o <main> depois da hidratacao (wizard, gates)
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  return (
    <a
      href="#conteudo"
      className="skip-link"
      onClick={(event) => {
        const main = document.getElementById("conteudo") ?? document.querySelector("main");
        if (!main) return;
        event.preventDefault();
        main.setAttribute("tabindex", "-1");
        (main as HTMLElement).focus();
        main.scrollIntoView({ block: "start" });
      }}
    >
      Pular para o conteúdo
    </a>
  );
}
