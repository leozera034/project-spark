# Comandiva — Readiness Android / Capacitor

Data da revisão: 2026-08-19.

## Escopo nativo correto

O app Android é exclusivo do entregador. Cliente final continua sem instalação; loja e administração continuam web. A rota funcional de referência é `/app/entregador`.

## Estado técnico atual

- O projeto web usa TanStack Start + Nitro/SSR, não uma SPA estática convencional.
- O repositório ainda não contém `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/push-notifications`, projeto `android/` ou `capacitor.config.*`.
- Não há `google-services.json` no repositório, e ele não deve ser inventado.
- Não há credenciais Firebase/FCM reais configuradas para o Comandiva neste momento.
- A tabela `device_push_tokens` foi endurecida para armazenar token por entregador/dispositivo, instalação Firebase, versão do app, timestamps de refresh, desativação e erro.
- O backend FCM provider-ready já existe: readiness com `validate_only`, outbox privada, deduplicação, retry/backoff, invalidação de token, limpeza de tokens antigos, worker agendado e gatilho de entrega atribuída.
- Nenhum push real é enviado enquanto `FIREBASE_PROJECT_ID`, conta de serviço e o probe `validate_only` não estiverem homologados.

## Decisão de arquitetura antes do scaffold

Capacitor exige um diretório de assets web compilados contendo `index.html`. O build atual do TanStack Start é SSR/Nitro, então `npx cap add android` não deve ser executado até existir uma estratégia explícita para o bundle do entregador.

### Estratégia recomendada

Criar um entrypoint SPA dedicado ao entregador, reutilizando componentes, autenticação e domínio existentes, e gerar um diretório estático exclusivo para o shell nativo. O backend, Supabase e regras de autorização permanecem os mesmos. Não empacotar painel de loja, admin ou storefront no APK.

Vantagens:
- APK menor e superfície de ataque menor;
- fluxo nativo isolado do SSR público;
- permissões de localização/notificação só aparecem para entregadores;
- reduz risco de quebrar o site ao adaptar o build ao Capacitor.

## Fase 24 — shell Android

Ainda pendente:
1. definir o `appId` definitivo;
2. criar build estático dedicado ao entregador;
3. instalar Capacitor/Android no projeto;
4. gerar e versionar `android/`;
5. validar build Gradle em CI;
6. instalar APK em aparelho físico e testar login/sessão/logout.

## Fase 25 — FCM

### Backend concluído

Já existe:
- contrato provider-neutral `PushProvider`;
- readiness do FCM por `validate_only`, sem entrega real;
- autenticação OAuth 2.0 para HTTP v1 preparada no servidor;
- outbox privada por token;
- idempotência e `FOR UPDATE SKIP LOCKED` no worker;
- retry/backoff e suporte a `Retry-After`;
- invalidação de token para erros conhecidos como `UNREGISTERED`;
- limpeza automática de tokens desatualizados;
- registro/rotação de token restrito ao entregador autenticado da própria loja;
- cron seguro autenticado por segredo armazenado no Supabase Vault;
- gatilho não bloqueante `delivery.assigned` para nova entrega atribuída.

### Cliente ainda bloqueado

Para receber push em um aparelho real ainda é necessário:
- criar/configurar o projeto Firebase real do Comandiva;
- configurar `FIREBASE_PROJECT_ID` e a conta de serviço no ambiente confiável do Supabase;
- obter o `google-services.json` do app Android correto;
- concluir a Fase 24 e instalar o plugin nativo de push;
- solicitar permissão de notificação quando aplicável;
- registrar e rotacionar o token usando `register_my_courier_push_token`;
- remover/desativar token em logout/revogação;
- tratar foreground, background e toque na notificação;
- validar o fluxo completo em aparelho físico.

Importante: backend provider-ready não significa que push no Android já está operacional. O canal de recebimento no dispositivo depende do shell nativo e das credenciais Firebase reais.

## Fase 26 — localização

A geolocalização serve à operação do entregador e não pode ampliar acesso entre lojas. Implementar somente no shell nativo após a Fase 24, com:
- permissão just-in-time;
- fallback manual de abertura de rota;
- ausência de rastreamento contínuo quando offline/deslogado;
- retenção mínima de coordenadas;
- nenhuma localização usada como autorização.

## Status

- Fase 24: `blocked_by_android_shell`
- Fase 25 backend: `provider_ready_core_complete`
- Fase 25 Firebase runtime: `blocked_by_firebase_credentials`
- Fase 25 Android receiver: `blocked_by_phase_24_and_firebase_client_config`
- Fase 26: `blocked_by_phase_24`

Os bloqueios acima são gates externos/arquiteturais. O backend FCM permanece fail-closed até os pré-requisitos reais serem configurados e homologados.
