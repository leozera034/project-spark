# Pediu Aqui — Glossário do Domínio

**Plataforma** — o produto Pediu Aqui como um todo, incluindo os quatro ambientes e o painel administrativo do SaaS.

**Loja** — estabelecimento comercial que usa a plataforma. É a unidade de isolamento (tenant). Possui slug, identidade, catálogo, equipe, entregadores, bairros e configurações próprios.

**Cliente** — pessoa que faz o pedido no cardápio público. Não possui conta, senha nem papel autenticado. É identificado por primeiro nome e telefone.

**Usuário** — pessoa autenticada na plataforma: proprietário, gerente, atendente, cozinha, entregador ou administrador do SaaS.

**Entregador** — usuário vinculado a exatamente uma loja, responsável apenas pelas entregas dessa loja. Módulo exclusivamente operacional, sem qualquer financeiro.

**Pedido** — solicitação criada pelo cliente, com itens, opções, totais congelados, tipo (entrega ou retirada), forma de pagamento informativa e estado.

**Entrega** — execução do transporte de um pedido do tipo entrega, atribuída a um entregador da própria loja.

**Retirada** — modalidade em que o cliente busca o pedido na loja; segue fluxo próprio após o estado `pronto`.

**Categoria** — agrupamento de produtos no catálogo de uma loja.

**Produto** — item vendável genérico do catálogo, independente do segmento do estabelecimento.

**Variação** — versão de um produto com preço próprio (por exemplo, tamanho). Pertence ao produto.

**Grupo de opções** — conjunto de escolhas aplicável a um produto, com tipo de seleção (única ou múltipla), obrigatoriedade e quantidades mínima e máxima.

**Opção** — item dentro de um grupo de opções, podendo ter preço adicional.

**Ocorrência** — evento operacional registrado durante uma entrega (cliente não encontrado, endereço incorreto, veículo com problema, entre outros). Não é estado e não incrementa o contador.

**Status** — estado atual do pedido dentro da máquina de estados. Toda mudança gera histórico com ator, data e, quando necessário, motivo.

**Contador de entregas** — total de entregas concluídas por entregador, derivado exclusivamente do estado final `entregue`. Nunca exibe valores financeiros.

**Plano** — pacote comercial do SaaS, com valor mensal e funcionalidades. É um registro global, sem `store_id`.

**Assinatura** — vínculo de uma loja a um plano, com vencimento, status, desconto ou cortesia.

**Suspensão** — estado da loja por pendência de mensalidade. Nunca apaga dados; o cardápio público exibe mensagem neutra, sem citar inadimplência.

**Tracking token** — identificador público, aleatório e não enumerável, que permite ao cliente acompanhar o próprio pedido sem login.

**Idempotência** — garantia de que reenviar a mesma solicitação (por exemplo, criar pedido ou aceitar entrega) produz um único efeito.

**Tenant** — unidade de isolamento de dados. No Pediu Aqui, o tenant é a loja.

**store_id** — coluna que identifica a loja dona do registro. Presente em todas as tabelas operacionais e base do isolamento por RLS. Tabelas globais, como `plans`, não recebem `store_id` artificial.
