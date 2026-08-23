# Redesign da área do lojista — plano de execução

Status: arquitetura principal aplicada na `main`; Quality Gate e revisão visual final são os critérios de fechamento.

## Objetivo
Reduzir carga cognitiva, esconder detalhes de infraestrutura e alinhar a navegação com o trabalho real da loja sem remover capacidades existentes.

A referência de produto é uma central operacional madura: filas claras, ação primária evidente, navegação persistente, contexto único de loja e separação entre operação, gestão e conta. A identidade visual, terminologia e fluxos continuam sendo da Comandiva.

## Arquitetura final
### Navegação principal
1. Início
2. Pedidos
3. Cozinha
4. Cardápio
5. Entregas
6. Clientes
7. WhatsApp
8. Relatórios

### Conta
9. Recursos
10. Configurações

`Conta e plano` fica dentro de Configurações e não ocupa a navegação principal.

No mobile, a navegação fixa é exatamente: Início, Pedidos, Cozinha, Cardápio e Mais. O menu Mais reúne Entregas, Clientes, WhatsApp, Relatórios, Recursos e Configurações.

## Contexto global de loja
- A loja selecionada vale para toda a área autenticada do lojista.
- O seletor de loja fica no shell global, não espalhado em páginas individuais.
- Pedidos, cozinha, entregas, clientes, relatórios, cardápio e conta usam o mesmo contexto.
- Em contas com várias lojas, a seleção é mantida durante a sessão.
- Trocar a loja invalida consultas ativas para impedir mistura visual de dados entre operações.
- O shell exibe a situação aberta/fechada da loja e destaca novos pedidos na navegação.

## Regras aplicadas
1. Linguagem de negócio acima de linguagem técnica.
2. Provider, API key, health check, jobs, hard limits, códigos internos e detalhes de infraestrutura não aparecem no fluxo normal do lojista.
3. Recursos futuros/roadmap não aparecem como se fossem funcionalidades disponíveis.
4. Operação crítica tem ação primária clara e ações destrutivas ficam secundárias.
5. Configurações são agrupadas por assunto, sem depender de sete abas horizontais no mobile.
6. Onboarding de cardápio só domina a tela quando o catálogo está vazio.
7. Plano/cobrança aparece em Conta e plano e alertas globais ficam reservados para estados que exigem atenção.
8. Toda a interface usa a marca Comandiva.
9. O fluxo operacional principal é Pedidos → Cozinha → Entregas.
10. Páginas filhas não criam seletores de loja paralelos quando o shell já definiu o contexto.
11. Smart Delivery não é uma área de navegação do lojista. A rota antiga redireciona para Entregas e a central mostra apenas um estado simples da estimativa inteligente, sem pause/kill switch, filas, consumo, provider, chave ou diagnóstico interno.
12. Avaliações, Financeiro e Ajuda podem existir tecnicamente como capacidades/deep links, mas não fazem parte da arquitetura primária auditada da área do lojista.
13. Pedidos não inventam filtros: busca, Entrega/Retirada e atrasados; status são representados pelas filas existentes.
14. A Home usa somente dados operacionais e métricas que o produto já possui.

## Implementação concluída
- [x] Auditoria funcional e visual
- [x] Navegação global simplificada
- [x] Escopo global de loja
- [x] Status global da loja e alerta de novos pedidos no shell
- [x] Página Início orientada à operação e sem áreas inventadas no resumo
- [x] Pedidos com filas reais, filtros reais e ação primária clara
- [x] Cozinha integrada ao mesmo contexto operacional
- [x] Cardápio simplificado e onboarding condicionado a catálogo vazio
- [x] Serviço opcional de montagem oculto quando não está contratável
- [x] Entregas consolidadas
- [x] Entregadores e devoluções integrados à central de Entregas
- [x] Smart Delivery removido da navegação e reduzido a estado simples em Entregas
- [x] Deep link técnico antigo redirecionado para a experiência consolidada
- [x] Clientes renomeado a partir de Crescimento
- [x] WhatsApp simplificado
- [x] Relatórios gerais do negócio
- [x] Configurações agrupadas em Loja, Operação, Entrega e retirada, Pagamentos e Conta e plano
- [x] Cobrança contextual
- [x] Recursos somente com itens reais
- [x] Copy e branding Comandiva
- [x] Guard de UX alinhado à arquitetura auditada

## Critérios para considerar fechado
- [ ] Quality Gate completo verde (`hygiene`, segurança estática, merchant UX, marca, storefront UX, lint, build, typecheck e smoke tests)
- [ ] Revisão visual final de desktop e mobile nas telas principais
- [ ] Navegação principal sem Avaliações, Financeiro, Ajuda, Plano ou Smart Delivery
- [ ] Mobile com Início, Pedidos, Cozinha, Cardápio e Mais sem overflow estrutural
- [ ] Entregas sem controles/diagnósticos internos de roteamento
- [ ] Cardápio sem estado administrativo de preço/roadmap exposto ao lojista
- [ ] Smoke de troca entre lojas mantendo isolamento visual dos dados
