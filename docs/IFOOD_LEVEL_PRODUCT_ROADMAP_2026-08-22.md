# COMANDIVA — Roadmap de maturidade estilo grande app de delivery

> Objetivo: levar a experiência de cliente, lojista, entregador e operação da plataforma ao nível de maturidade de um grande aplicativo de delivery, sem copiar marca, identidade visual ou fluxos proprietários de terceiros.
>
> Regra de execução: priorizar segurança, consistência financeira e operacional antes de efeitos visuais. Toda regra de preço, estoque, entrega, pagamento e autorização deve permanecer server-authoritative.

## Estado atual confirmado

- [x] Cardápio público mobile-first, busca, categorias e personalização de produtos.
- [x] Carrinho persistente por loja, idempotência de envio e recotação server-side.
- [x] Checkout com entrega/retirada, formas de pagamento, troco e validação server-side.
- [x] Acompanhamento por token privado e compartilhamento do link do pedido.
- [x] Stripe para pagamentos e infraestrutura de repasse/financeiro.
- [x] Operação de pedidos e fluxo de cozinha.
- [x] Entregadores, atribuição, ocorrências e ciclo de entrega.
- [x] WhatsApp Evolution integrado, estado de conexão reconciliado e automações por eventos.
- [x] Preço de entrega flexível e bairros para QA.
- [x] Produtos com disponibilidade por horário/dia, estoque, limite por pedido e estoque baixo.
- [x] Ranking `Mais pedidos` baseado em vendas reais recentes.
- [x] Recompra local segura (`Pedir novamente`) com nova recotação antes do checkout.
- [x] Otimização de imagens no aparelho antes do upload.
- [x] RPCs públicos sensíveis de fulfillment movidos para rota Edge autenticada por chave pública conhecida e service-role interno.
- [x] Índices de cobertura adicionados nos caminhos quentes de catálogo, pedido e entrega.

## P0 — Bloqueadores de produção

- [ ] Quality Gate obrigatório em `main`: TypeScript, lint, testes, build e contratos SQL.
- [ ] Smoke test automático: abrir loja, carregar fulfillment, cotar carrinho, criar pedido idempotente e acompanhar pedido.
- [ ] Teste E2E de mensagens automáticas WhatsApp para todos os eventos relevantes.
- [ ] Revisão completa de privilégios de funções `SECURITY DEFINER` e matriz de roles.
- [ ] Habilitar proteção contra senhas vazadas no Supabase Auth.
- [ ] Error budget e alertas operacionais para checkout, pagamento, automação, entrega e webhooks.
- [ ] Backup/restore testado e procedimento documentado de rollback.

## P1 — Experiência do cliente

- [ ] Favoritos locais por loja, sem exigir login.
- [ ] `Vistos recentemente` e descoberta personalizada apenas com dados locais quando não houver conta.
- [ ] Recomendações `Peça também` baseadas em coocorrência de itens de pedidos pagos/concluídos.
- [ ] Promoções e cupons server-side: valor fixo, percentual, frete grátis, pedido mínimo, janela de horário e limite de uso.
- [ ] Histórico de pedidos do cliente com mecanismo seguro de vínculo/recuperação.
- [ ] Recompra de pedido histórico com tratamento de item removido, preço alterado e opção indisponível.
- [ ] Avaliação pós-pedido de loja/entrega com proteção contra duplicidade e fraude básica.
- [ ] Busca com sinônimos, tolerância a erro e destaque de correspondência.
- [ ] Sugestões de busca e categorias populares.
- [ ] Estado offline/de rede lenta com feedback específico e recuperação segura.
- [ ] Acessibilidade AA: contraste, foco, leitores de tela e áreas de toque >= 44 px.

## P1 — Lojista

- [ ] Inbox operacional única: novos pedidos, atrasos, falhas de pagamento, WhatsApp, entregas e ocorrências.
- [ ] Ações em lote para disponibilidade, estoque e categorias.
- [ ] Central de promoções com simulação de margem antes de publicar.
- [ ] Relatórios de funil: visita → produto → carrinho → checkout → pedido pago/concluído.
- [ ] Produtos mais vistos vs. mais vendidos para detectar problema de preço/conversão.
- [ ] Sugestão de upsell e combos usando dados reais da própria loja.
- [ ] Previsão simples de demanda por faixa horária/dia.
- [ ] Centro financeiro com reconciliação pedido ↔ pagamento ↔ taxa ↔ repasse.
- [ ] Health center das integrações com ação de correção/reconexão.

## P1 — Entregador

- [ ] Tela operacional com prioridade visual por etapa e SLA.
- [ ] Navegação para loja/cliente com endereço validado e fallback.
- [ ] Prova de entrega configurável (código, foto ou confirmação) sem armazenar dado excessivo.
- [ ] Ocorrências guiadas: cliente ausente, endereço incorreto, acidente, retorno à loja.
- [ ] Reatribuição resiliente quando entregador recusa/fica offline.
- [ ] Métricas de aceite, coleta, deslocamento, conclusão e ocorrência.

## P2 — Personalização e crescimento

- [ ] Segmentos CRM derivados de comportamento: novo, recorrente, VIP, inativo, risco de churn.
- [ ] Campanhas acionadas por consentimento e limite de frequência.
- [ ] Recuperação de cliente inativo via WhatsApp/e-mail somente com consentimento válido.
- [ ] Fidelidade/cashback opcional por loja, com ledger auditável.
- [ ] Indicação/referral com antifraude básico.
- [ ] Vitrines configuráveis por horário (`Almoço`, `Promo da noite`, `Mais pedidos`).

## P2 — Performance e escala

- [ ] Orçamento de performance para storefront: LCP, INP, CLS e peso máximo de JS/imagens.
- [ ] Cache coerente do catálogo público com invalidação por versão.
- [ ] Paginação/cursor nos painéis administrativos de alto volume.
- [ ] Auditoria periódica de FKs sem índices e índices realmente utilizados.
- [ ] Rate limiting por rota pública crítica e proteção de abuso de checkout.
- [ ] Idempotência também em webhooks, automações, transferências e operações de entrega.

## P3 — Recursos avançados

- [ ] Recomendação de produtos baseada em co-compra com fallback determinístico.
- [ ] ETA dinâmico combinando preparo histórico + fila + deslocamento.
- [ ] Sugestão automática de tempo de preparo para o lojista.
- [ ] Detecção de anomalias de pedidos/pagamentos para operação da plataforma.
- [ ] Assistente de cardápio por IA com revisão humana antes de publicar alterações críticas.

## Critérios de conclusão de cada feature

Uma feature só pode ser marcada como concluída quando tiver:

1. contrato de dados e autorização definidos;
2. caminho feliz e falhas previsíveis tratados;
3. idempotência onde houver escrita crítica;
4. validação server-side para preço/estoque/pagamento/entrega;
5. estados de loading, empty, erro, offline e retry adequados no cliente;
6. acessibilidade e mobile testados;
7. logs/telemetria suficientes para diagnóstico;
8. testes automatizados compatíveis com o risco;
9. migration versionada quando houver alteração de banco;
10. rollback conhecido antes de produção.

## Próxima sequência recomendada

1. Fechar P0 de produção e WhatsApp E2E.
2. Favoritos + vistos recentemente.
3. Recomendações `Peça também`.
4. Cupons/promoções server-authoritative.
5. Avaliações e histórico do cliente.
6. Funil e inteligência operacional do lojista.
7. ETA dinâmico e otimizações de entrega.
