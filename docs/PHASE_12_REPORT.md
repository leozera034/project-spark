# Fase 12 — Wizard real do cliente

Data: 2026-07-30
Escopo: nome, modalidade, endereço por etapas e confirmação obrigatória.
Fora de escopo: carrinho, checkout, pagamento, pedido, conta de cliente.

## Jornada canônica

1. Primeiro nome (ou confirmação do nome lembrado no aparelho)
2. Entrega ou retirada
3. Endereço em 6 etapas — bairro, rua, número, complemento, referência, identificação
4. Confirmação explícita do endereço (ou da retirada)
5. Cardápio liberado com barra de contexto

Voltar preserva tudo o que já foi digitado. Nenhuma etapa é pulada por dedução.

## Arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| `src/storefront/customer/customer-wizard.types.ts` | Contratos da jornada |
| `src/storefront/customer/customer-wizard.machine.ts` | Máquina de etapas e navegação |
| `src/storefront/customer/customer-wizard.validation.ts` | Esquemas de validação e limites |
| `src/storefront/customer/customer-wizard.storage.ts` | Leitura e gravação isoladas por slug |
| `src/storefront/customer/address-normalization.ts` | Chave de duplicidade e impressão digital |
| `src/storefront/customer/customer-wizard.context.tsx` | Estado único da jornada |
| `src/components/storefront/CustomerWizard.tsx` | Interface de uma decisão por tela |
| `src/components/storefront/OrderingContextBar.tsx` | Contexto confirmado sempre visível |
| `src/lib/fulfillment.server.ts` / `.functions.ts` / `-contracts.ts` | Camada pública de atendimento |
| `src/routes/api/public/storefront/$slug/atendimento*.ts` | Endpoints públicos com cache e limite de uso |

## Confirmação e invalidação

A confirmação vive apenas na sessão atual, como impressão digital de:
modalidade + identificador do bairro + endereço normalizado + versão da configuração da loja.

Invalidam a confirmação: editar qualquer campo, trocar de endereço, trocar de modalidade,
excluir o endereço confirmado, mudança de versão da configuração da loja e nova jornada.

## Postura de privacidade

- Nome e endereço nunca saem do aparelho: o servidor recebe apenas modalidade, identificador de bairro e versão de configuração.
- Nada de dado pessoal em URL, cabeçalho, log ou métrica.
- Chaves de armazenamento isoladas por slug; uma loja nunca lê os dados de outra.
- Conteúdo local validado por esquema a cada leitura, com descarte de chaves perigosas.
- "Esquecer meus dados neste aparelho" apaga perfil e sessão da loja atual.

## Estados tratados

Loja fechada, sem entrega, sem retirada, sem bairro atendido, bairro removido depois de salvo,
configuração alterada durante a jornada, armazenamento indisponível, sem conexão,
limite de endereços salvos, endereço duplicado e recarga no meio do preenchimento.

## Verificação

- Verificação de tipos sem erros.
- Nenhuma referência a chave privilegiada em código de navegador.
- Endpoints públicos com validação de entrada, resposta neutra em erro e limite por origem.
