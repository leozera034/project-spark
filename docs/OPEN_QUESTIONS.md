# Pediu Aqui — Questões em Aberto

Nenhuma recomendação preliminar deve ser tratada como decisão aprovada. Ao responder, registrar a decisão em `docs/DECISION_LOG.md` e atualizar o status aqui.

Status possíveis: `aberta`, `em análise`, `respondida`.

---

### Q-001 — Formato definitivo do domínio
- **Contexto:** o produto precisa de domínio próprio para os quatro ambientes.
- **Impacto:** SEO, confiança do cliente, certificados, configuração de deploy.
- **Fase limite:** 34.
- **Opções:** domínio único com caminhos; domínio único com subdomínios por ambiente.
- **Recomendação preliminar:** nenhuma registrada.
- **Status:** aberta

### Q-002 — `/loja/{slug}` ou subdomínio por loja
- **Contexto:** endereço do cardápio público.
- **Impacto:** branding da loja, complexidade de DNS e certificados, isolamento percebido.
- **Fase limite:** 11 (definição) e 34 (execução).
- **Opções:** caminho `/loja/{slug}`; subdomínio `{slug}.dominio`; ambos.
- **Recomendação preliminar:** caminho no MVP pela simplicidade operacional; decisão pendente.
- **Status:** aberta

### Q-003 — Login do entregador
- **Contexto:** entregador precisa de acesso simples e seguro na rua.
- **Impacto:** segurança, atrito, suporte.
- **Fase limite:** 05.
- **Opções:** telefone com código; e-mail e senha; usuário criado pela loja com senha inicial.
- **Recomendação preliminar:** nenhuma registrada.
- **Status:** aberta

### Q-004 — Telefone obrigatório para retirada
- **Contexto:** pedidos de retirada podem dispensar telefone.
- **Impacto:** contato em caso de problema versus atrito no checkout.
- **Fase limite:** 15.
- **Opções:** sempre obrigatório; opcional na retirada; configurável por loja.
- **Resposta:** telefone obrigatório em entrega e em retirada, com fluxo único de identificação (primeiro nome + telefone).
- **Decisão:** D-061.
- **Status:** respondida

### Q-005 — Regra de pizza com vários sabores
- **Contexto:** cobrança de pizza meio a meio ou mais frações.
- **Impacto:** motor de preço do catálogo genérico.
- **Fase limite:** 10.
- **Opções:** maior preço entre os sabores; média dos sabores; configurável por loja.
- **Resposta:** configurável pela loja, com duas regras controladas (`highest_price` e `average_price`), definidas no grupo de opções/produto, sem tabela específica de pizza.
- **Decisão:** D-047.
- **Status:** respondida

### Q-006 — Pedido agendado no MVP ou pós-MVP
- **Contexto:** encomendas e agendamentos são comuns em padarias e confeitarias.
- **Impacto:** máquina de estados, painel de pedidos, cozinha.
- **Fase limite:** 16.
- **Opções:** pós-MVP; MVP apenas como observação de texto; MVP completo.
- **Recomendação preliminar:** nenhuma registrada.
- **Status:** aberta

### Q-007 — Impressão térmica
- **Contexto:** muitas lojas usam impressora de cupom.
- **Impacto:** integração com hardware, escopo, suporte.
- **Fase limite:** pós-MVP.
- **Opções:** não suportar; imprimir via navegador; app auxiliar.
- **Recomendação preliminar:** nenhuma registrada.
- **Status:** aberta

### Q-008 — Entregador com várias entregas simultâneas
- **Contexto:** agrupamento de entregas próximas.
- **Impacto:** modelo de dados de `deliveries`, UI do entregador, contador.
- **Fase limite:** 21.
- **Opções:** uma por vez; múltiplas com limite configurável pela loja.
- **Recomendação preliminar:** nenhuma registrada.
- **Status:** aberta

### Q-009 — Prazo de retenção de clientes e pedidos
- **Contexto:** LGPD e retenção mínima.
- **Impacto:** privacidade, custo, relatórios históricos.
- **Fase limite:** 30.
- **Opções:** 12 meses; 24 meses; configurável por plano.
- **Recomendação preliminar:** nenhuma registrada.
- **Status:** aberta

### Q-010 — Valores dos planos
- **Contexto:** precificação do SaaS.
- **Impacto:** viabilidade comercial, funcionalidades por plano.
- **Fase limite:** 25.
- **Opções:** plano único; escalonado por funcionalidade; escalonado por volume.
- **Recomendação preliminar:** nenhuma registrada.
- **Status:** aberta

### Q-011 — Período de tolerância da mensalidade
- **Contexto:** prazo antes da suspensão.
- **Impacto:** relação com o lojista, fluxo de caixa.
- **Fase limite:** 25.
- **Opções:** 3, 5, 7 ou 10 dias; configurável por plano.
- **Recomendação preliminar:** nenhuma registrada.
- **Status:** aberta

### Q-012 — Processo de atualização do APK
- **Contexto:** distribuição fora da Play Store.
- **Impacto:** versões antigas em circulação, incompatibilidade de API.
- **Fase limite:** 35.
- **Opções:** aviso no app; bloqueio por versão mínima; download automático.
- **Recomendação preliminar:** nenhuma registrada.
- **Status:** aberta

### Q-013 — Rastreamento do entregador visível ao cliente
- **Contexto:** cliente acompanhar a entrega no mapa.
- **Impacto:** privacidade do entregador, bateria, complexidade.
- **Fase limite:** 29.
- **Opções:** não oferecer; oferecer apenas status; oferecer localização durante a entrega.
- **Recomendação preliminar:** nenhuma registrada.
- **Status:** aberta

### Q-014 — Formato da recuperação de acesso
- **Contexto:** lojistas e entregadores esquecem credenciais.
- **Impacto:** segurança e suporte.
- **Fase limite:** 05.
- **Opções:** e-mail; código por telefone; reset feito pelo proprietário da loja.
- **Recomendação preliminar:** nenhuma registrada.
- **Status:** aberta

### Q-015 — Política de cancelamento
- **Contexto:** quem pode cancelar e até quando.
- **Impacto:** máquina de estados, confiança do cliente, auditoria.
- **Fase limite:** 18.
- **Opções:** apenas a loja; cliente até a aceitação; cliente até o início do preparo.
- **Recomendação preliminar:** nenhuma registrada.
- **Status:** aberta

### Q-016 — Bairros iniciais da cidade
- **Contexto:** lista base de bairros para acelerar o cadastro das lojas.
- **Impacto:** onboarding, taxas, cobertura.
- **Fase limite:** 08.
- **Opções:** cada loja cadastra do zero; lista base sugerida pela plataforma.
- **Recomendação preliminar:** nenhuma registrada.
- **Status:** aberta

### Q-017 — Tratamento de encomendas por peso
- **Contexto:** açougues, mercearias e confeitarias vendem por peso.
- **Impacto:** cálculo de preço, congelamento de valores, conferência na entrega.
- **Fase limite:** 10.
- **Opções:** preço estimado com ajuste na loja; peso fixo por embalagem; não suportar no MVP.
- **Resposta:** no MVP só existe peso exato ou embalagem fixa escolhida na hora do pedido, sem ajuste de valor depois.
- **Decisão:** D-048.
- **Status:** respondida
