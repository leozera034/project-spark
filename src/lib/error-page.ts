export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Não foi possível carregar · Pediu Aqui</title>
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="robots" content="noindex,nofollow" />
    <meta name="theme-color" content="#071013" />
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100svh;
        padding: max(1.25rem, env(safe-area-inset-top)) 1rem max(1.25rem, env(safe-area-inset-bottom));
        display: grid;
        place-items: center;
        overflow: hidden;
        background:
          radial-gradient(circle at 18% 12%, rgba(15,181,165,.16), transparent 34rem),
          radial-gradient(circle at 88% 92%, rgba(15,181,165,.09), transparent 28rem),
          #071013;
        color: #f6f8f7;
        font: 15px/1.55 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      body::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        opacity: .055;
        background-image: linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px);
        background-size: 46px 46px;
      }
      .wrap { position: relative; width: min(100%, 32rem); }
      .brand {
        display: inline-flex;
        align-items: center;
        gap: .65rem;
        margin-bottom: 1rem;
        color: #fff;
        font-weight: 800;
        letter-spacing: -.025em;
      }
      .mark {
        width: 2rem;
        height: 2rem;
        display: grid;
        place-items: center;
        border-radius: .75rem;
        background: #0fb5a5;
        color: #061113;
        box-shadow: 0 12px 30px -14px rgba(15,181,165,.8);
      }
      .card {
        position: relative;
        overflow: hidden;
        border: 1px solid rgba(255,255,255,.11);
        border-radius: 1.6rem;
        background: rgba(16,27,31,.88);
        backdrop-filter: blur(20px);
        box-shadow: 0 30px 90px -34px rgba(0,0,0,.9);
        padding: clamp(1.4rem, 5vw, 2.25rem);
      }
      .card::after {
        content: "";
        position: absolute;
        width: 12rem;
        height: 12rem;
        right: -6rem;
        top: -7rem;
        border-radius: 50%;
        background: rgba(15,181,165,.12);
        filter: blur(40px);
      }
      .eyebrow { position: relative; color: #49d4c5; font-size: .72rem; font-weight: 800; text-transform: uppercase; letter-spacing: .14em; }
      h1 { position: relative; margin: .75rem 0 0; max-width: 24rem; font-size: clamp(1.8rem, 8vw, 2.55rem); line-height: 1.06; letter-spacing: -.04em; }
      p { position: relative; margin: 1rem 0 0; color: rgba(246,248,247,.58); font-size: .94rem; }
      .status {
        position: relative;
        display: flex;
        align-items: flex-start;
        gap: .7rem;
        margin-top: 1.4rem;
        padding: .85rem .95rem;
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 1rem;
        background: rgba(255,255,255,.035);
        color: rgba(246,248,247,.62);
        font-size: .82rem;
      }
      .dot { width: .5rem; height: .5rem; margin-top: .35rem; flex: none; border-radius: 50%; background: #0fb5a5; box-shadow: 0 0 16px rgba(15,181,165,.75); }
      .actions { position: relative; display: grid; grid-template-columns: 1fr; gap: .7rem; margin-top: 1.5rem; }
      a, button {
        min-height: 3rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: .9rem;
        padding: .72rem 1rem;
        border: 1px solid transparent;
        font: inherit;
        font-weight: 750;
        cursor: pointer;
        text-decoration: none;
        transition: transform .16s ease, background-color .16s ease, border-color .16s ease;
      }
      a:active, button:active { transform: scale(.985); }
      .primary { background: #0fb5a5; color: #061113; box-shadow: 0 12px 32px -18px rgba(15,181,165,.9); }
      .primary:hover { background: #13c7b6; }
      .secondary { background: rgba(255,255,255,.035); color: #f6f8f7; border-color: rgba(255,255,255,.12); }
      .secondary:hover { background: rgba(255,255,255,.07); }
      .help { margin-top: 1rem; text-align: center; color: rgba(246,248,247,.28); font-size: .72rem; }
      @media (min-width: 32rem) { .actions { grid-template-columns: 1fr 1fr; } }
      @media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; } }
    </style>
  </head>
  <body>
    <main class="wrap">
      <div class="brand"><span class="mark" aria-hidden="true">P</span><span>Pediu Aqui</span></div>
      <section class="card" aria-labelledby="error-title">
        <div class="eyebrow">Falha temporária</div>
        <h1 id="error-title">Não conseguimos carregar esta página.</h1>
        <p>Ocorreu uma falha inesperada durante o carregamento. Você pode tentar novamente sem perder o endereço que estava acessando.</p>
        <div class="status"><span class="dot" aria-hidden="true"></span><span>Se a conexão estiver normal e o erro continuar, volte ao início e tente acessar o fluxo novamente.</span></div>
        <div class="actions">
          <button class="primary" onclick="location.reload()">Tentar novamente</button>
          <a class="secondary" href="/">Voltar ao início</a>
        </div>
      </section>
      <p class="help">Pediu Aqui · experiência protegida por fallback de servidor</p>
    </main>
  </body>
</html>`;
}
