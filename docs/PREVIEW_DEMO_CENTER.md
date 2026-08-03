# Central Demo do Preview

Rota canônica: `/preview/demo`. Não existe rota alternativa (`/admin/qa` não foi criada).

## Ambiente

A Central Demo só é servida quando `APP_ENV` está em `preview`, `development` ou `staging`.
Comportamento fail-closed: ausência ou valor desconhecido de `APP_ENV` nega o acesso, o endpoint
responde 404 e a rota não renderiza perfis nem cria contas. O gate é sempre server-side — nunca
hostname, `Origin`, `Referer`, subdomínio, parâmetro de URL ou flag de frontend.

## Chave de acesso

`QA_PREVIEW_ACCESS_KEY` existe somente como secret do ambiente:

- não versionada, não hardcoded, não incluída em migration nem no bundle;
- enviada apenas por POST (server function), nunca em query string;
- comparada por digest SHA-256 com `timingSafeEqual` (tempo constante);
- protegida por rate limit por janela de 60 segundos;
- logs registram apenas "unlock autorizado" ou "unlock recusado", sem valores.

O sucesso emite uma capacidade QA de 30 minutos em cookie HttpOnly, `Secure`, `SameSite=Lax`,
cifrado com `QA_SESSION_SECRET` e vinculada ao valor corrente de `APP_ENV`. A capacidade não
autoriza nada além de abrir sessões demo.

## Login demo

Fluxo, por perfil escolhido:

1. o endpoint valida ambiente e capacidade QA;
2. resolve a conta Auth real do perfil (o entregador é resolvido pelo identificador interno,
   consultando `user_roles` da loja);
3. gera um magic link pela Admin API e devolve **apenas** o `token_hash`;
4. o navegador chama `supabase.auth.verifyOtp`, criando uma sessão Auth legítima;
5. o papel real é validado pelos guards e RLS existentes;
6. redirecionamento para a rota canônica do perfil.

Nunca são devolvidos: senha, service role, refresh token administrativo, JWT administrativo ou
sessão pronta de outro usuário. Nenhuma senha compartilhada ou fixa é usada.

## Troca segura de perfil

Antes de autenticar a próxima conta, a Central Demo remove canais Realtime, encerra a sessão atual,
limpa o cache do TanStack Query, apaga chaves locais de carrinho, wizard, checkout, tracking e
contexto de loja/entregador, limpa `sessionStorage` e normaliza o título da página (removendo
contadores de alerta). Só depois a nova sessão é criada e validada.

## Produção

Em produção `APP_ENV` não pertence à allowlist, portanto: a rota responde indisponível, as server
functions negam, nenhuma conta ou fixture demo é criada e nenhuma credencial é incluída no bundle.
Não existe botão oculto nem parâmetro de URL capaz de ativar a Central Demo.
