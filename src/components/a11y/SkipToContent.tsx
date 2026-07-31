/**
 * Atalho de teclado para pular a navegação e ir direto ao conteúdo.
 * Fica oculto até receber foco, então não altera o visual das telas.
 */
export function SkipToContent() {
  return (
    <a
      href="#conteudo"
      className="skip-link"
      onClick={(event) => {
        const main = document.querySelector("main");
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
