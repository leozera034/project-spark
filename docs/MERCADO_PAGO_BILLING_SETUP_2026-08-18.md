# Comandiva — Mercado Pago Billing Setup

Data: 2026-08-18

## Estado atual

- Provedor de cobrança escolhido para a primeira integração: `mercado_pago`.
- O banco da Comandiva continua sendo a fonte de verdade do estado comercial.
- Mercado Pago é provedor externo de autorização/cobrança, não a fonte canônica dos planos da Comandiva.
- Nenhum preço, plano comercial, assinatura ou pagamento foi criado por esta etapa.
- A camada de banco foi desenhada para permitir troca futura de gateway sem refazer o domínio de billing.

## Estrutura canônica

- `public.plans`: definição funcional dos planos.
- `public.plan_prices`: preços por intervalo (`monthly` / `annual`) em centavos e configuração de trial.
- `public.store_subscriptions`: assinatura da loja e espelho mínimo do estado do provedor.
- `public.subscription_payments`: registros de cobrança/pagamento vinculados à assinatura.
- `private.billing_provider_plan_refs`: mapeamento entre preço canônico e ID de plano do gateway.
- `private.billing_webhook_events`: inbox idempotente e auditável de webhooks.

## Mercado Pago

A integração deverá utilizar a API de Assinaturas. O desenho previsto é:

1. criar/sincronizar planos externos a partir de `public.plan_prices`;
2. iniciar a assinatura da loja sem expor credenciais privadas ao navegador;
3. persistir os identificadores externos retornados pelo Mercado Pago;
4. receber notificações em Edge Function dedicada;
5. validar a assinatura da notificação antes de processar;
6. aplicar idempotência em `private.billing_webhook_events`;
7. consultar o recurso completo no Mercado Pago antes de alterar o estado canônico local;
8. responder ao webhook rapidamente e manter falhas auditáveis/reprocessáveis.

## Segredos esperados

Somente backend/Edge Function:

- `MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_WEBHOOK_SECRET`

A `Public Key` só deverá ser adicionada ao frontend se uma etapa futura realmente usar um componente do Mercado Pago que a exija. O Access Token nunca deve ser exposto no browser, GitHub, Lovable client env ou logs.

## Configuração manual no Mercado Pago

1. Entrar no Mercado Pago Developers.
2. Abrir **Suas integrações**.
3. Criar uma aplicação chamada **Comandiva**, caso ainda não exista uma aplicação própria para este SaaS.
4. Usar primeiro as credenciais de teste.
5. Não copiar credenciais para chats, issues ou commits.
6. A URL de webhook será configurada somente após a Edge Function dedicada ser implantada.
7. Produção só será ativada depois de E2E de assinatura, renovação, falha, cancelamento e webhook.

## Eventos previstos

A Edge Function deverá tratar apenas eventos allowlisted relevantes a billing, incluindo pagamento e eventos de assinatura suportados pela API, ignorando de forma auditável tipos desconhecidos.

## Regras de produto já previstas

A fundação suporta:

- mensal e anual;
- trial configurável por preço/plano;
- período de tolerância;
- downgrade/bloqueio gradual a ser implementado na máquina de estados;
- cortesia administrativa com responsável, motivo e validade;
- troca futura de gateway.

## Não decidido / não implementar ainda

- preços finais;
- limites do plano grátis;
- número final de dias de trial;
- desconto anual final;
- política exata de degradação por inadimplência.

Esses itens precisam virar configuração canônica antes de qualquer plano público ser criado no Mercado Pago.
