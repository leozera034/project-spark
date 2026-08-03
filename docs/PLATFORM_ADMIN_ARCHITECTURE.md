---
name: PLATFORM_ADMIN_ARCHITECTURE
description: Arquitetura do Painel Administrativo do SaaS (Fase 21)
type: feature
---

# Arquitetura do Painel Administrativo SaaS

O Painel Administrativo do SaaS é o ambiente de gestão global da plataforma Pediu Aqui, restrito aos administradores do sistema. Ele é fisicamente e logicamente separado das operações das lojas.

## 1. Princípios de Isolamento
- **Administrador SaaS ≠ Operador:** O papel de administrador global não concede permissões automáticas sobre pedidos, cozinha ou entregas das lojas.
- **Projeções Sanitizadas:** A saúde das lojas é apresentada via indicadores agregados, sem acesso a PII (nomes, telefones, endereços) ou dados financeiros operacionais.
- **Sem Impersonação:** Não existe funcionalidade de "Logar como loja". O suporte é assistido via diagnósticos e ações administrativas explícitas.

## 2. Autorização Global
- **Papel:** `admin_plataforma` associado a um `user_id` com `store_id` nulo na tabela `user_roles`.
- **Verificação:** Função `private.has_platform_permission(required_action)` valida o papel global e a permissão específica no servidor.
- **Guard de Rotas:** A rota `/admin` exige autenticação, papel global e sessão ativa.

## 3. Ciclo de Vida da Loja
- **Estados:** `aguardando_configuracao`, `ativa`, `suspensa_manual`, `inativa`.
- **Suspensão:** Administrativa e manual nesta fase. Bloqueia novos pedidos públicos com mensagem neutra, mas preserva o acompanhamento de pedidos ativos e a integridade de todos os dados.
- **Reativação:** Remove o bloqueio administrativo, devolvendo o controle operacional às configurações da loja.

## 4. Auditoria e Logs
- **Imutabilidade:** Logs técnicos e trilhas de auditoria são somente leitura e nunca exibem segredos (senhas, tokens, JWTs).
- **Correlation ID:** Todas as ações administrativas são vinculadas a um ID de correlação para rastreamento de causa raiz.
