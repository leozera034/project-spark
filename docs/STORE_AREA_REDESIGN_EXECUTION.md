# Redesign da área do lojista — plano de execução

Status: arquitetura global aplicada na `main`; validação final de build, responsividade e acessibilidade ainda pendente.

## Objetivo
Reduzir carga cognitiva, esconder detalhes de infraestrutura e alinhar a navegação com o trabalho real da loja sem remover capacidades existentes.

A referência de produto é uma central operacional de marketplace madura: filas claras, ação primária evidente, navegação persistente, contexto único de loja e separação entre operação, gestão e conta. A identidade visual, terminologia e fluxos continuam sendo da Comandiva.

## Arquitetura final
### Operação
- Início
- Pedidos
- Cozinha
- Entregas

### Gestão
- Cardápio
- Clientes
- WhatsApp
- Relatórios

### Conta
- Recursos
- Configurações

No mobile, a navegação fixa fica em: Início, Pedidos, Cozinha, Cardápio e Mais.

## Contexto global de loja
- A loja selecionada passa a valer para toda a área autenticada do lojista.
- O seletor de loja fica no shell global, não espalhado em páginas individuais.
- Pedidos, cozinha, entregas, clientes, relatórios, cardápio e conta usam o mesmo contexto.
- Em contas com várias lojas, a seleção é mantida durante a sessão.
- Trocar a loja invalida consultas ativas para impedir mistura visual de dados entre operações.

## Regras aplicadas
1. Linguagem de negócio acima de linguagem técnica.
2. Provider, API key, health check, jobs, hard limits, códigos internos e detalhes de infraestrutura não aparecem no fluxo normal do lojista.
3. Recursos futuros/roadmap não aparecem como se fossem funcionalidades disponíveis.
4. Operação crítica tem ação primária clara e ações destrutivas ficam secundárias.
5. Configurações são agrupadas por assunto e não por sete abas horizontais.
6. Onboarding de cardápio só domina a tela quando o catálogo está vazio.
7. Plano/cobrança aparece no contexto de Conta e plano e alertas globais ficam reservados para estados que exigem atenção.
8. Toda a interface usa a marca Comandiva.
9. O fluxo operacional principal é Pedidos → Cozinha → Entregas.
10. Páginas filhas não criam seletores de loja paralelos quando o shell já definiu o contexto.

## Implementação concluída
- [x] Auditoria funcional e visual
- [x] Navegação global simplificada
- [x] Escopo global de loja
- [x] Página Início orientada à operação
- [x] Pedidos e detalhe mobile-first
- [x] Cozinha integrada ao mesmo contexto operacional
- [x] Cardápio simplificado
- [x] Entregas consolidadas
- [x] Entregadores e devoluções integrados à central de Entregas
- [x] Clientes renomeado a partir de Crescimento
- [x] WhatsApp simplificado
- [x] Relatórios executivos
- [x] Configurações agrupadas
- [x] Cobrança contextual
- [x] Recursos somente com itens reais
- [x] Copy e branding Comandiva

## Validação restante antes de considerar fechado
- [ ] Executar Quality Gate completo (`lint`, `typecheck`, `build` e smoke tests)
- [ ] Revisar visualmente desktop, tablet e mobile com dados reais
- [ ] Revisar navegação por teclado, foco, leitores de tela e contraste
- [ ] Fazer smoke de troca entre duas lojas para confirmar isolamento visual imediato
- [ ] Confirmar que deep links técnicos antigos não precisam permanecer expostos ao lojista
