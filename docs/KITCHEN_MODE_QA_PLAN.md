# Modo Cozinha — Plano de verificação (Fase 17)

Executado nesta entrega
=======================

**Estático / banco**

| Verificação | Como | Resultado |
| --- | --- | --- |
| Projeção sem colunas proibidas | `pg_get_functiondef` × 20 padrões de PII/financeiro | 0 ocorrências |
| RPC exige `kitchen.view` | leitura da definição | presente |
| RPC é `SECURITY DEFINER` | `pg_proc.prosecdef` | sim |
| `anon` não executa a RPC nem os wrappers | `has_function_privilege` | falso em ambos |
| `authenticated` executa | `has_function_privilege` | verdadeiro |
| Nenhuma policy aberta em `store_order_realtime_events` | `pg_policies` com `qual = true` | 0 |
| Frontend sem campo proibido | `rg` em `src/kitchen` e na rota | 0 ocorrências |
| Sem `new_status` / `force_status` / `service_role` no cliente | `rg` | 0 ocorrências |
| Lint e tipos | `eslint`, `tsgo --noEmit` | limpos |

**Limitação declarada:** o banco está sem pedidos (`orders = 0`), então a fila povoada, os
contadores e as disputas de concorrência **não** foram exercitados com dados reais. Não foram
inseridos pedidos fictícios no banco de produção para gerar evidência. O roteiro abaixo é o que
deve ser rodado no primeiro ambiente com pedidos.

Roteiro pendente de execução com dados
======================================

1. **Fila** — pedidos `aceito` e `em_preparo` aparecem; `pendente`, `pronto`, `entregue`,
   `cancelado`, `recusado` não aparecem.
2. **Conteúdo** — número, itens, quantidades, variações, opções, porções e observação
   corretos; nenhum dado de cliente, entrega, pagamento ou valor em tela.
3. **Ações** — iniciar preparo move para “Em preparo”; marcar pronto remove da cozinha e muda o
   acompanhamento público.
4. **Concorrência** — duas abas na mesma ação: uma vence, a outra recebe o aviso de conflito e
   recarrega; histórico e auditoria com uma linha só.
5. **Cancelamento externo** — pedido cancelado no painel some da cozinha em segundos.
6. **Perfis** — cozinha entra; atendente e entregador recebem negação; usuário de outra loja não
   vê nada.
7. **Tempo** — relógio do aparelho adiantado em 1 h não altera o contador.
8. **Rede** — Realtime desligado cai para 20 s; offline mostra o aviso e bloqueia ações;
   reconexão recarrega sozinha.
9. **Acessibilidade** — teclado, foco visível, zoom 200%, contraste AA, sem anúncio repetido do
   relógio.
10. **Privacidade** — `console` e rede sem PII; título da aba sem número de pedido.
