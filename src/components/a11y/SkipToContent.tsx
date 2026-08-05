/**
 * Atalho de teclado para pular direto ao conteudo principal.
 * Fica invisivel ate receber foco, entao nao altera o visual das telas.
 * O alvo #conteudo e um wrapper estavel definido em __root, o que evita
 * qualquer mutacao de DOM durante a hidratacao.
 */
export function SkipToContent() {
  return (
    <a
      href="#conteudo"
      className="skip-link"
      onClick={(event) => {
        const target = document.getElementById("conteudo");
        if (!target) return;
        event.preventDefault();
        target.setAttribute("tabindex", "-1");
        target.focus();
        target.scrollIntoView({ block: "start" });
      }}
    >
      Pular para o conteúdo
    </a>
  );
}
