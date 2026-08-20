# Comandiva — Plano Mestre do Painel Dono do SaaS

> Status: ATIVO
> Prioridade: CRÍTICA
> Branch de referência: `main`
> Fonte de verdade: este documento
> Última atualização inicial: 2026-08-20

## 1. Objetivo

Transformar o painel atual de Dono do SaaS, hoje predominantemente consultivo, em uma **Central Administrativa/Control Plane completa do Comandiva**, capaz de operar lojas, usuários, pedidos, entregas, motoristas, assinaturas, pagamentos, Stripe Connect, repasses, cardápios, adicionais, suporte, saúde da plataforma, configurações e auditoria sem depender de edição manual no banco.

O objetivo não é criar apenas mais relatórios. O dono do SaaS precisa conseguir **ver, investigar, decidir, executar, corrigir, bloquear, reativar, cobrar, reembolsar, configurar e auditar**.

## 2. Regra permanente para agentes e implementadores

Antes de implementar qualquer funcionalidade relacionada a administração, pagamentos, lojas, cardápios, pedidos, entregas, usuários ou operação do SaaS:

1. Ler este arquivo completo.
2. Conferir o status do módulo e suas dependências.
3. Inspecionar a implementação real antes de criar tabelas, rotas, funções ou componentes novos.
4. Reutilizar arquitetura existente quando segura e coerente.
5. Não criar fluxos paralelos que dupliquem regra de negócio.
6. Toda ação administrativa sensível deve passar pelo backend autorizado e ser auditável.
7. Nunca implementar ação financeira como edição direta de saldo ou atualização manual de pagamento sem ledger/evento financeiro.
8. Nunca permitir visualização de senha.
9. Nunca usar impersonation alterando senha do cliente.
10. Atualizar este documento ao finalizar cada etapa, registrando status, evidências, migrations, rotas e testes.
11. Não marcar tarefa como concluída apenas porque a UI existe.
12. Considerar concluído somente quando backend, autorização, persistência, auditoria, tratamento de erro e teste do fluxo principal estiverem validados.

## 3. Princípios de arquitetura

### 3.1 Control Plane, não acesso direto ao banco

Fluxo obrigatório para ações sensíveis:

`Dono do SaaS -> UI administrativa -> endpoint/RPC/Edge Function autorizada -> validação -> regra de negócio -> persistência/evento -> audit log -> resposta`

Proibido tratar a interface administrativa como um editor genérico de tabelas.

### 3.2 RBAC e autorização

Definir papéis administrativos explícitos, por exemplo:

- `saas_owner`
- `saas_admin`
- `support_admin`
- `finance_admin`
- `operations_admin`
- `read_only_admin`

Toda ação deve validar permissão no backend. Ocultar botão no frontend não é autorização.

### 3.3 Auditoria obrigatória

Toda ação sensível deve registrar, quando aplicável:

- ator/admin;
- ação;
- recurso e ID;
- estado anterior;
- estado posterior;
- motivo;
- data/hora;
- origem/IP/device quando disponível e apropriado;
- correlation/request ID.

### 3.4 Idempotência

Ações financeiras, webhooks, reenvios e mudanças críticas precisam suportar idempotência para evitar cobrança, estorno, transferência ou processamento duplicado.

### 3.5 Soft delete e reversibilidade

Preferir desativação, suspensão, arquivamento e soft delete. Exclusão definitiva deve ser excepcional, protegida e compatível com requisitos fiscais, financeiros e de auditoria.

## 4. Estrutura-alvo do menu

```text
Visão Geral

Operação
 ├── Lojas
 ├── Pedidos
 ├── Entregas
 ├── Motoristas
 └── Clientes

Receita
 ├── Assinaturas
 ├── Planos
 ├── Pagamentos
 ├── Stripe Connect
 ├── Repasses
 ├── Cupons
 └── Add-ons

Produto
 ├── Cardápios
 ├── Templates
 ├── Recursos
 ├── Feature Flags
 └── Integrações

Relacionamento
 ├── Usuários
 ├── Suporte
 ├── Comunicação
 └── Onboarding

Sistema
 ├── Saúde
 ├── Logs
 ├── Webhooks
 ├── Auditoria
 ├── Jobs
 └── Configurações

Administração
 ├── Administradores
 ├── Permissões
 └── Segurança
```

## 5. Roadmap executivo

### P0 — Fundação crítica para operação comercial

Status geral: `PENDENTE`

#### P0.1 — Fundação de autorização administrativa

- [ ] Auditar modelo atual de papéis e permissões.
- [ ] Definir papel `saas_owner` como autoridade máxima do SaaS.
- [ ] Definir permissões administrativas granulares.
- [ ] Proteger rotas administrativas no frontend.
- [ ] Proteger ações administrativas no backend.
- [ ] Criar helper/policy única para autorização de ações de owner/admin.
- [ ] Garantir que RLS não seja burlada indevidamente pelo cliente.
- [ ] Testar acesso autorizado e não autorizado.

**Aceite:** um usuário comum/lojista não consegue invocar nenhuma ação de dono mesmo chamando diretamente API/RPC.

#### P0.2 — Audit Log central

- [ ] Auditar mecanismos de log já existentes.
- [ ] Criar/normalizar `admin_audit_log` se necessário.
- [ ] Registrar ações sensíveis server-side.
- [ ] Criar visualizador de auditoria no painel.
- [ ] Filtros por administrador, ação, recurso e período.
- [ ] Exibir before/after de alterações relevantes.

**Aceite:** qualquer mudança de plano, suspensão, impersonation, reembolso, ajuste de configuração ou permissão deixa trilha consultável.

#### P0.3 — Central de Lojas

- [ ] Listagem com busca e filtros.
- [ ] Status: ativa, trial, inadimplente, suspensa, bloqueada, arquivada.
- [ ] Perfil 360° da loja.
- [ ] Dados cadastrais.
- [ ] Plano e assinatura.
- [ ] Pedidos.
- [ ] Cardápio.
- [ ] Funcionários.
- [ ] Entregas/motoristas vinculados.
- [ ] Pagamentos/Stripe Connect.
- [ ] Integrações.
- [ ] Logs e eventos recentes.
- [ ] Suspender.
- [ ] Reativar.
- [ ] Bloquear.
- [ ] Arquivar.
- [ ] Conceder trial/dias grátis com motivo.
- [ ] Aplicar benefício/desconto autorizado.

**Aceite:** suporte e operação conseguem resolver problemas comuns da loja sem entrar no Supabase manualmente.

#### P0.4 — Impersonation seguro (“Acessar como lojista”)

- [ ] Implementar sessão administrativa de impersonation.
- [ ] Não alterar senha.
- [ ] Exibir banner persistente indicando impersonation.
- [ ] Registrar início/fim e motivo no audit log.
- [ ] Definir ações proibidas durante impersonation, especialmente financeiras e credenciais.
- [ ] Permitir saída imediata para sessão do owner.

**Aceite:** owner consegue reproduzir UX do lojista sem conhecer senha e com trilha de auditoria.

#### P0.5 — Central de Usuários

- [ ] Busca por nome, e-mail, telefone, ID, loja.
- [ ] Ver papel, vínculo, último login e status.
- [ ] Bloquear/desbloquear.
- [ ] Encerrar sessões quando suportado.
- [ ] Reenviar confirmação/recuperação de acesso sem expor senha.
- [ ] Alterar função mediante regra e auditoria.
- [ ] Remover vínculo com loja.
- [ ] Transferência controlada de propriedade de loja.

#### P0.6 — Planos e Assinaturas

- [ ] Auditar tabelas, produtos e preços Stripe existentes.
- [ ] Garantir vínculo inequívoco loja -> assinatura -> plano -> preço Stripe.
- [ ] Mostrar plano atual ao lojista.
- [ ] Mostrar status da assinatura.
- [ ] Criar/editar/arquivar planos no painel administrativo, sem quebrar assinaturas históricas.
- [ ] Mensal/anual.
- [ ] Trial.
- [ ] Upgrade/downgrade.
- [ ] Cancelamento.
- [ ] Extensão de trial.
- [ ] Cupom/desconto.
- [ ] Features/limites por plano.
- [ ] Tela de cobrança e histórico.
- [ ] Tratar `past_due`, `unpaid`, `canceled`, `trialing`, `active` e equivalentes usados pelo projeto.

**Aceite:** seleção de plano leva a pagamento/checkout correto e, após confirmação, o sistema reflete automaticamente o plano da loja.

#### P0.7 — Central Financeira do SaaS

Separar claramente **GMV** de **receita Comandiva**.

- [ ] GMV.
- [ ] Receita de assinaturas.
- [ ] Receita de taxas.
- [ ] Receita de entrega.
- [ ] Receita de adicionais.
- [ ] Stripe fees.
- [ ] Estornos.
- [ ] Chargebacks/disputas.
- [ ] Valores pendentes.
- [ ] Valores disponíveis.
- [ ] Repasses.
- [ ] Inadimplência.
- [ ] Reconciliação por pedido/transação.

**Regra:** não somar dinheiro pertencente ao lojista como receita do SaaS.

#### P0.8 — Stripe Connect e Repasses

- [ ] Perfil Connect por loja.
- [ ] Estado do onboarding.
- [ ] KYC/requisitos pendentes.
- [ ] `charges_enabled`.
- [ ] `payouts_enabled`.
- [ ] Conta externa/banco de forma segura.
- [ ] Saldo disponível/pendente conforme API aplicável.
- [ ] Próximos repasses quando disponível.
- [ ] Histórico de transfers/payouts.
- [ ] Taxa Comandiva explícita.
- [ ] Taxa Stripe explícita.
- [ ] Valor líquido da loja explícito.
- [ ] Webhooks idempotentes.
- [ ] Estados de falha e retry.
- [ ] Não armazenar dados bancários sensíveis desnecessários.

**Exibição mínima por pedido:** valor cliente, taxas Stripe, taxa Comandiva, demais taxas, líquido da loja.

#### P0.9 — Central de Pagamentos

- [ ] Busca por pedido, loja, PaymentIntent/Checkout Session e cliente.
- [ ] Status real do provedor.
- [ ] Timeline de eventos/webhooks.
- [ ] Reembolso total quando permitido.
- [ ] Reembolso parcial quando permitido.
- [ ] Motivo obrigatório.
- [ ] Proteção contra reembolso duplicado.
- [ ] Auditoria.
- [ ] Tratamento de disputa/chargeback.

**Proibido:** botão “marcar como pago” que apenas altera coluna local sem evidência do provedor.

#### P0.10 — Ledger financeiro

- [ ] Auditar se já existe ledger.
- [ ] Criar ledger imutável ou append-only para eventos financeiros caso necessário.
- [ ] Registrar créditos promocionais, taxas, débitos, compensações, refunds, transfers e ajustes autorizados.
- [ ] Cada ajuste manual exige motivo e administrador.
- [ ] Saldo derivado de eventos, não de edição arbitrária.

#### P0.11 — Central de Pedidos

- [ ] Busca/filtros amplos.
- [ ] Perfil completo do pedido.
- [ ] Timeline: criação, pagamento, aceite, preparo, entrega, conclusão/cancelamento.
- [ ] Separar estado do pedido, pagamento e entrega.
- [ ] Mostrar eventos e falhas de notificação.
- [ ] Cancelar quando permitido.
- [ ] Acionar refund quando aplicável.
- [ ] Reenviar notificação/evento seguro.
- [ ] Correção administrativa de estado apenas por operação controlada, validada e auditada.

#### P0.12 — Dashboard operacional do Owner

O dashboard deve responder “o que precisa da minha ação agora?”, não apenas “o que aconteceu?”.

- [ ] lojas inadimplentes;
- [ ] pagamentos falhos;
- [ ] Connect incompleto;
- [ ] pedidos travados;
- [ ] entregas críticas;
- [ ] webhooks falhos;
- [ ] erros recentes;
- [ ] tickets críticos;
- [ ] MRR/assinaturas/churn sem misturar com GMV.

---

### P1 — Operação, entrega, cardápio e monetização adicional

Status geral: `PENDENTE`

#### P1.1 — Torre de Entregas

- [ ] Entregas aguardando motorista.
- [ ] Aceitas.
- [ ] Em coleta.
- [ ] Em rota.
- [ ] Entregues.
- [ ] Canceladas.
- [ ] Devoluções.
- [ ] Entregas travadas.
- [ ] SLA por etapa.
- [ ] Alertas operacionais.
- [ ] Ação de reoferta/reprocessamento quando tecnicamente segura.

#### P1.2 — Central de Motoristas

- [ ] Cadastro/perfil.
- [ ] Documentos e status.
- [ ] Aprovar/rejeitar/solicitar correção.
- [ ] Moto/carro.
- [ ] Online/offline.
- [ ] Última localização válida.
- [ ] Bloquear/desbloquear.
- [ ] Vincular/desvincular loja.
- [ ] Corridas, cancelamentos e aceite.
- [ ] Financeiro/repasses quando aplicável.

#### P1.3 — Central de Cardápios

- [ ] Visualização do cardápio por loja.
- [ ] Diagnóstico de completude.
- [ ] Produtos sem preço/imagem.
- [ ] Categorias vazias.
- [ ] Adicionais inválidos.
- [ ] Produtos indisponíveis.
- [ ] Estado de publicação.
- [ ] Templates de cardápio.
- [ ] Duplicação segura de modelos.
- [ ] Importação por planilha quando viável.
- [ ] Ferramentas de IA para descrição/categorização, sempre revisáveis.

#### P1.4 — Serviço pago “Montamos seu cardápio”

- [ ] Produto/add-on de cobrança única ou preço configurável.
- [ ] Solicitação pelo lojista.
- [ ] Status do serviço: solicitado, pago, em execução, revisão, concluído.
- [ ] Área interna para equipe montar cardápio.
- [ ] Templates e biblioteca de assets.
- [ ] Aprovação final pelo lojista.

**Regra comercial:** o editor self-service continua funcional e fácil; o adicional monetiza conveniência, não bloqueio artificial.

#### P1.5 — Marketplace de Add-ons

- [ ] Cadastro de add-on.
- [ ] Preço único/recorrente.
- [ ] Plano mínimo.
- [ ] Limites.
- [ ] Ativo/inativo.
- [ ] Provisionamento automático pós-pagamento.
- [ ] Cancelamento/desprovisionamento.
- [ ] Histórico.

Exemplos: montagem de cardápio, domínio próprio, WhatsApp avançado, IA, campanhas, integrações premium, suporte premium, pacotes de mensagens, usuários extras.

#### P1.6 — Central de Suporte

- [ ] Tickets.
- [ ] Prioridade.
- [ ] Loja/usuário/pedido/pagamento relacionados.
- [ ] Responsável.
- [ ] Histórico.
- [ ] Notas internas.
- [ ] Anexos quando suportado.
- [ ] Diagnóstico automático de fluxo do pedido.

---

### P2 — Escala, confiabilidade e governança

Status geral: `PENDENTE`

#### P2.1 — Saúde da Plataforma

- [ ] Supabase Database.
- [ ] Auth.
- [ ] Edge Functions.
- [ ] Stripe.
- [ ] Resend.
- [ ] Push.
- [ ] WhatsApp.
- [ ] Maps/rotas.
- [ ] Filas/jobs.
- [ ] Erros recentes.
- [ ] Latência e falhas relevantes.

#### P2.2 — Webhooks e Jobs

- [ ] Visualizador de webhook.
- [ ] Status processado/falhou.
- [ ] Tentativas.
- [ ] Idempotency key.
- [ ] Payload sanitizado.
- [ ] Retry seguro.
- [ ] Dead-letter/estado equivalente para falhas persistentes.

#### P2.3 — Configurações Globais

Criar configuração versionada e auditada para parâmetros que hoje exigiriam alteração de código.

Áreas:

- pedidos;
- pagamentos;
- taxas;
- repasses;
- entrega;
- trial;
- cadastro;
- limites;
- manutenção;
- integrações.

Mudanças críticas devem ter validação, versionamento e possibilidade de rollback lógico.

#### P2.4 — Feature Flags

- [ ] Flag global.
- [ ] Por plano.
- [ ] Por loja.
- [ ] Percentual/coorte quando necessário.
- [ ] Ambiente.
- [ ] Auditoria.

#### P2.5 — Comunicação e automações

- [ ] E-mail transacional.
- [ ] WhatsApp.
- [ ] Push.
- [ ] Templates.
- [ ] Histórico de entrega.
- [ ] Preferências/consentimento quando aplicável.
- [ ] Campanhas separadas de mensagens transacionais.

#### P2.6 — Segurança administrativa

- [ ] MFA para contas administrativas quando suportado.
- [ ] Sessões administrativas visíveis.
- [ ] Revogação de sessão.
- [ ] Alertas para ações sensíveis.
- [ ] Rate limits.
- [ ] Proteção contra CSRF/replay conforme arquitetura.
- [ ] Segredos apenas server-side.
- [ ] Revisão de RLS e service-role usage.

## 6. Métricas obrigatórias do SaaS

O painel deve distinguir métricas de produto, operação e receita.

### Receita

- MRR;
- ARR estimado;
- receita por plano;
- receita por add-on;
- receita de taxas;
- churn de receita;
- inadimplência.

### Produto

- lojas ativas;
- trials ativos;
- trial -> pago;
- pedidos por loja;
- cardápios publicados;
- ativação de features.

### Operação

- pedidos travados;
- pagamentos falhos;
- entregas atrasadas;
- taxa de aceite de motoristas;
- tempo até aceite/coleta/entrega;
- tickets e tempo de resolução.

### Financeiro transacional

- GMV;
- refunds;
- disputes;
- taxas Stripe;
- taxa Comandiva;
- líquido para lojas;
- transfers/payouts.

## 7. Modelo mínimo de ações administrativas

Cada ação sensível deve ter uma definição explícita contendo:

- permissão necessária;
- pré-condições;
- validações;
- recurso afetado;
- efeitos colaterais;
- auditoria;
- idempotência quando necessária;
- reversibilidade;
- mensagem de erro útil;
- teste.

Exemplos de ações a modelar:

- `store.suspend`
- `store.reactivate`
- `store.archive`
- `subscription.change_plan`
- `subscription.extend_trial`
- `payment.refund`
- `payment.partial_refund`
- `driver.block`
- `driver.approve`
- `user.revoke_sessions`
- `impersonation.start`
- `impersonation.stop`
- `feature_flag.update`
- `global_config.update`

## 8. Regras financeiras inegociáveis

1. Nunca alterar saldo financeiro diretamente pela UI.
2. Nunca marcar pagamento como pago sem confirmação confiável do provedor ou processo administrativo explicitamente modelado.
3. Nunca apagar histórico de transação para “corrigir” valor.
4. Ajustes devem gerar evento/ledger.
5. Refunds precisam ser vinculados à transação original.
6. Transfers/payouts precisam ser reconciliáveis.
7. Toda taxa deve ter origem e fórmula identificáveis.
8. GMV não é receita.
9. Valores da loja não são patrimônio da Comandiva.
10. Webhooks financeiros devem ser idempotentes.

## 9. Regras de UX do painel do Owner

- Ações precisam estar próximas do contexto do recurso.
- Ações destrutivas exigem confirmação adequada.
- Ações financeiras exibem impacto antes da confirmação.
- Estados assíncronos devem mostrar `processando`, `concluído` ou `falhou`.
- Erro não pode ser genérico se houver informação técnica segura para diagnóstico.
- Toda tela crítica deve ter busca e filtros úteis.
- Evitar “dashboard decorativo”. Priorizar exceções e itens que exigem ação.
- Em perfil 360°, apresentar timeline recente do recurso.

## 10. Critério de pronto por funcionalidade

Uma funcionalidade só pode mudar para `CONCLUÍDA` se passar por todos os itens aplicáveis:

- [ ] UI implementada.
- [ ] Backend implementado.
- [ ] Autorização server-side validada.
- [ ] RLS/policies revisadas.
- [ ] Auditoria implementada.
- [ ] Erros tratados.
- [ ] Estado de loading/retry tratado.
- [ ] Fluxo feliz testado.
- [ ] Fluxo de erro testado.
- [ ] Acesso indevido testado.
- [ ] Idempotência testada quando aplicável.
- [ ] Dados financeiros reconciliados quando aplicável.
- [ ] Documentação atualizada.
- [ ] Sem regressão evidente em lojista/cliente/motorista.

## 11. Protocolo de implementação contínua

Ao iniciar uma rodada:

1. Identificar o primeiro item `PENDENTE` de maior prioridade cujas dependências estejam prontas.
2. Auditar o código e banco existentes relativos ao item.
3. Registrar decisões relevantes no `docs/DECISION_LOG.md` quando alterarem arquitetura/regra de negócio.
4. Implementar uma fatia vertical completa, evitando dezenas de telas mock sem backend.
5. Testar.
6. Atualizar este arquivo:
   - status;
   - arquivos relevantes;
   - migrations;
   - endpoints/functions;
   - testes/evidências;
   - pendências descobertas.
7. Prosseguir para a próxima fatia de maior prioridade.

## 12. Registro de progresso

Usar os estados:

- `PENDENTE`
- `EM AUDITORIA`
- `EM IMPLEMENTAÇÃO`
- `BLOQUEADO`
- `EM VALIDAÇÃO`
- `CONCLUÍDO`

### Histórico

| Data | Módulo | Estado | Resumo | Evidência/arquivos |
|---|---|---|---|---|
| 2026-08-20 | Plano Mestre do Owner | CONCLUÍDO | Plano persistente criado para orientar implementação contínua do Control Plane | `docs/OWNER_SAAS_CONTROL_PLANE_IMPLEMENTATION_PLAN.md` |

## 13. Ordem recomendada de execução técnica

1. Autorização/RBAC administrativo.
2. Audit log.
3. Central de lojas.
4. Impersonation seguro.
5. Usuários.
6. Planos/assinaturas.
7. Financeiro + ledger.
8. Stripe Connect/repasses.
9. Pagamentos/refunds.
10. Pedidos/timeline.
11. Dashboard operacional.
12. Entregas.
13. Motoristas.
14. Cardápios/templates.
15. Serviço pago de montagem de cardápio.
16. Add-ons.
17. Suporte.
18. Saúde/webhooks/jobs.
19. Configurações globais.
20. Feature flags.
21. Comunicação/automações.
22. Hardening de segurança e readiness final.

## 14. Resultado esperado

Ao final, o Dono do SaaS deve conseguir operar a Comandiva sem depender de editar tabelas manualmente no Supabase para tarefas rotineiras.

O painel final precisa ser simultaneamente:

- centro operacional;
- console financeiro;
- console de suporte;
- console de produto;
- console de segurança;
- console de observabilidade;
- control plane de lojas, usuários, pedidos e entregas.

A prioridade permanente é transformar informação em **capacidade de ação segura e auditável**.