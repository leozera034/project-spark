# Auditoria de reprodutibilidade das migrations

Status: **P1 — não reproduzível do zero**.

Esta nota registra achados da auditoria iniciada ao tentar executar os testes pgTAP do checkout em uma stack Supabase local limpa. Ela não altera o modelo de produção; serve para impedir que problemas distintos sejam mascarados dentro do PR de atomicidade do checkout.

## Bloqueio 1 — fixture de entregadores depende de Auth externo

A migration `20260803115043_702b64ca-87cc-4aa3-87a8-ba9bacc9e34b.sql` cria perfis, papéis e entregadores de QA com UUIDs determinísticos e também tentava inserir `courier_auth_identities` para os mesmos UUIDs.

`courier_auth_identities.auth_user_id` possui FK real para `auth.users`. Em uma instalação limpa esses usuários Auth não existem, então o replay da migration falha antes de completar o schema.

Regra de correção: migrations SQL não devem fabricar senha/credencial Auth. O vínculo de login só pode ser criado quando o usuário Auth correspondente existir; fixtures puramente relacionais podem permanecer inertes.

## Bloqueio 2 — duas fundações de billing incompatíveis

A fundação inicial já cria `subscription_status`, `plans`, `store_subscriptions` e `subscription_payments` com um contrato usado por migrations posteriores.

A migration `20260803150000_phase_22_billing_foundation.sql` tenta recriar tipos e tabelas com os mesmos nomes, mas com outro contrato (campos/status/unidades diferentes). Isso não é resolvível corretamente com `IF NOT EXISTS`: fazê-lo esconderia uma divergência de modelo.

Migrations posteriores de provisionamento continuam lendo/escrevendo o contrato anterior (`plans.monthly_price`, `store_subscriptions.monthly_price`, `due_day`, `grace_days`, etc.), o que reforça que o histórico precisa ser reconciliado contra o estado canônico do ambiente antes de qualquer consolidação.

## Condição de aceite

1. Identificar o schema financeiro canônico a partir do ambiente de desenvolvimento/staging e do código efetivamente usado.
2. Converter migrations concorrentes em evolução explícita ou remover uma migration nunca aplicada somente quando isso for comprovado pelo histórico remoto.
3. `supabase db reset`/stack local deve reconstruir o banco completo do zero sem intervenção manual.
4. Fixtures QA não podem depender de `auth.users` inexistentes nem criar credenciais por SQL.
5. Adicionar teste de replay integral das migrations no CI.

## Separação de escopo

Os testes de atomicidade do checkout usam uma cadeia isolada das migrations de julho que contém o schema e as funções efetivas do checkout, mais a migration P0. Isso permite provar o bug/correção do checkout sem fingir que a dívida histórica de billing já foi resolvida.
