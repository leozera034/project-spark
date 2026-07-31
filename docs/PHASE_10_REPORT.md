# Relatório da Fase 10 — Motor avançado do catálogo

**Data:** 2026-07-31
**Escopo:** variações, grupos de opções, preços compostos, venda por peso e prévia administrativa.
**Fora de escopo (confirmado):** cardápio público, carrinho, checkout, pedido, cliente real, endereço, acompanhamento, cozinha, entrega, estoque, ficha técnica, custo, margem, pagamentos, promoções, acesso anônimo, notificações.

---

## 1. Modelo de dados

Nenhuma estrutura específica por segmento foi criada. O motor é único e genérico.

| Estrutura | Papel |
| --- | --- |
| `products.sale_mode` | `unit`, `measured` ou `fixed_package` |
| `products.measurement_unit` | `unit`, `kg`, `g`, `l`, `ml` |
| `products.minimum_quantity` / `quantity_step` | regras de quantidade da venda por medida |
| `product_variants` | tamanhos e embalagens, com preço próprio, padrão único, ativação e arquivamento |
| `option_groups` | tipo de seleção, mínimos, máximos, estratégia de preço, efeito no preço e porções |
| `option_items` | itens do grupo, com preço adicional e quantidade máxima |
| `product_option_groups` | vínculo reaproveitável entre produto e grupo, com ordem própria |
| `product_variant_option_item_prices` | preço de um item específico dentro de uma variação |

Sabor de pizza, adicional de lanche, complemento de açaí e ponto da carne são todos o mesmo objeto: um grupo de opções com itens.

---

## 2. Motor de preço

`calculate_product_configuration_preview` é a única fonte de verdade. Ela recebe produto, variação, quantidade e seleções e devolve preço unitário, total, detalhamento por grupo e a lista de erros.

Regras aplicadas:

- preço base vem da variação escolhida ou do preço do produto;
- cada grupo é resolvido pela sua estratégia: somar os itens, cobrar o mais caro (`highest_price`) ou média proporcional às frações (`average_price`) — D-047;
- um grupo pode somar ao preço ou substituir o preço base, nunca dois grupos substituindo ao mesmo tempo;
- preço de item específico por variação tem prioridade sobre o preço adicional padrão;
- venda por medida multiplica o preço pela quantidade e valida mínimo e incremento;
- o total só é devolvido quando não há nenhum erro de validação.

Nada disso é recalculado no navegador — D-050.

---

## 3. Validação de configuração

`validate_product_configuration` produz um relatório com erros e avisos. Erros bloqueiam a publicação do produto; avisos apenas orientam.

Erros cobertos: preço base inválido, categoria indisponível, ausência ou excesso de variação padrão, unidade de medida faltando, mínimo ou incremento inválido, variação em produto vendido por medida, embalagem sem peso, dois grupos substituindo o preço, grupo obrigatório sem itens, mínimo inalcançável e grupo obrigatório sem mínimo.

Aviso coberto: faltam preços por variação em grupo que substitui o preço base.

A checagem roda também ao ativar produto, desativar variação, arquivar grupo e desvincular grupo — D-052.

---

## 4. Segurança

- Toda rotina exige sessão e verifica a permissão de catálogo correspondente (`catalog.view`, `catalog.create`, `catalog.update`, `catalog.archive`) na própria loja.
- A loja é resolvida no servidor; o cliente não escolhe o `store_id` efetivo.
- Toda escrita compara a versão que o operador estava vendo (`updated_at`) antes de gravar.
- Nada é excluído: itens, grupos e variações são arquivados e podem ser restaurados.
- Toda escrita grava auditoria com ação, tabela, registro e campos alterados.
- Execução revogada de `PUBLIC` e de `anon`; concedida apenas ao papel autenticado. Nenhum acesso anônimo foi aberto nesta fase.

---

## 5. Interface

- **Biblioteca de opções** (`/app/loja/cardapio/opcoes`): criar e editar grupos, definir tipo de escolha, mínimos, máximos, obrigatoriedade, estratégia de preço, efeito no preço e porções; gerenciar itens com preço adicional e quantidade máxima; ativar, desativar, arquivar e restaurar.
- **Configuração avançada do produto** (aba na tela do produto):
  - modo de venda com unidade, mínimo e incremento;
  - variações com preço, embalagem, padrão, ordem, ativação e arquivamento;
  - vínculo de grupos com ordem própria;
  - matriz de preços por variação;
  - prévia administrativa que simula a escolha do cliente e exibe o preço vindo do servidor, com detalhamento por grupo e lista de pendências.
- Resumo de validação sempre visível no topo da aba.

Toda a interface é mobile-first, com alvos de toque adequados, rótulos associados e mensagens em linguagem de operação, sem jargão técnico.

---

## 6. Decisões registradas

D-049, D-050, D-051 e D-052 no `docs/DECISION_LOG.md`.

---

## 7. Confirmações finais

- Nenhuma tabela ou rotina específica de segmento foi criada.
- Nenhum acesso anônimo foi liberado.
- Nenhum carrinho, checkout ou pedido foi implementado.
- O cardápio público continua sendo escopo da Fase 11.
