# Fase 03 — Protótipo Navegável dos Quatro Ambientes

Status: **Concluída**
Data de verificação: 2026-07-30

## 1. Escopo entregue

### 1.1 Ambiente do Cliente (cardápio público, sem login)
Rota base: `/loja/mercado-aurora`

| Etapa | Rota | Descrição |
|---|---|---|
| Abertura do link da loja | `/loja/mercado-aurora` | Capa da loja com marca própria (Mercado Aurora) em destaque e "Pediu Aqui" discreto no rodapé |
| Identificação por nome | `/loja/mercado-aurora/identificacao` | Apenas nome; sem senha, sem cadastro, sem login |
| Entrega ou retirada | `/loja/mercado-aurora/modalidade` | Escolha da modalidade com prazos e taxa fictícios |
| Endereço salvo | `/loja/mercado-aurora/endereco` | Lista de endereços da sessão demo com **confirmação obrigatória** antes de seguir |
| Novo endereço | `/loja/mercado-aurora/endereco/novo` | Formulário progressivo em 7 passos (CEP, rua, número, complemento, bairro, referência, revisão) |
| Cardápio | `/loja/mercado-aurora/cardapio` | Busca, categorias e listagem de itens |
| Produto com opções | `ProductSheet` (sheet sobre o cardápio) | Variações, adicionais, observação e quantidade |
| Carrinho | `/loja/mercado-aurora/carrinho` | Edição de quantidade, remoção, resumo de valores |
| Checkout | `/loja/mercado-aurora/checkout` | Revisão de nome, modalidade, endereço confirmado e forma de pagamento |
| Confirmação | `/loja/mercado-aurora/confirmacao` | Número do pedido e próximos passos |
| Acompanhamento | `/loja/mercado-aurora/acompanhamento` | Linha do tempo do status com controles de demonstração para avançar etapas |

### 1.2 Ambiente da Loja
`/preview/loja` — painel, pedidos (kanban no desktop, listas no mobile), cozinha, cardápio, entregadores (contador simples de entregas), equipe, relatórios e configurações.

### 1.3 Ambiente do Entregador
`/preview/entregador` — disponíveis, rota ativa com registro de ocorrência e histórico simplificado.

### 1.4 Ambiente do Administrador
`/preview/admin` — visão da plataforma, lojas, planos, cobranças, usuários, auditoria e suporte.

### 1.5 Hub
`/preview` — índice navegável para os quatro ambientes.

## 2. Verificações executadas

| Verificação | Resultado |
|---|---|
| Typecheck (`tsgo --noEmit`) | Sem erros |
| Build de produção (`npm run build`) | Sucesso |
| Console do navegador | Nenhum erro ou aviso nas 14 rotas testadas |
| Network | Nenhuma resposta HTTP >= 400 |
| Mobile (390x844) | Todas as rotas renderizadas e navegáveis |
| Desktop (1280x1800) | Todas as rotas renderizadas e navegáveis |
| Supabase / autenticação / backend | Ausentes — nenhuma referência a Supabase, auth ou server functions no código-fonte |
| Capturas | Geradas separadamente por ambiente, em mobile e desktop |

## 3. Restrições respeitadas

- Nenhum banco de dados, migration ou integração externa.
- Nenhuma autenticação; o cliente é identificado apenas pelo nome na sessão local.
- Todo o estado vive em `src/demo/` (tipos, dados fictícios, cenários e provider em memória).
- Identidade carbono/teal preservada nos ambientes internos; o cardápio público prioriza a marca da loja e exibe "Pediu Aqui" de forma discreta.
- Frota de entregadores é privada por loja; não há módulo financeiro do entregador, apenas contagem de entregas concluídas.

## 4. Próximo passo

Fase 04 do roadmap — modelagem de dados e migrations, que só devem ser aplicadas após a confirmação de que o projeto Supabase é exclusivo desta aplicação.
