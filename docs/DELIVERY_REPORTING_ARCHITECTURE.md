# Arquitetura de Relatórios de Entrega

## Camada de Dados
- **Fonte Canônica:** View ou CTE privada (`private.completed_delivery_facts`).
- **Agregados:** Derivados em tempo real via RPC, sem colunas incrementáveis.

## Segurança e Privacidade
- **Isolamento:** RLS por `store_id` + Verificação de permissão `delivery_reports.view`.
- **Sanitização:** Remoção absoluta de PII (nome completo, telefone, endereço) e dados financeiros.
- **Acesso:** Entregadores acessam apenas seus próprios contadores; Lojas acessam comparativo operacional.
