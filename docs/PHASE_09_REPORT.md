# Relatório da Fase 09 — Catálogo básico real

**Data:** 2026-07-31
**Escopo:** categorias e produtos simples, conectados ao banco, dentro da loja do usuário.

## O que entrou

### Categorias
- Criação, edição, ativação/desativação, arquivamento e restauração.
- Ordenação manual (subir/descer) aplicada em lote.
- Nome único por loja, com comparação que ignora acentos e maiúsculas.
- Imagem opcional em espaço privado.
- Contador de produtos por categoria calculado no banco, nunca guardado como número solto.

### Produtos simples
- Cadastro com categoria, nome, descrição, preço único, observações do cliente e situação inicial.
- Edição com prévia administrativa lado a lado.
- Ações rápidas na lista: ativar/desativar, esgotar/repor, destacar/tirar destaque, arquivar/restaurar.
- Busca por nome do produto ou da categoria, filtro por categoria e por situação.
- Paginação de 20 itens.
- Imagem opcional em espaço privado, com remoção da anterior somente após gravar a nova.

### Fora do escopo (permanece na Fase 10)
Variações, adicionais, grupos de opções, combos, venda por peso e vitrine pública do cliente.

## Segurança

- Toda leitura e escrita passa por funções do banco que reconferem o vínculo do usuário com a loja; o identificador de loja enviado pela interface nunca é aceito por si só.
- Permissões usam a matriz da Fase 07 (`catalog.view`, `catalog.create`, `catalog.update`, `catalog.archive`). A interface apenas esconde botões; a decisão real é do banco.
- Continua sem qualquer acesso anônimo ao catálogo: a vitrine pública é fase posterior.
- Descrições passam por limpeza de texto no banco; conteúdo com marcação é recusado.
- Bucket `store-catalog` é privado, com regras por pasta de loja e leitura apenas por URL temporária.
- Mensagens de erro são traduzidas para linguagem do lojista, sem detalhe interno de banco.
- Todas as alterações relevantes ficam registradas na trilha de auditoria da loja.

## Concorrência

Edições enviam a versão que estava na tela. Se outra pessoa alterou antes, a operação é recusada com aviso para recarregar, em vez de sobrescrever.

## Verificações feitas

- Categoria não pode ser criada com nome repetido na mesma loja.
- Produto não aceita categoria de outra loja.
- Produto arquivado não aceita edição até ser restaurado.
- Preço zero ou negativo é recusado.
- Loja sem categoria ativa não libera o cadastro de produto e mostra o caminho para criar a primeira.

## Correções aproveitadas nesta fase

- Corrigido um laço de atualização infinita no formulário de configurações (Fase 08), que reiniciava o estado a cada renderização.
