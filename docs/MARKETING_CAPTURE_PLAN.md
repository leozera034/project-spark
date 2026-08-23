# COMANDIVA — Plano de Captação Comercial

## Objetivo

Criar um acervo de screenshots reais e reutilizáveis do COMANDIVA/Pediu Aqui para flyers, anúncios, landing pages, WhatsApp, Instagram, apresentações comerciais e materiais de onboarding.

O acervo deve mostrar o produto em estados reais e coerentes, usando apenas dados sintéticos de QA/marketing. Nenhum dado pessoal real, credencial real, token, chave, CPF/CNPJ real, telefone real, endereço residencial real ou informação de cliente deve aparecer nas imagens.

## Regras de segurança

1. Usar somente contas dedicadas de QA/Marketing Capture.
2. Nunca versionar senhas, tokens, sessões, `.env`, cookies ou arquivos de estado de autenticação.
3. Credenciais temporárias devem ficar fora do Git e do código-fonte.
4. Não desativar rate limits, RLS, políticas, verificações de autorização ou proteções de Auth para facilitar captura.
5. Não usar contas pessoais ou dados reais como solução de conveniência.
6. Toda captura deve passar por revisão visual de privacidade antes de ser usada externamente.
7. Sempre realizar logout explícito ao trocar de papel.

## Contas previstas

### 1. Lojista / Proprietário

- Identificação: `QA Marketing — Lojista`
- Papel esperado: `proprietario`
- Loja: `COMANDIVA Demo Burger`
- Slug preferencial: `comandiva-demo-captura`
- Plano: maior plano funcional disponível para demonstração
- Dados: exclusivamente fictícios

### 2. Entregador

- Identificação: `QA Marketing — Entregador`
- Papel esperado: `entregador`
- Vinculado à mesma loja demo do lojista
- Veículo: moto fictícia
- Placa e telefone: dados sintéticos

### 3. Administração SaaS

- Identificação: `QA Marketing — Admin`
- Papel esperado: `admin_plataforma`
- Criar somente por mecanismo administrativo legítimo já existente
- Não elevar conta via bypass de segurança ou alteração improvisada de Auth/RLS

## Superfícies oficiais

Conforme arquitetura do produto:

- Cliente público: `/loja/{slug}`
- Loja autenticada: `/app/loja`
- Entregador autenticado: `/app/entregador`
- Administração SaaS: `/admin`

## Ordem operacional de captura

1. Cliente público — sem login.
2. Login como lojista.
3. Capturar todas as telas selecionadas da loja.
4. Logout completo.
5. Login como entregador.
6. Capturar fluxo do entregador.
7. Logout completo.
8. Login como admin.
9. Capturar gestão SaaS.
10. Logout completo.
11. Revisar screenshots e remover qualquer imagem com dado real, estado incompleto ou erro visual.

## Estados de dados recomendados

A loja demo deve parecer ativa e utilizada, sem depender de dados reais.

### Loja

- nome e identidade visual configurados;
- logo e capa próprias de demonstração;
- horário de funcionamento configurado;
- delivery e retirada habilitados;
- métodos de pagamento configurados;
- PIX manual somente com chave fictícia, se necessário;
- catálogo com categorias e produtos visualmente fortes;
- adicionais e variações onde agregarem valor;
- promoções ativas;
- pelo menos um entregador disponível;
- pedidos sintéticos em diferentes estados;
- histórico suficiente para popular relatórios;
- automações/templates demonstrativos;
- recursos premium habilitados quando compatíveis com o plano.

### Entregador

- online;
- uma entrega disponível ou atribuída;
- uma entrega em andamento;
- histórico de entregas concluídas;
- dados de veículo fictícios;
- nenhum telefone/endereço real de cliente.

### Admin SaaS

- múltiplas lojas sintéticas ou registros seguros para visualização;
- métricas sem dados identificáveis;
- status de planos, suporte e operação visualmente compreensíveis;
- nenhuma chave, segredo ou identificador técnico sensível visível.

## Shot list — Cliente público

Prioridade alta:

1. Home/cardápio completo da loja.
2. Cabeçalho com marca, status da loja e informações de entrega.
3. Categorias de produtos.
4. Card de produto com foto, preço e destaque.
5. Modal/página de produto com adicionais/variações.
6. Carrinho preenchido.
7. Seleção de entrega/retirada.
8. Checkout antes da confirmação.
9. Rastreamento de pedido, se houver fluxo seguro com dados sintéticos.

## Shot list — Lojista

Prioridade máxima:

1. Dashboard principal.
2. Pedidos em tempo real.
3. Detalhe de pedido.
4. Cardápio/catálogo.
5. Cadastro/edição de produto.
6. Categorias.
7. Promoções.
8. Entregadores.
9. Centro de entrega / operação logística.
10. Relatórios e indicadores.
11. Centro financeiro / repasses.
12. Assinatura/plano e recursos liberados.
13. WhatsApp/automações.
14. CRM/clientes, se a tela estiver pronta para exposição comercial.
15. Configuração visual da loja.
16. Configurações de pagamento.
17. Configurações de delivery.
18. Suporte.

## Shot list — Entregador

1. Dashboard/estado online.
2. Nova entrega disponível.
3. Aceite de entrega.
4. Retirada no estabelecimento.
5. Entrega em andamento.
6. Confirmação/conclusão.
7. Histórico.
8. Perfil/veículo, apenas com dados fictícios.

## Shot list — Admin SaaS

1. Visão geral da plataforma.
2. Lista de lojas.
3. Detalhe de uma loja.
4. Planos/assinaturas.
5. Métricas de operação.
6. Suporte e tickets.
7. Recursos administrativos que representem diferenciais comerciais reais.

## Formatos de captura

### Desktop

- viewport principal: 1440 × 1000 ou equivalente;
- manter zoom em 100%;
- evitar barras do navegador quando possível;
- capturar também full-page quando a tela tiver valor como visão geral.

### Mobile

- referência principal: 390 × 844;
- priorizar cliente público e entregador;
- lojista mobile apenas se a experiência estiver visualmente pronta.

## Convenção de arquivos

Formato:

`{area}_{ordem}_{tela}_{viewport}_{data}.png`

Exemplos:

- `cliente_01_cardapio_mobile_2026-08-23.png`
- `lojista_03_pedidos_desktop_2026-08-23.png`
- `entregador_02_entrega_disponivel_mobile_2026-08-23.png`
- `admin_01_dashboard_desktop_2026-08-23.png`

## Critérios de aprovação da imagem

Uma captura só entra no acervo comercial quando:

- não há erro, skeleton ou loading incompleto;
- não há console/debug visível;
- não há texto provisório;
- não há dado pessoal real;
- não há senha, token, e-mail pessoal ou segredo;
- conteúdo está coerente com a proposta do produto;
- layout não está quebrado;
- números e indicadores não geram promessa comercial enganosa;
- a tela ajuda a explicar ou vender uma capacidade real do COMANDIVA.

## Material final esperado

Organizar o acervo aprovado por área:

- `marketing/captures/cliente/`
- `marketing/captures/lojista/`
- `marketing/captures/entregador/`
- `marketing/captures/admin/`

As imagens brutas podem então alimentar:

- flyer para WhatsApp;
- post 1080×1080;
- story/reel cover 1080×1920;
- carrossel de recursos;
- anúncio com mockup de celular;
- anúncio com mockup de notebook;
- comparativo de funcionalidades;
- landing page;
- apresentação comercial.

## Bloqueios e regra de continuidade

Se a criação de contas for bloqueada por rate limit, falta de crédito do ambiente ou ausência de mecanismo administrativo legítimo, registrar o bloqueio e não enfraquecer controles de segurança.

A captação deve continuar pelas superfícies públicas e contas de QA já autorizadas somente quando for possível autenticar legitimamente.
