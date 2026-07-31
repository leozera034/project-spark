# Pediu Aqui — Plano Mestre do Projeto

> Este documento é a fonte de verdade do projeto. Em caso de conflito, ele prevalece até ser alterado por uma nova decisão registrada.

- **Nome oficial:** Pediu Aqui
- **Identificador técnico:** `pediu-aqui`
- **Variações internas:** `pediu_aqui`, `PediuAqui`, `PEDIU_AQUI`
- **Assinatura:** Seu cardápio, seus pedidos, tudo aqui.
- **Assinatura institucional:** Pedidos simples. Operação precisa.
- **Fase atual:** Fase 04 — Arquitetura física do banco (concluída)
- **Status:** documentação, marca, design system, protótipo navegável e arquitetura física do banco. Nenhuma tela conectada ao banco, nenhuma autenticação, nenhum pedido real e nenhuma integração externa. Manual de marca em `docs/BRAND_GUIDELINES.md`; galeria viva em `/design-system`.


---

## 1. Visão geral

O Pediu Aqui é uma plataforma SaaS multi-loja de cardápio digital, pedidos online, operação de pedidos e entregas próprias de cada loja, voltada inicialmente para estabelecimentos de uma única cidade.

Cada loja opera de forma completamente isolada: produtos, categorias, clientes, pedidos, equipe, entregadores, bairros, taxas, meios de pagamento, relatórios, configurações e identidade visual são exclusivos da loja.

## 2. Problema

Comércios locais dependem de pedidos por WhatsApp, cadernos e ligações. Isso gera erros de endereço, pedidos perdidos, retrabalho na cozinha, dificuldade de acompanhar entregas e ausência total de histórico operacional. Alternativas de mercado são caras, cobram comissão por pedido, exigem cadastro do cliente final e impõem uma frota de entregadores de terceiros.

## 3. Público

- **Cliente final:** morador da cidade, celular simples, conexão instável, faixa etária ampla, incluindo idosos.
- **Lojista:** proprietário e equipe do estabelecimento (gerente, atendente, cozinha).
- **Entregador:** entregador próprio da loja, na rua, com uma mão livre.
- **Administrador da plataforma:** operação do SaaS Pediu Aqui.

## 4. Escopo

- Cardápio público por loja, sem login do cliente.
- Catálogo genérico com categorias, produtos, variações, grupos de opções e itens de opção.
- Fluxo de pedido guiado: nome, entrega ou retirada, endereço, carrinho, telefone, pagamento informativo, confirmação e acompanhamento.
- Painel da loja com pedidos em tempo real, modo cozinha, cardápio, equipe, entregadores, bairros, taxas, horários e relatórios operacionais.
- Aplicativo do entregador (web mobile-first e, depois, Android via Capacitor) exclusivamente operacional.
- Painel administrativo do SaaS: lojas, planos, mensalidades, suporte, auditoria.
- Contador simples de entregas concluídas por entregador.

## 5. Fora do escopo

- Qualquer módulo financeiro de entregador (salário, comissão, valor por entrega, diária, bônus, carteira, saldo, repasse, folha, combustível, adiantamento, desconto, extrato, acerto, contas a pagar).
- Frota compartilhada, marketplace de entregadores, leilão ou despacho global de entregas.
- Entrega entre lojas ou entregador vendo pedidos de outra loja.
- Cadastro tradicional do cliente final (e-mail, senha, CPF, confirmação por e-mail).
- Pagamento online no MVP: gateway, cartão online, armazenamento de cartão, split, carteira, Pix automático, Mercado Pago, Stripe, cobrança automática.
- Roteirização automática, IA preditiva, chat interno, fidelidade complexa, cashback, recomendação automática, múltiplas cidades, microsserviços, filas distribuídas.
- Reuso de qualquer ativo, tabela, código, credencial, backend, marca ou dado de projetos anteriores (PortalExpress, MotoFácil, ArmShare ou quaisquer outros).

## 6. Ambientes

| Ambiente | Usuário | Rota conceitual | Login |
| --- | --- | --- | --- |
| Cardápio público | Cliente final | `/loja/{slug}` | Não |
| Painel da loja | Proprietário, gerente, atendente, cozinha | `/app/loja` | Sim |
| App do entregador | Entregador da própria loja | `/app/entregador` | Sim |
| Painel do SaaS | Administrador da plataforma | `/admin` | Sim |

O administrador da plataforma não opera entregas das lojas.

## 7. Perfis

- **Administrador da plataforma:** lojas, planos, mensalidades, suporte, auditoria, saúde da plataforma. Não opera entregas, não possui frota, não calcula pagamento de entregadores, não altera pedidos silenciosamente.
- **Proprietário da loja:** controle completo da própria loja.
- **Gerente:** permissões operacionais e administrativas concedidas pelo proprietário.
- **Atendente:** pedidos e atendimento.
- **Cozinha:** visualização e atualização do preparo.
- **Entregador:** somente entregas da própria loja.
- **Cliente:** sem conta e sem papel autenticado.

Papéis ficam em tabela separada (`user_roles`) e são verificados no backend. Nunca em localStorage, na tabela de perfil, em variável do frontend ou em token criado pelo cliente.

## 8. Jornadas

**Cliente:** abre o link → sistema identifica a loja pelo slug → identidade da loja → aberta ou fechada → primeiro nome → entrega ou retirada → endereço (solicitar ou confirmar) → cardápio → escolha de produtos → configuração de opções → carrinho → telefone → forma de pagamento → revisão → confirmação → acompanhamento.

**Loja:** recebe pedido em tempo real → destaque e som → aceita ou recusa com motivo → em preparo → pronto → entrega (atribui entregador) ou retirada → acompanha até estado final.

**Entregador:** login → sessão persistente → online/offline → recebe entrega da própria loja → aceita (se a loja permitir) → dados da coleta → chegada à loja → coleta → início da entrega → rota → confirmação de entrega → ocorrência se necessário → tela inicial.

**Administrador:** cria/edita/ativa/suspende/reativa loja → define plano e vencimento → registra pagamento manual ou cortesia → consulta usuários, logs e auditoria → suporte.

## 9. Regras do cliente

- Sem conta, sem senha, sem CPF, sem instalação de aplicativo.
- Uma decisão principal por etapa, poucos campos, botões grandes, linguagem simples.
- Possibilidade de voltar preservando os dados já preenchidos.
- Tolerância a conexão instável e a aparelhos simples.
- Dados locais permitidos: primeiro nome, telefone, último endereço, outros endereços, preferência entrega/retirada, carrinho temporário, pedido interrompido, identificador seguro do pedido atual.
- Dados locais proibidos: papel de usuário, permissão administrativa, preço confiável, segredo, chave privada, credencial administrativa.
- Todo valor do carrinho é recalculado no backend na criação do pedido.

## 10. Endereço

Campos: bairro, rua ou avenida, número, opção "sem número", complemento, ponto de referência, identificação (Casa/Trabalho), latitude e longitude opcionais.

O bairro é preferencialmente selecionado em lista cadastrada pela loja. Por bairro a loja define: taxa, pedido mínimo, tempo estimado, observações, ativo ou inativo.

Geolocalização é apoio; o sistema nunca depende exclusivamente de mapas.

**Confirmação obrigatória:** mesmo com endereço salvo, o sistema pergunta "Você quer receber neste endereço?". O endereço nunca é assumido automaticamente. O cliente pode confirmar, editar, selecionar outro, cadastrar novo ou mudar para retirada.

## 11. Catálogo

Motor genérico, nunca específico de alimentação. Suporta: categorias, subcategorias (somente se necessárias), produtos simples, produtos com variações, tamanhos, sabores, adicionais, complementos, grupos de opções, seleção única, seleção múltipla, quantidades, opções obrigatórias e opcionais, mínimo e máximo, preço adicional, venda por unidade, por quantidade e por peso, combos, promoções simples, destaques, esgotados, disponibilidade por horário e por dia, observações, encomendas e pedidos agendados (se aprovados).

A mesma estrutura resolve tamanho e complementos de açaí, proteína e acompanhamentos de marmita, tamanho, sabores e borda de pizza, adicionais de hambúrguer, bebida em combo, unidade, quantidade e peso.

Proibido criar tabelas como `pizza_flavors`, `acai_complements`, `burger_addons`, `marmita_proteins`.

Tipos de estabelecimento atendidos: restaurantes, marmitarias, pizzarias, hamburguerias, açaiterias, sorveterias, padarias, confeitarias, docerias, bares, distribuidoras de bebidas, mercados, mercearias, açougues, conveniências, salgaderias, lojas de encomenda e outros comércios locais.

**Modelos iniciais** (hamburgueria, pizzaria, marmitaria, açaí, mercado) são apenas ponto de partida e nunca limitam a loja.

## 12. Personalização das lojas

Personalizável: nome, logotipo, capa, cor principal, cor de destaque, banners, descrição, categorias, textos, horários, bairros, taxas, pedido mínimo, formas de pagamento, retirada e entrega — sempre via tokens de tema.

Proibido: CSS arbitrário, JavaScript personalizado, alteração do fluxo crítico, de permissões, de políticas de segurança, da máquina de estados, do isolamento ou das regras de auditoria.

A marca principal do cardápio público é a loja. O Pediu Aqui aparece discretamente como "Tecnologia Pediu Aqui".

## 13. Pedidos — máquina de estados

```text
aguardando_confirmacao
├── recusado
├── cancelado
└── aceito
    └── em_preparo
        └── pronto
            ├── entrega
            │   └── aguardando_entregador
            │       └── saiu_para_entrega
            │           └── entregue
            │
            └── retirada
                └── aguardando_retirada
                    └── retirado
```

Estados finais: `entregue`, `retirado`, `recusado`, `cancelado`.

Regras:

- Entrega e retirada seguem fluxos diferentes após `pronto`.
- "Atrasado" não é estado — é cálculo de apresentação por tempo decorrido.
- "Novo" é apresentação visual de `aguardando_confirmacao`.
- Toda mudança gera histórico com ator, data e motivo quando necessário.
- Transições inválidas são rejeitadas no backend.
- Cancelamento e recusa exigem motivo.
- Pedido entregue não volta para estado operacional normal.
- O contador do entregador usa apenas `entregue`.

**Avaliação crítica da proposta:** o modelo é adequado e deve ser mantido. Três observações registradas para as fases de banco e pedidos: (a) `entrega`/`retirada` no diagrama são o **tipo de pedido**, não estados — devem ser um atributo do pedido, e os estados reais após `pronto` são `aguardando_entregador` ou `aguardando_retirada`; (b) `cancelado` precisa ser alcançável também a partir de `aceito`, `em_preparo` e `pronto`, com motivo e ator; (c) devoluções e retornos à loja são **ocorrências**, não estados novos.

## 14. Entregas e entregadores

Cada entregador pertence a exatamente uma loja.

```text
Loja A                Loja B
├── Entregador 1      ├── Entregador 4
├── Entregador 2      └── Entregador 5
└── Entregador 3
```

Nunca haverá frota global, rede compartilhada, entrega entre lojas, marketplace, leilão, despacho global, motorista da plataforma, distribuição pelo administrador do SaaS ou entregador vendo pedidos de outra loja.

A loja poderá configurar: atribuição manual, troca de entregador, atribuição direta, aceite, recusa e status online/offline. Qualquer oferta ocorre exclusivamente entre entregadores da própria loja.

**Informações que o entregador vê:** nome da loja, endereço de coleta, nome do cliente, telefone, endereço, bairro, complemento, ponto de referência, observação, forma de pagamento informativa e status atual.

**Ocorrências:** cliente não encontrado, endereço incorreto, cliente pediu para aguardar, pedido com problema, veículo com problema, outro. Ocorrência não incrementa o contador e pode devolver o pedido ao tratamento da loja. Ocorrências são eventos, não estados.

**Sem financeiro:** o vínculo e o acerto financeiro entre loja e entregador acontecem fora do Pediu Aqui. O módulo do entregador é exclusivamente operacional.

## 15. Contador de entregas

Contador simples de entregas concluídas por entregador, incrementado somente quando o pedido de entrega atinge `entregue`.

Não conta em: atribuído, aceito, indo para a loja, na loja, coletado, saiu para entrega, em andamento, com problema, cancelado, recusado, devolvido, retornando para loja.

Uma entrega concluída conta para apenas um entregador. O valor é **derivado** das entregas finalizadas, não um campo incrementado manualmente.

Relatórios: hoje, semana, mês, período personalizado, histórico individual e comparação operacional entre entregadores. Nenhum relatório exibe valores financeiros.

## 16. Painel da loja

Áreas: início, pedidos, cozinha, cardápio, categorias, produtos, entregadores, bairros, taxas, horários, formas de pagamento, relatórios, equipe, configurações.

Visões de pedidos: novos, em preparo, prontos, aguardando entrega, em entrega, aguardando retirada, atrasados, concluídos.

Pedido novo gera atualização em tempo real, destaque visual, som, ação clara e alerta se permanecer sem resposta.

Ações: aceitar, recusar, iniciar preparo, marcar como pronto, atribuir entregador, trocar entregador, acompanhar, cancelar com motivo, consultar histórico.

## 17. Modo cozinha

Mostra apenas: número do pedido, horário, tempo decorrido, itens, quantidades, variações, opções, observações, iniciar preparo, marcar como pronto.

Evita: dados financeiros desnecessários, dados administrativos, gráficos, mensalidade, configurações e qualquer informação que não ajude no preparo. Interface legível a distância.

## 18. Administrador do SaaS

Pode: criar, editar, ativar, suspender e reativar loja; definir plano e vencimento; registrar pagamento manual; conceder cortesia; consultar usuários, logs e auditoria; prestar suporte; visualizar erros operacionais; controlar funcionalidades por plano.

Não pode: possuir frota, distribuir entregas, receber corridas, calcular pagamento de entregadores, acessar dados de lojas sem justificativa, alterar pedidos silenciosamente.

Ações sensíveis geram auditoria.

## 19. Planos e mensalidades

Prever: planos, valor mensal, vencimento, tolerância, status, desconto, cortesia, histórico de pagamentos, suspensão e reativação.

Suspensão nunca apaga dados, pedidos, produtos, clientes ou configurações. Loja suspensa mantém acesso mínimo para ver a pendência, consultar histórico básico, entrar em contato e regularizar.

O cardápio público de loja suspensa exibe mensagem neutra. Nunca informar ao cliente final que a loja está inadimplente.

## 20. Automações

**Essenciais (MVP)**
- Cliente: verificar loja aberta, validar disponibilidade do produto, calcular taxa por bairro, preservar carrinho, confirmar endereço, acompanhar status.
- Loja: receber pedido em tempo real, som, destaque de pedido novo, abrir/fechar por horário, marcar esgotado, atualizar status do cliente.
- Entregador: atualizar status, visualizar entrega, contador, histórico.
- Administrador: logs básicos, status das lojas, acompanhamento de mensalidades.

**Após o MVP:** repetir pedido, favoritos, pedido agendado, impressão térmica, alerta de atraso, push Android, localização durante a entrega, atualização obrigatória do APK, aviso automático de mensalidade, suspensão automática, relatórios avançados.

**Não necessárias:** roteirização automática, IA preditiva, frota compartilhada, distribuição por proximidade, chat interno, fidelidade complexa, recomendação automática, cashback, marketplace, múltiplas cidades, microsserviços, filas distribuídas, arquitetura excessivamente complexa.

## 21. UX

Obrigatório: mobile-first, português do Brasil, uma decisão principal por etapa, poucos campos, botões grandes, foco visível, contraste WCAG AA, estados de loading, vazio e erro, mensagens simples, prevenção de erro, feedback imediato, navegação previsível, nenhuma informação técnica ao usuário final, voltar sem perder dados, funcionamento sem hover, alvos de toque de no mínimo 44 × 44 px, campos mobile com no mínimo 16 px de fonte, ação principal mobile com no mínimo 52 px de altura.

Proibido: menus escondidos sem necessidade, textos minúsculos, ícone sem rótulo em ação crítica, excesso de pills, excesso de animações, animação contínua decorativa, dashboard genérico, erro técnico bruto, mensagens como "RPC error", "mutation failed" ou "request invalid".

## 22. Direção visual (registro, não execução)

Marca global, minimalista, tecnológica, veloz, precisa, profissional, sofisticada, limpa e confiável. Sem estética regional genérica, infantil ou de template de delivery.

Cromática inicial: carbono profundo, teal, superfícies claras, neutros de alto contraste. Evitar como cores principais: roxo, laranja, excesso de vermelho, gradientes chamativos, neon e efeitos tridimensionais.

Símbolo futuro: único, vetorial, simples, reconhecível, baseado em movimento, derivado de uma única fonte SVG master.

Nenhuma identidade visual é criada nesta fase.

## 23. Stack prevista (não instalada nesta fase)

Lovable, React, TypeScript, Vite, Supabase externo próprio e dedicado, PostgreSQL, Supabase Auth, Storage, Realtime, Edge Functions, GitHub, Capacitor, Android, Firebase Cloud Messaging e mapas apenas quando necessários. O projeto Supabase será exclusivo do Pediu Aqui.

## 24. Arquitetura conceitual

Camadas:

```text
Clientes                    Aplicação                     Dados
--------                    ---------                     -----
Cardápio público  ─┐
Painel da loja    ─┤   React + TypeScript (rotas por     PostgreSQL
App do entregador ─┼─> ambiente, tema por loja) ────────> RLS por store_id
Painel do SaaS    ─┘   + Auth + Realtime + Storage        Auditoria
                       + Edge Functions (escrita crítica) Histórico de status
```

Princípios:

- Toda escrita crítica (criar pedido, transicionar estado, atribuir entregador, aceitar entrega) passa por lógica de servidor com validação, recálculo de preço e idempotência.
- Leitura pública do cardápio é restrita a dados publicáveis da loja.
- Tenant é a loja; o isolamento é `store_id` + RLS, nunca filtro de frontend.
- Realtime alimenta o painel da loja e o app do entregador.

## 25. Entidades (documentação conceitual, sem SQL)

| Entidade | Responsabilidade | Relacionamento | Isolamento | Riscos |
| --- | --- | --- | --- | --- |
| `stores` | Loja (tenant), slug, status | raiz do tenant | é o próprio tenant | slug duplicado; slug enumerável |
| `store_settings` | Preferências e tema da loja | 1–1 com store | store_id | tokens inválidos quebrando tema |
| `store_hours` | Horários de funcionamento | N–1 store | store_id | fuso e virada de dia |
| `neighborhoods` | Bairros atendidos, taxa, mínimo, tempo | N–1 store | store_id | taxa desatualizada no pedido |
| `payment_methods` | Formas informativas aceitas | N–1 store | store_id | método inativo ainda ofertado |
| `user_profiles` | Dados do usuário autenticado | 1–1 auth user | por vínculo | conter papel (proibido) |
| `user_roles` | Papel por usuário e loja | N–1 user, N–1 store | store_id (exceto admin global) | escalada de privilégio |
| `categories` | Agrupamento do catálogo | N–1 store | store_id | ordenação instável |
| `products` | Item vendável genérico | N–1 category/store | store_id | preço lido do cliente |
| `product_variants` | Variações e preços | N–1 product | via product | variação sem preço |
| `option_groups` | Grupo de opções (único/múltiplo, min/max) | N–1 store | store_id | regras min/max inconsistentes |
| `option_items` | Item de opção e preço adicional | N–1 option_group | via grupo | preço adicional ignorado |
| `product_option_groups` | Vínculo produto ↔ grupo | N–N | via product | grupo de outra loja |
| `combos` | Composição de itens | N–1 store | store_id | complexidade excessiva |
| `promotions` | Promoções simples | N–1 store | store_id | promoção expirada aplicada |
| `customers` | Cliente identificado por telefone | N–1 store | store_id | dado pessoal em log |
| `customer_addresses` | Endereços do cliente | N–1 customer | via customer | endereço assumido sem confirmar |
| `orders` | Pedido, tipo, totais congelados, tracking token | N–1 store | store_id | duplicidade; manipulação de preço |
| `order_items` | Itens com preço congelado | N–1 order | via order | preço recalculado incorretamente |
| `order_item_options` | Opções escolhidas com preço congelado | N–1 order_item | via item | opção inválida para o produto |
| `order_status_history` | Ator, estado, data, motivo | N–1 order | via order | histórico ausente |
| `couriers` | Entregador da loja | N–1 store | store_id | entregador em duas lojas |
| `deliveries` | Entrega vinculada ao pedido | 1–1 order de entrega | via order | aceite duplo |
| `delivery_events` | Ocorrências operacionais | N–1 delivery | via delivery | virar estado indevidamente |
| `plans` | Planos do SaaS | global | **sem store_id** | escrita por não-admin |
| `store_subscriptions` | Assinatura da loja | N–1 store, N–1 plan | store_id | suspensão apagando dados |
| `subscription_payments` | Pagamentos registrados | N–1 subscription | via subscription | leitura entre lojas |
| `audit_logs` | Ações sensíveis | global com referência opcional a store | admin | dado pessoal excessivo |
| `device_push_tokens` | Tokens de push | N–1 user/courier | store_id quando aplicável | token órfão |

Regra: tabelas operacionais de loja têm `store_id`; tabelas globais (como `plans`) não recebem `store_id` artificial e são protegidas por permissão de administrador.

## 26. Segurança

Isolamento por `store_id`; Row Level Security; negação por padrão; permissões verificadas no servidor; validação de preço no backend; recálculo do carrinho; preço congelado no pedido; idempotência; prevenção de pedidos duplicados; prevenção de aceite duplicado; tracking público não enumerável; rate limiting; proteção de rotas; logs; auditoria; gestão segura de segredos; retenção mínima; LGPD; nenhum dado de cartão; nenhum segredo no frontend; nenhuma credencial no repositório.

Uma loja jamais consulta clientes, pedidos, produtos, entregadores, equipe, configurações ou relatórios de outra loja. O isolamento nunca depende apenas do frontend.

## 27. Riscos

Ver detalhamento completo (impacto, probabilidade, mitigação e fase responsável) em `docs/IMPLEMENTATION_ROADMAP.md`, seção "Riscos".

Riscos críticos: vazamento entre lojas, manipulação de preço, pedido duplicado, entrega aceita por dois entregadores, suspensão apagando dados, integração acidental com projeto anterior e crescimento descontrolado de escopo.

## 28. Decisões aprovadas

Registradas em `docs/DECISION_LOG.md` (D-001 a D-028).

## 29. Decisões pendentes

Registradas em `docs/OPEN_QUESTIONS.md` (Q-001 a Q-017). Nenhuma resposta foi inventada.

## 30. Critérios de aceite da Fase 01

- [x] Os cinco documentos existem.
- [x] Não há contradição entre eles.
- [x] O nome Pediu Aqui está registrado.
- [x] As regras dos entregadores estão claras.
- [x] A inexistência de financeiro de entregador está explícita.
- [x] O contador somente em `entregue` está explícito.
- [x] O catálogo está descrito como genérico.
- [x] O isolamento está definido.
- [x] A jornada do cliente está documentada.
- [x] A máquina de estados está documentada.
- [x] As decisões aprovadas estão registradas.
- [x] As pendências estão registradas.
- [x] O roadmap completo está calculado.
- [x] Os riscos estão mapeados.
- [x] Nenhum banco foi criado.
- [x] Nenhuma tela funcional foi criada.
- [x] Nenhuma integração foi configurada.
- [x] Nenhum pacote foi instalado.
- [x] Nenhum ativo visual definitivo foi criado.
- [x] Nenhum código funcional significativo foi implementado.

## 31. Regras para todos os próximos prompts

Ler os documentos; respeitar a fonte de verdade; trabalhar por fase; preservar código funcional; não alterar contratos silenciosamente; executar typecheck; executar build quando aplicável; revisar console; revisar rede; validar mobile e desktop; validar permissões; documentar migrations e variáveis; criar estados de loading, erro e vazio; manter português do Brasil; evitar `any`; evitar duplicação; evitar cores fixas espalhadas; não mostrar erro técnico; não criar funcionalidade fora da fase; não avançar automaticamente para a próxima fase.
