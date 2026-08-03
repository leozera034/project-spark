# Auditoria de Fontes de Eventos (Fase 23)

| Fonte | Entity | Event Type | store_id | version | Ação Visual | Ação Sonora |
|-------|--------|------------|----------|---------|-------------|-------------|
| Realtime | order | created | Yes | Yes | Highlight Card | "New Order" Tone |
| Realtime | order | confirmed | Yes | Yes | Remove Alert | Stop Alert |
| Realtime | order | canceled | Yes | Yes | Banner/Toast | "Attention" Tone |
| Realtime | delivery | created | Yes | Yes | New Delivery (Courier) | "Assignment" Tone |
| Realtime | delivery | updated | Yes | Yes | Status Change | Discrete Tone |
| Time-based | order | unanswered | Yes | No | "Urgent" Label | Loop Lembrete |
| Derived | courier | unavailable | Yes | No | Banner Loja | "Attention" Tone |

**Nota:** O som nunca é disparado diretamente pelo evento. O evento dispara um refetch da projeção sanitizada `get_my_store_operational_alerts` ou contexto do entregador.
