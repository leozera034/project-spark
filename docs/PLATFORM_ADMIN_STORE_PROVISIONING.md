---
name: PLATFORM_ADMIN_STORE_PROVISIONING
description: Processo de provisionamento de loja e proprietário (Saga Auth + DB)
type: feature
---

# Provisionamento de Loja e Proprietário

O provisionamento é um processo crítico que envolve a criação de identidade (Auth) e domínio (PostgreSQL) de forma coordenada e idempotente.

## 1. Saga de Criação
1. **Intenção:** Registro de uma intenção de criação com UUID (`idempotency_key`).
2. **Auth:** Resolução ou criação do usuário no Supabase Auth.
3. **Domínio:** Criação da loja, perfil do usuário e atribuição do papel `proprietario` em transação única.
4. **Audit:** Registro do evento `platform.store_created`.
5. **Credencial:** Exibição única de senha temporária (se novo usuário).

## 2. Compensação e Falhas
- **Falha no Banco:** Se o registro no PostgreSQL falhar após a criação no Auth, o usuário Auth recém-criado deve ser desabilitado ou removido para evitar contas órfãs.
- **Idempotência:** O endpoint retorna o mesmo `store_id` para a mesma `idempotency_key`. Se o payload for diferente para a mesma chave, retorna erro de conflito.

## 3. Regras de Slug
- **Normalização:** Minúsculas, sem espaços, apenas alfanuméricos e hífens.
- **Reservados:** `admin`, `app`, `api`, `loja`, `suporte`, `assets`, `static`, `login`, `auth`.
- **Unicidade:** Constraint `UNIQUE` no banco de dados.

## 4. Segurança de Credenciais
- Senhas temporárias são geradas no servidor e exibidas **uma única vez** no frontend.
- Nunca persistem em logs, auditoria ou metadados do Auth.
- Troca de senha é obrigatória no primeiro acesso.
