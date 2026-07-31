# Pediu Aqui — Arquitetura de Autenticação (Fase 05)

Escopo desta fase: **entrar, sair, sessão persistente, troca de senha e recuperação de acesso**.
Autorização detalhada por ação e políticas RLS operacionais continuam reservadas às Fases 06 e 07.

## Ambientes de acesso

| Ambiente | Rota de login | Credencial | Recuperação |
| --- | --- | --- | --- |
| Equipe da loja | `/entrar/loja` | e-mail + senha | link por e-mail |
| Administração da plataforma | `/entrar/admin` | e-mail + senha | link por e-mail |
| Entregador | `/entrar/entregador` | identificador + senha | redefinição pelo responsável da loja |

O entregador nunca informa e-mail. O identificador é normalizado e convertido em um
**e-mail sintético determinístico** (`<hash sha-256>@courier.pediuaqui.internal`) apenas para
satisfazer o provedor de autenticação. Esse endereço nunca é exibido, nunca recebe mensagens e
nunca aparece em log ou auditoria.

## Contexto de autenticação

O cliente nunca decide papéis. Após qualquer entrada, o aplicativo chama a função de banco
`get_my_auth_context()` (`SECURITY DEFINER`), que devolve:

- identificação do usuário e nome de exibição;
- papéis vindos exclusivamente de `user_roles`;
- lojas vinculadas;
- ambiente resolvido (`store`, `courier`, `platform_admin`, `unconfigured`);
- indicador de troca de senha obrigatória.

Nada disso é lido de `localStorage`, de metadados do token ou de estado do frontend.

## Sessão

- Uma única assinatura de `onAuthStateChange` em toda a aplicação, criada no provedor de autenticação.
- Sessão persistente com renovação automática de token pelo SDK.
- Trabalho assíncrono é executado fora do callback do SDK.
- Encerramento limpa contexto, sessão e estado de recuperação.

## Guardas de rota

Os guardas (`RequireAuth`, `RequireEnvironment`, `RequirePasswordChangeCompleted`,
`PublicOnlyRoute`) são **proteção de experiência**. Eles não substituem RLS nem validação no
servidor. Nenhuma rota autenticada abre enquanto a troca inicial de senha estiver pendente.

Retorno pós-login usa apenas caminhos internos sanitizados; qualquer URL externa é descartada.

## Redefinição de acesso do entregador

Executada por função de servidor com verificação de papel no banco: somente proprietário ou
gerente ativo da mesma loja. A senha temporária é gerada com aleatoriedade criptográfica,
exibida uma única vez e nunca persistida nem registrada. A auditoria grava a ação sem senha,
sem e-mail sintético e sem token.

## Mensagens ao usuário

Todos os erros passam por um mapeador central. O usuário recebe mensagens neutras; a
recuperação por e-mail responde sempre da mesma forma, sem revelar se a conta existe.
