# Pediu Aqui — Readiness Android / Capacitor

Data da revisão: 2026-08-10.

## Escopo nativo correto

O app Android é exclusivo do entregador. Cliente final continua sem instalação; loja e administração continuam web. A rota funcional de referência é `/app/entregador`.

## Estado técnico encontrado

- O projeto web usa TanStack Start + Nitro/SSR, não uma SPA estática convencional.
- O repositório ainda não contém `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/push-notifications`, projeto `android/` ou `capacitor.config.*`.
- Não há `google-services.json` no repositório, e ele não deve ser inventado.
- Não há evidência de credenciais Firebase/FCM de servidor configuradas para este projeto.
- A tabela `device_push_tokens` já existe no banco e pode ser reaproveitada após revisão do contrato de token por usuário/loja/dispositivo.

## Decisão de arquitetura antes do scaffold

Capacitor exige um diretório de assets web compilados contendo `index.html`. O build atual do TanStack Start é SSR/Nitro, então `npx cap add android` não deve ser executado até existir uma estratégia explícita para o bundle do entregador.

### Estratégia recomendada

Criar um entrypoint SPA dedicado ao entregador, reutilizando componentes, autenticação e domínio existentes, e gerar um diretório estático exclusivo para o shell nativo. O backend, Supabase e regras de autorização permanecem os mesmos. Não empacotar painel de loja, admin ou storefront no APK.

Vantagens:
- APK menor e superfície de ataque menor;
- fluxo nativo isolado do SSR público;
- permissões de localização/notificação só aparecem para entregadores;
- reduz risco de quebrar o site ao adaptar o build ao Capacitor.

## Gate para Fase 24 — shell Android

Antes de concluir:
1. definir `appId` definitivo;
2. criar build estático do entregador;
3. instalar Capacitor v8 e Android;
4. gerar `android/` e versioná-lo;
5. validar build Gradle em CI;
6. instalar APK em aparelho físico e testar login/sessão/logout.

## Gate para Fase 25 — FCM

Necessário fornecer/configurar o projeto Firebase real e o `google-services.json` correspondente. Depois:
- instalar o plugin de push;
- solicitar permissão quando aplicável;
- registrar/rotacionar token de dispositivo;
- associar token somente ao entregador autenticado e sua loja;
- remover token em logout/revogação;
- tratar foreground, background e toque na notificação;
- enviar notificações apenas de ambiente confiável do servidor.

## Gate para Fase 26 — localização

A geolocalização serve à operação do entregador e não pode ampliar acesso entre lojas. Implementar somente no shell nativo após a Fase 24, com:
- permissão just-in-time;
- fallback manual de abertura de rota;
- ausência de rastreamento contínuo quando offline/deslogado;
- retenção mínima de coordenadas;
- nenhuma localização usada como autorização.

## Status

- Fase 24: `blocked_by_architecture_and_toolchain`
- Fase 25: `blocked_by_firebase_credentials`
- Fase 26: `blocked_by_phase_24`

Esses estados não representam falha de implementação: são gates externos/arquiteturais que precisam ser resolvidos antes de gerar um artefato nativo confiável.
