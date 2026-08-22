# Redesign da área do lojista — plano de execução

Status: em implementação na `main`.

## Objetivo
Reduzir carga cognitiva, esconder detalhes de infraestrutura e alinhar a navegação com o trabalho real da loja sem remover capacidades existentes.

## Arquitetura final
- Início
- Pedidos
- Cozinha
- Cardápio
- Entregas
- Clientes
- WhatsApp
- Relatórios
- Recursos
- Configurações

No mobile, a navegação fixa fica em: Início, Pedidos, Cozinha, Cardápio e Mais.

## Regras aplicadas
1. Linguagem de negócio acima de linguagem técnica.
2. Provider, API key, health check, jobs, hard limits, códigos internos e detalhes de infraestrutura não aparecem no fluxo normal do lojista.
3. Recursos futuros/roadmap não aparecem como se fossem funcionalidades disponíveis.
4. Operação crítica tem ação primária clara e ações destrutivas ficam secundárias.
5. Configurações são agrupadas por assunto e não por sete abas horizontais.
6. Onboarding de cardápio só domina a tela quando o catálogo está vazio.
7. Plano/cobrança aparece no contexto de Conta e plano e alertas globais ficam reservados para estados que exigem atenção.
8. Toda a interface usa a marca Comandiva.

## Checklist
- [x] Auditoria funcional e visual
- [ ] Navegação global simplificada
- [ ] Página Início orientada à operação
- [ ] Pedidos e detalhe mobile-first
- [ ] Cardápio simplificado
- [ ] Entregas consolidadas
- [ ] Clientes renomeado a partir de Crescimento
- [ ] WhatsApp simplificado
- [ ] Relatórios executivos
- [ ] Configurações agrupadas
- [ ] Cobrança contextual
- [ ] Recursos somente com itens reais
- [ ] Copy e branding Comandiva
- [ ] Revisão responsiva e acessibilidade
