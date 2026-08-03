---
name: PLATFORM_ADMIN_PERMISSIONS
description: Matriz de permissões e segurança do administrador SaaS
type: feature
---

# Permissões do Administrador SaaS

## 1. Ações Autorizadas
O catálogo de permissões globais é definido no enum `public.app_permission` e validado via `private.has_permission`.

| Código | Descrição |
| :--- | :--- |
| `platform.dashboard.view` | Ver indicadores globais de saúde e volume |
| `platform.stores.view` | Listar e filtrar todas as lojas |
| `platform.stores.create` | Criar nova loja e provisionar proprietário |
| `platform.stores.update` | Editar dados administrativos e contato da loja |
| `platform.stores.activate` | Aprovar e ativar loja para operação |
| `platform.stores.suspend` | Suspender loja manualmente por motivo administrativo |
| `platform.stores.reactivate` | Reativar loja suspensa |
| `platform.users.view` | Consultar diretório sanitizado de usuários Auth |
| `platform.health.view` | Ver integridade técnica dos serviços |
| `platform.logs.view` | Consultar logs técnicos sanitizados |
| `platform.audit.view` | Consultar trilha de auditoria imutável |
| `platform.support.manage` | Criar e gerir casos de suporte assistido |

## 2. Ações Proibidas (Hard-Block)
Mesmo com papel de administrador, as seguintes ações são negadas por RLS e lógica de servidor:
- `orders.view_full_detail`: Ver endereço ou telefone do cliente.
- `orders.process_actions`: Aceitar, recusar ou cancelar pedidos operacionais.
- `deliveries.manage`: Atribuir ou gerir entregas.
- `tracking.view_secret`: Acessar tracking tokens ou hashes.
- `auth.view_passwords`: Visualizar senhas ou tokens de acesso.
- `store.delete`: Exclusão física de lojas ou dados operacionais.

## 3. Implementação de Segurança
```sql
-- Helper de autorização global
CREATE OR REPLACE FUNCTION private.has_platform_permission(_required_action public.app_permission)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN private.permission_roles pr ON pr.role = ur.role
    WHERE ur.user_id = auth.uid()
      AND ur.store_id IS NULL
      AND ur.role = 'admin_plataforma'
      AND pr.permission = _required_action
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
```
