# Pediu Aqui — Roadmap de Implementação

Regras gerais: uma fase por vez; nenhuma fase inicia antes de suas dependências; nenhuma funcionalidade fora da fase; nenhum avanço automático para a fase seguinte.

Legenda de áreas: `DOC` documentação, `UI` interface, `DB` banco, `SEC` segurança, `OPS` operação/infra, `APP` Android.

---

## Fase 01 — Fundação e documentação
- **Objetivo:** criar a fonte de verdade, decisões, glossário, pendências e o mapa completo de fases.
- **Dependências:** nenhuma.
- **Áreas:** DOC.
- **Riscos:** documentação contraditória; escopo mal delimitado.
- **Conclusão:** os cinco documentos existem, sem contradição, com decisões e pendências registradas.
- **Proibido:** banco, telas, autenticação, integrações, pacotes, identidade visual, código funcional.

## Fase 02 — Identidade visual e design system
- **Objetivo:** marca, SVG master, tokens de cor, tipografia, espaçamento, raios, sombras, estados e componentes base.
- **Dependências:** 01.
- **Áreas:** DOC, UI.
- **Riscos:** cores fixas espalhadas; estética genérica; tokens insuficientes para temas por loja.
- **Conclusão:** tokens definidos em CSS global, componentes base documentados, marca em fonte única.
- **Proibido:** banco, autenticação, pedidos, integrações.
- **Status:** concluída em 2026-07-30. Entregas: `tools/brand-geometry.mjs`, `tools/generate-brand-assets.mjs`, `npm run brand:generate`, `public/brand/*` (36 ativos), `docs/BRAND_GUIDELINES.md`, tokens OKLCH em `src/styles.css`, componentes de marca em `src/components/brand/BrandLogo.tsx` e galeria em `/design-system`.

## Fase 03 — Protótipo navegável
- **Objetivo:** telas estáticas dos quatro ambientes com dados fictícios locais, validando fluxo e UX.
- **Dependências:** 02.
- **Áreas:** UI.
- **Riscos:** protótipo virar produção sem revisão; dados fictícios vazarem para fases seguintes.
- **Conclusão:** jornadas principais navegáveis em mobile e desktop.
- **Proibido:** banco, escrita real, autenticação, realtime.

## Fase 04 — Arquitetura do banco — CONCLUÍDA
- **Objetivo:** modelagem física das entidades, chaves, índices, enums e migrations iniciais no Supabase próprio.
- **Dependências:** 01, 03.
- **Áreas:** DB.
- **Riscos:** modelo específico de alimentação; falta de `store_id`; ausência de GRANTs.
- **Conclusão:** migrations aplicadas e documentadas, com catálogo genérico validado nos cinco modelos.
- **Proibido:** telas conectadas, dados reais, lógica de pedidos.
- **Resultado:** 30 tabelas, 13 enums, FKs compostas por `(id, store_id)`, RLS habilitada e forçada sem policies, seed determinístico de 5 modelos e asserções estruturais aprovadas. Documentado em `docs/DATABASE_ARCHITECTURE.md` e `docs/DATABASE_MIGRATION_GUIDE.md`. Backend confirmado como exclusivo do Pediu Aqui (schema `public` vazio antes da primeira migration).

## Fase 05 — Autenticação
- **Objetivo:** login de lojista e entregador, sessão persistente, recuperação de acesso.
- **Dependências:** 04.
- **Áreas:** DB, SEC, UI.
- **Riscos:** sessão perdida na rua; recuperação insegura.
- **Conclusão:** login e logout funcionais nos ambientes autenticados.
- **Proibido:** permissões finas, pedidos.

## Fase 06 — Multi-tenancy e RLS
- **Objetivo:** isolamento por `store_id`, RLS com negação por padrão em todas as tabelas operacionais.
- **Dependências:** 04, 05.
- **Áreas:** DB, SEC.
- **Riscos:** política permissiva; recursão em políticas; tabela sem RLS.
- **Conclusão:** teste de acesso cruzado entre duas lojas falha em todas as tabelas.
- **Proibido:** liberar leitura ampla "temporariamente".
- **Status:** CONCLUÍDA (2026-07-31). Schema `private` com funções de contexto, 31 tabelas com policies por `store_id`, catálogo público por coluna, entregador restrito à própria loja e administração sem acesso a dado de cliente. Documentado em `docs/RLS_POLICY_MATRIX.md`.

## Fase 07 — Perfis e permissões
- **Objetivo:** `user_roles`, função de verificação de papel, autorização por ação no servidor.
- **Dependências:** 06.
- **Áreas:** DB, SEC.
- **Riscos:** escalada de privilégio; papel no frontend.
- **Conclusão:** cada perfil só executa suas ações, validado no backend.
- **Proibido:** decisão de permissão apenas no cliente.

## Fase 08 — Configurações da loja
- **Objetivo:** dados da loja, slug, tema por tokens, horários, bairros, taxas, pedido mínimo, formas de pagamento, retirada e entrega.
- **Dependências:** 07.
- **Áreas:** DB, UI.
- **Riscos:** slug enumerável; tema inválido; fuso horário.
- **Conclusão:** loja configurável de ponta a ponta pelo proprietário.
- **Proibido:** CSS ou JS arbitrário por loja.

## Fase 09 — Catálogo básico
- **Objetivo:** categorias e produtos simples, ordenação, destaque, esgotado, imagens.
- **Dependências:** 08.
- **Áreas:** DB, UI.
- **Riscos:** cadastro cansativo; imagens pesadas.
- **Conclusão:** loja cadastra e organiza catálogo simples em poucos toques.
- **Proibido:** variações e grupos ainda.

## Fase 10 — Variações e grupos de opções
- **Objetivo:** variações, grupos único/múltiplo, mínimo, máximo, obrigatório, preço adicional, venda por unidade, quantidade e peso, combos e promoções simples.
- **Dependências:** 09.
- **Áreas:** DB, UI.
- **Riscos:** complexidade excessiva; regras min/max inconsistentes.
- **Conclusão:** os cinco modelos (hamburgueria, pizzaria, marmitaria, açaí, mercado) são representáveis sem tabela específica.
- **Proibido:** tabelas por segmento.

## Fase 11 — Cardápio público
- **Objetivo:** `/loja/{slug}` com identidade da loja, aberto/fechado, categorias, produtos, disponibilidade.
- **Dependências:** 10.
- **Áreas:** UI, SEC.
- **Riscos:** exposição de dados não publicáveis; loja suspensa exibindo motivo.
- **Conclusão:** cardápio público rápido, legível e sem dados internos.
- **Proibido:** qualquer escrita pelo cliente.

## Fase 12 — Fluxo inicial do cliente
- **Objetivo:** primeiro nome, escolha entrega ou retirada, persistência local controlada.
- **Dependências:** 11.
- **Áreas:** UI.
- **Riscos:** perda de dados ao voltar.
- **Conclusão:** uma decisão por etapa, com retorno sem perda.
- **Proibido:** exigir e-mail, senha ou CPF.

## Fase 13 — Endereço
- **Objetivo:** bairro por lista, rua, número, sem número, complemento, referência, rótulo, coordenadas opcionais e confirmação obrigatória.
- **Dependências:** 12.
- **Áreas:** UI, DB.
- **Riscos:** endereço assumido automaticamente; bairro fora de cobertura.
- **Conclusão:** endereço sempre confirmado; taxa e mínimo derivados do bairro.
- **Proibido:** depender exclusivamente de mapa.

## Fase 14 — Carrinho
- **Objetivo:** itens, opções, quantidades, observações, preservação e retomada.
- **Dependências:** 13.
- **Áreas:** UI.
- **Riscos:** preço do cliente tratado como confiável.
- **Conclusão:** carrinho persistente e claro, com totais apenas informativos.
- **Proibido:** confiar em preço local.

## Fase 15 — Checkout
- **Objetivo:** telefone, forma de pagamento informativa, revisão e confirmação.
- **Dependências:** 14.
- **Áreas:** UI.
- **Riscos:** campos demais; erro técnico exibido.
- **Conclusão:** checkout concluído em poucos toques em celular simples.
- **Proibido:** gateway, cartão, cobrança.

## Fase 16 — Criação segura de pedido
- **Objetivo:** validação no servidor, recálculo de preço, congelamento de valores, idempotência, verificação de loja aberta e disponibilidade, tracking token não enumerável.
- **Dependências:** 15, 07.
- **Áreas:** SEC, DB.
- **Riscos:** manipulação de preço; pedido duplicado; loja fechada recebendo pedido.
- **Conclusão:** duas submissões idênticas geram um único pedido; preços vêm do servidor.
- **Proibido:** aceitar totais enviados pelo cliente.

## Fase 17 — Acompanhamento do pedido
- **Objetivo:** página pública de status por tracking token, com linguagem simples.
- **Dependências:** 16.
- **Áreas:** UI, SEC.
- **Riscos:** enumeração de pedidos; vazamento de dados de outro cliente.
- **Conclusão:** cliente acompanha o próprio pedido sem login.
- **Proibido:** expor dados internos da loja.

## Fase 18 — Painel de pedidos
- **Objetivo:** filas por status, realtime, destaque, aceitar, recusar com motivo, preparo, pronto, cancelar com motivo, histórico.
- **Dependências:** 16, 07.
- **Áreas:** UI, DB.
- **Riscos:** transição inválida; pedido perdido por conexão.
- **Conclusão:** máquina de estados respeitada com histórico completo.
- **Proibido:** editar pedido silenciosamente.

## Fase 19 — Modo cozinha
- **Objetivo:** interface simplificada e legível a distância.
- **Dependências:** 18.
- **Áreas:** UI.
- **Riscos:** poluição de informação.
- **Conclusão:** apenas dados de preparo e duas ações.
- **Proibido:** dados financeiros e administrativos.

## Fase 20 — Gestão de equipe
- **Objetivo:** convidar, ativar, desativar e atribuir papéis dentro da loja.
- **Dependências:** 07.
- **Áreas:** UI, SEC.
- **Riscos:** concessão indevida de papel.
- **Conclusão:** proprietário controla a equipe; ações auditadas.
- **Proibido:** papel global concedido por lojista.

## Fase 21 — Gestão de entregadores
- **Objetivo:** cadastro, vínculo único com a loja, ativo/inativo, atribuição e troca de entregador.
- **Dependências:** 18, 20.
- **Áreas:** UI, DB.
- **Riscos:** entregador em duas lojas; aceite duplo.
- **Conclusão:** atribuição consistente e exclusiva por loja.
- **Proibido:** qualquer campo financeiro.

## Fase 22 — Experiência web do entregador
- **Objetivo:** online/offline, lista de entregas, aceite, chegada, coleta, início, confirmação de entrega e ocorrências.
- **Dependências:** 21.
- **Áreas:** UI.
- **Riscos:** uso difícil na rua; conexão instável.
- **Conclusão:** operação completa com uma mão e tolerância a falha de rede.
- **Proibido:** ver pedidos de outra loja.

## Fase 23 — Contador e relatórios
- **Objetivo:** entregas concluídas por período, histórico individual e comparação operacional.
- **Dependências:** 22.
- **Áreas:** DB, UI.
- **Riscos:** contagem inflada; exibição de valores.
- **Conclusão:** contador derivado de `entregue`, sem qualquer valor financeiro.
- **Proibido:** campo incrementado manualmente.

## Fase 24 — Painel administrativo do SaaS
- **Objetivo:** lojas, usuários, logs, auditoria, suporte e saúde da plataforma.
- **Dependências:** 07, 18.
- **Áreas:** UI, SEC.
- **Riscos:** acesso a dados de loja sem justificativa.
- **Conclusão:** ações sensíveis auditadas com ator e motivo.
- **Proibido:** distribuir entregas ou alterar pedidos silenciosamente.

## Fase 25 — Planos e mensalidades
- **Objetivo:** planos, valor, vencimento, tolerância, status, desconto, cortesia, histórico, suspensão e reativação.
- **Dependências:** 24.
- **Áreas:** DB, UI.
- **Riscos:** suspensão apagando dados; mensagem constrangedora ao cliente final.
- **Conclusão:** suspensão preserva tudo e o cardápio exibe mensagem neutra.
- **Proibido:** cobrança automática.

## Fase 26 — Som e notificações web
- **Objetivo:** som de pedido novo, destaque e alerta de pedido sem resposta.
- **Dependências:** 18.
- **Áreas:** UI, OPS.
- **Riscos:** som bloqueado pelo navegador.
- **Conclusão:** desbloqueio explícito por gesto e indicador visual redundante.
- **Proibido:** depender apenas do som.

## Fase 27 — Capacitor Android
- **Objetivo:** empacotar o app do entregador.
- **Dependências:** 22, 26.
- **Áreas:** APP, OPS.
- **Riscos:** perda da chave de assinatura; APK antigo em circulação.
- **Conclusão:** build gerado e instalável, com versão exibida no app.
- **Proibido:** publicar na Play Store nesta fase.

## Fase 28 — Firebase Cloud Messaging
- **Objetivo:** push de nova entrega para o entregador.
- **Dependências:** 27.
- **Áreas:** APP, OPS.
- **Riscos:** push não entregue; token órfão; consumo de bateria.
- **Conclusão:** push funcional com fallback por polling e limpeza de tokens.
- **Proibido:** push com dados pessoais no payload.

## Fase 29 — Localização e rota
- **Objetivo:** abrir rota externa e, se aprovado, localização durante a entrega.
- **Dependências:** 28.
- **Áreas:** APP, UI.
- **Riscos:** permissão negada; bateria; privacidade.
- **Conclusão:** app funciona integralmente sem permissão de localização.
- **Proibido:** rastreamento contínuo sem decisão registrada (ver Q-013).

## Fase 30 — Segurança
- **Objetivo:** revisão de RLS, rate limiting, proteção de rotas, segredos, retenção, LGPD e auditoria.
- **Dependências:** 06, 16, 24.
- **Áreas:** SEC.
- **Riscos:** vazamento entre lojas; dado pessoal em log.
- **Conclusão:** revisão de segurança sem achado crítico aberto.
- **Proibido:** exceções permanentes em política.

## Fase 31 — Observabilidade
- **Objetivo:** logs estruturados, erros operacionais, métricas de pedido e entrega.
- **Dependências:** 30.
- **Áreas:** OPS.
- **Riscos:** log com dado pessoal.
- **Conclusão:** falhas de pedido e entrega rastreáveis sem PII desnecessária.
- **Proibido:** logar telefone, endereço completo ou token.

## Fase 32 — Testes automatizados
- **Objetivo:** testes de máquina de estados, cálculo de preço, isolamento e idempotência.
- **Dependências:** 30.
- **Áreas:** OPS, SEC.
- **Riscos:** cobertura ilusória.
- **Conclusão:** casos críticos cobertos e verdes.
- **Proibido:** testar apenas caminho feliz.

## Fase 33 — QA completo
- **Objetivo:** roteiro manual dos quatro ambientes em mobile e desktop, incluindo acessibilidade.
- **Dependências:** 32.
- **Áreas:** UI, OPS.
- **Riscos:** interface difícil para idosos.
- **Conclusão:** roteiro executado com pendências registradas e tratadas.
- **Proibido:** liberar com bloqueio aberto.

## Fase 34 — Deploy web
- **Objetivo:** publicação dos ambientes web com domínio definido.
- **Dependências:** 33, Q-001, Q-002.
- **Áreas:** OPS.
- **Riscos:** formato de domínio indefinido.
- **Conclusão:** ambientes acessíveis e estáveis.
- **Proibido:** publicar com pendências de domínio em aberto.

## Fase 35 — Build e distribuição do APK
- **Objetivo:** processo de build assinado, versionamento e atualização.
- **Dependências:** 34, Q-011.
- **Áreas:** APP, OPS.
- **Riscos:** perda da chave; usuários em versão antiga.
- **Conclusão:** chave guardada com segurança e checagem de versão mínima no app.
- **Proibido:** distribuir build não assinado.

## Fase 36 — Documentação final
- **Objetivo:** manual do lojista, do entregador, do administrador e documentação técnica.
- **Dependências:** 35.
- **Áreas:** DOC.
- **Riscos:** documentos desatualizados.
- **Conclusão:** documentos revisados e coerentes com a fonte de verdade.
- **Proibido:** documentar funcionalidade inexistente.

---

## Riscos

| Risco | Impacto | Probabilidade | Mitigação | Fase responsável |
| --- | --- | --- | --- | --- |
| Vazamento entre lojas | Crítico | Média | RLS com negação por padrão, `store_id` obrigatório, testes de acesso cruzado | 06, 30, 32 |
| Manipulação de preço | Crítico | Alta | Recálculo e congelamento no servidor; nunca confiar no cliente | 16 |
| Pedido duplicado | Alto | Alta | Chave de idempotência e bloqueio de reenvio | 16 |
| Entrega aceita por dois entregadores | Alto | Média | Aceite condicional atômico no banco | 21, 22 |
| Endereço incorreto | Alto | Alta | Confirmação obrigatória, bairro por lista, ponto de referência | 13 |
| Produto indisponível comprado | Médio | Média | Validação de disponibilidade na criação do pedido | 16 |
| Loja fechada recebendo pedido | Médio | Média | Verificação de horário no servidor | 16 |
| Pedido perdido por conexão | Alto | Alta | Retentativa idempotente e estado local do carrinho | 14, 16 |
| Som bloqueado pelo navegador | Médio | Alta | Desbloqueio por gesto e alerta visual redundante | 26 |
| Push Android não entregue | Médio | Alta | Fallback por polling e indicador de conexão | 28 |
| Localização negada | Baixo | Alta | App plenamente funcional sem localização | 29 |
| Consumo de bateria | Médio | Média | Sem rastreamento contínuo por padrão | 29 |
| Perda da chave de assinatura | Crítico | Baixa | Guarda segura documentada e backup controlado | 35 |
| APK antigo em uso | Médio | Alta | Versão mínima verificada no login do app | 27, 35 |
| Excesso de complexidade no catálogo | Alto | Alta | Modelo genérico enxuto e modelos iniciais | 10 |
| Interface difícil para idosos | Alto | Média | Botões grandes, contraste AA, uma decisão por etapa | 12, 33 |
| Cadastro de produto cansativo | Médio | Alta | Cadastro progressivo com padrões e modelos | 09, 10 |
| Dados pessoais em logs | Alto | Média | Mascaramento e retenção mínima | 31 |
| Suspensão apagando dados | Crítico | Baixa | Suspensão apenas altera status; nunca exclui | 25 |
| Admin acessando dados sem justificativa | Alto | Média | Auditoria obrigatória de ações sensíveis | 24, 30 |
| Crescimento descontrolado de escopo | Alto | Alta | Fases com proibições explícitas e pendências registradas | todas |
| Integração acidental com projeto anterior | Crítico | Baixa | Supabase próprio e verificação de credenciais na Fase 04 | 04, 30 |
