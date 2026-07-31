# Guia de Migrations — Pediu Aqui

> Regras operacionais do banco. Válido a partir da Fase 04.

## 1. Pré-requisito verificado na Fase 04

O backend usado é **exclusivo do Pediu Aqui**. Nenhuma tabela, credencial, bucket ou função de projeto anterior (PortalExpress, MotoFácil, ArmShare ou outros) foi reaproveitada. A verificação realizada antes de aplicar a primeira migration:

- schema `public` estava vazio (nenhuma tabela pré-existente);
- nenhum enum, função ou policy anterior;
- nenhum segredo herdado no repositório.

Qualquer troca futura de backend deve repetir essa verificação **antes** de aplicar migrations.

## 2. Ordem obrigatória dentro de uma migration

1. `CREATE TABLE public.<nome> (...)` com constraints **nomeadas**
2. `GRANT` — apenas para os papéis que as policies realmente permitirem
3. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` (e `FORCE` quando aplicável)
4. `CREATE POLICY ...`

Toda tabela de loja precisa de:

```sql
store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
CONSTRAINT <tabela>_id_store_key UNIQUE (id, store_id)
```

e todo relacionamento interno da loja precisa de **FK composta**:

```sql
FOREIGN KEY (<pai>_id, store_id) REFERENCES public.<pai>(id, store_id)
```

## 3. Estado dos GRANTs nesta fase

| Papel | Acesso |
| --- | --- |
| `anon` | nenhum (revogado explicitamente) |
| `authenticated` | nenhum (revogado explicitamente) |
| `service_role` | total (uso interno de servidor) |

Na Fase 06 os grants serão abertos **tabela a tabela**, sempre acompanhados de policy correspondente. É proibido um `GRANT ALL` genérico.

## 4. Regras de escrita de migrations

- Nunca alterar os schemas `auth`, `storage`, `realtime`, `supabase_functions` ou `vault`.
- Nunca usar `ALTER DATABASE`.
- Funções sempre com `search_path` fixo; preferir `SECURITY INVOKER`.
- Não usar `CHECK` com `now()` ou qualquer expressão não imutável — usar trigger.
- Toda tabela com `updated_at` recebe o trigger `set_updated_at_<tabela>`.
- Nenhuma policy `USING (true)` para tabelas com dado de loja ou de cliente.

## 5. Seed

O seed das cinco lojas é **exclusivo de desenvolvimento e validação estrutural**. Ele:

- só executa se a tabela `stores` estiver vazia;
- não cria clientes, pedidos, usuários nem entregas reais;
- não deve ser considerado dado de produção;
- deve ser removido ou substituído antes da primeira loja real entrar em operação.

## 6. Proibições permanentes no schema

- Tabelas específicas de segmento (`pizza_flavors`, `acai_complements`, `burger_addons`, `marmita_proteins`).
- Qualquer coluna financeira de entregador (pagamento, comissão, saldo, repasse, bônus, extrato).
- Coluna de papel ou permissão em `user_profiles`.
- `store_id` artificial em entidades globais (`plans`).
- Dado de cartão, credencial de gateway ou segredo de push armazenado em tabela de negócio.
- PII em `audit_logs.context`.

## 7. Verificação após cada migration

Rodar as asserções estruturais (mesmas da Fase 04): presença de `store_id`, RLS habilitada em todas as tabelas de `public`, ausência de tabelas de segmento e ausência de campos financeiros de entregador.
