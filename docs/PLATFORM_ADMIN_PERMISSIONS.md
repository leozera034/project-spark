---
name: PLATFORM_ADMIN_PERMISSIONS
description: Matriz de permissões e segurança do administrador SaaS
type: feature
---

# Permissões do Administrador SaaS

## 1. Catálogo Global Ativo
O catálogo abaixo corresponde ao enum `public.app_permission` existente em produção. A autorização é resolvida por `private.has_permission`, e o papel global `admin_plataforma` é válido somente com `store_id IS NULL`.

| Código | Uso |
| :--- | :--- |
| `platform.stores.view` | Listar lojas e consultar os indicadores globais sanitizados de saúde/volume |
| `platform.stores.create` | Autorizar fluxos administrativos de criação/provisionamento de loja |
| `platform.stores.update` | Alterações administrativas permitidas sobre cadastro da loja |
| `platform.stores.suspend` | Suspender loja por motivo administrativo |
| `platform.stores.reactivate` | Reativar loja suspensa |
| `platform.plans.view` | Consultar catálogo e contexto administrativo de planos |
| `platform.plans.manage` | Gerir catálogo de planos quando o fluxo correspondente estiver habilitado |
| `platform.billing.view` | Consultar resumo financeiro global sanitizado |
| `platform.billing.register_payment` | Registrar pagamento administrativo por fluxo autorizado |
| `platform.audit.view` | Consultar auditoria e erros técnicos sanitizados |
| `platform.support.open_context` | Abrir contexto administrativo de suporte permitido |

Os códigos históricos `platform.dashboard.view`, `platform.health.view`, `platform.logs.view`, `platform.users.view`, `platform.stores.activate` e `platform.support.manage` não fazem parte do enum de produção e não devem ser usados em código novo sem uma migration explícita de contrato.

### Mapa dos RPCs globais atuais

| RPC | Permissão exigida |
| :--- | :--- |
| `get_platform_health_summary()` | `platform.stores.view` |
| `list_platform_stores(...)` | `platform.stores.view` |
| `get_platform_billing_summary()` | `platform.billing.view` |
| `get_platform_recent_errors(...)` | `platform.audit.view` |
| `admin_suspend_store(...)` | `platform.stores.suspend` |
| `admin_reactivate_store(...)` | `platform.stores.reactivate` |

Esses RPCs permanecem `SECURITY DEFINER` de forma intencional. Eles expõem projeções sanitizadas ou operações transacionais sobre tabelas que não devem ganhar policies globais amplas apenas para eliminar avisos do linter.

## 2. Ações Proibidas (Hard-Block)
Mesmo com papel de administrador, o desenho da plataforma não concede acesso operacional irrestrito às lojas. Permanecem fora do escopo global:
- detalhe completo de pedidos com PII do cliente;
- aceitar, recusar ou cancelar pedidos como se fosse membro da loja;
- atribuir ou gerir entregas operacionais;
- acessar tracking tokens, hashes, senhas ou tokens de autenticação;
- exclusão física de lojas ou dados operacionais.

## 3. Invariantes de Segurança

- `public.user_roles.user_roles_scope_check` exige `admin_plataforma` com `store_id IS NULL` e exige `store_id IS NOT NULL` para os demais papéis.
- `authenticated` não possui `INSERT`, `UPDATE` ou `DELETE` direto em `public.user_roles`.
- `private.is_platform_admin()` e o branch `platform.%` de `private.has_permission()` também verificam `store_id IS NULL` como defesa em profundidade.
- Os RPCs globais devem declarar uma permissão `platform.*` específica; uma checagem genérica apenas por nome de papel não é suficiente para código novo.
- A inexistência atual de um operador `admin_plataforma` em produção é tratada separadamente pelo bootstrap seguro e auditável; nenhuma conta deve ser promovida por inferência.
