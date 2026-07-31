# Pediu Aqui — Registro de Decisões

Formato: ID, data, decisão, motivo, consequência, riscos evitados, status.
Status possíveis: `aprovada`, `revisada`, `revogada`.

---

### D-001 — Nome oficial da plataforma
- **Data:** 2026-07-30
- **Decisão:** o nome oficial é "Pediu Aqui", identificador técnico `pediu-aqui`.
- **Motivo:** identidade própria e independente, sem herança de projetos anteriores.
- **Consequência:** todos os textos, metadados e identificadores usam essa grafia.
- **Riscos evitados:** confusão de marca; reuso acidental de ativos anteriores.
- **Status:** aprovada

### D-002 — Projeto totalmente independente
- **Data:** 2026-07-30
- **Decisão:** nenhum reuso de tabelas, migrations, componentes, layouts, contas, credenciais, segredos, funções, arquivos, imagens ou identidades de PortalExpress, MotoFácil, ArmShare ou qualquer outro sistema.
- **Motivo:** evitar acoplamento e contaminação de dados e marca.
- **Consequência:** repositório, Supabase, banco, auth, storage, segredos, domínio, pacote Android e identidade próprios.
- **Riscos evitados:** integração acidental com backend de terceiros; vazamento de dados.
- **Status:** aprovada

### D-003 — Operação inicial em uma única cidade
- **Data:** 2026-07-30
- **Decisão:** o MVP atende uma única cidade.
- **Motivo:** reduzir complexidade de bairros, taxas e logística.
- **Consequência:** bairros cadastrados por loja; sem seletor de cidade.
- **Riscos evitados:** escopo inflado; modelagem geográfica prematura.
- **Status:** aprovada

### D-004 — Plataforma multi-loja com isolamento completo
- **Data:** 2026-07-30
- **Decisão:** cada loja é um tenant isolado por `store_id` com RLS e negação por padrão.
- **Motivo:** requisito central de segurança e confiança.
- **Consequência:** toda tabela operacional carrega `store_id`; nenhuma consulta cruza lojas.
- **Riscos evitados:** vazamento entre lojas.
- **Status:** aprovada

### D-005 — Cliente final sem cadastro tradicional
- **Data:** 2026-07-30
- **Decisão:** sem e-mail, senha, CPF, data de nascimento, confirmação por e-mail ou app obrigatório.
- **Motivo:** reduzir atrito e atender público amplo, incluindo idosos.
- **Consequência:** identificação por primeiro nome e telefone; dados locais controlados.
- **Riscos evitados:** abandono no checkout; retenção desnecessária de dados pessoais.
- **Status:** aprovada

### D-006 — Confirmação obrigatória de endereço
- **Data:** 2026-07-30
- **Decisão:** mesmo com endereço salvo, o sistema pergunta "Você quer receber neste endereço?".
- **Motivo:** endereço incorreto é a principal causa de falha de entrega.
- **Consequência:** etapa explícita no checkout, com editar, trocar, criar novo ou mudar para retirada.
- **Riscos evitados:** entrega em endereço antigo.
- **Status:** aprovada

### D-007 — Catálogo genérico
- **Data:** 2026-07-30
- **Decisão:** produtos, variações, grupos de opções e itens de opção genéricos; proibidas tabelas como `pizza_flavors`, `acai_complements`, `burger_addons`, `marmita_proteins`.
- **Motivo:** atender qualquer comércio local com um único motor.
- **Consequência:** modelos iniciais são apenas ponto de partida.
- **Riscos evitados:** fragmentação do modelo; retrabalho por segmento.
- **Status:** aprovada

### D-008 — Entregadores exclusivos de cada loja
- **Data:** 2026-07-30
- **Decisão:** cada entregador pertence a exatamente uma loja e só vê entregas dela.
- **Motivo:** modelo operacional real dos comércios locais.
- **Consequência:** ofertas de entrega ficam restritas à loja.
- **Riscos evitados:** vazamento de pedidos; conflito operacional.
- **Status:** aprovada

### D-009 — Nenhuma frota compartilhada
- **Data:** 2026-07-30
- **Decisão:** sem frota global, marketplace, leilão, despacho global ou motorista da plataforma.
- **Motivo:** fora do modelo de negócio.
- **Consequência:** o administrador do SaaS nunca distribui entregas.
- **Riscos evitados:** responsabilidade trabalhista e operacional indevida.
- **Status:** aprovada

### D-010 — Nenhum financeiro de entregador
- **Data:** 2026-07-30
- **Decisão:** nenhum módulo de salário, comissão, valor por entrega, diária, bônus, carteira, saldo, repasse, folha, combustível, adiantamento, desconto, extrato ou acerto.
- **Motivo:** o acerto ocorre fora da plataforma.
- **Consequência:** o módulo do entregador é exclusivamente operacional; relatórios sem valores.
- **Riscos evitados:** exposição legal; escopo inflado.
- **Status:** aprovada

### D-011 — Contador apenas no estado entregue
- **Data:** 2026-07-30
- **Decisão:** o contador incrementa somente quando o pedido atinge `entregue`, contando para um único entregador, e é derivado das entregas finalizadas.
- **Motivo:** métrica objetiva e auditável.
- **Consequência:** nenhum campo incrementado manualmente.
- **Riscos evitados:** contagem inflada; divergência de dados.
- **Status:** aprovada

### D-012 — App do entregador via Capacitor
- **Data:** 2026-07-30
- **Decisão:** começa como web mobile-first e evolui para Android empacotado com Capacitor.
- **Motivo:** entregar valor cedo sem bloquear em loja de aplicativos.
- **Consequência:** a base web precisa funcionar bem antes do empacotamento.
- **Riscos evitados:** dependência precoce de build nativo.
- **Status:** aprovada

### D-013 — Distribuição inicial por APK
- **Data:** 2026-07-30
- **Decisão:** distribuição por APK, inicialmente fora da Play Store.
- **Motivo:** velocidade e controle.
- **Consequência:** necessário processo de atualização e guarda da chave de assinatura.
- **Riscos evitados:** bloqueio por revisão de loja.
- **Status:** aprovada

### D-014 — Supabase externo próprio e dedicado
- **Data:** 2026-07-30
- **Decisão:** projeto Supabase exclusivo do Pediu Aqui.
- **Motivo:** isolamento total de dados e segredos.
- **Consequência:** nenhuma conexão automática a backend desconhecido.
- **Riscos evitados:** integração acidental com projeto anterior.
- **Status:** aprovada

### D-015 — Suspensão nunca apaga dados
- **Data:** 2026-07-30
- **Decisão:** loja suspensa mantém dados, pedidos, produtos, clientes e configurações, com acesso mínimo para regularizar.
- **Motivo:** proteção do lojista e continuidade.
- **Consequência:** cardápio público exibe mensagem neutra, sem citar inadimplência.
- **Riscos evitados:** perda de dados; constrangimento perante o cliente final.
- **Status:** aprovada

### D-016 — Nenhuma informação de cartão
- **Data:** 2026-07-30
- **Decisão:** o sistema não coleta nem armazena dados de cartão; pagamentos do MVP são informativos.
- **Motivo:** evitar escopo PCI e risco desnecessário.
- **Consequência:** gateway apenas em evolução futura.
- **Riscos evitados:** exposição de dados financeiros.
- **Status:** aprovada

### D-017 — Trabalho dividido por fases
- **Data:** 2026-07-30
- **Decisão:** o projeto avança por fases, sem antecipar funcionalidades.
- **Motivo:** controle de escopo e qualidade.
- **Consequência:** cada fase tem critério de conclusão e proibições explícitas.
- **Riscos evitados:** crescimento descontrolado de escopo.
- **Status:** aprovada

### D-018 — Identidade futura em carbono e teal
- **Data:** 2026-07-30
- **Decisão:** direção cromática de carbono profundo, teal, superfícies claras e neutros de alto contraste; evitar roxo, laranja, excesso de vermelho, gradientes chamativos, neon e 3D.
- **Motivo:** posicionamento minimalista, tecnológico e profissional.
- **Consequência:** design system da Fase 02 parte dessa direção.
- **Riscos evitados:** aparência de template de delivery.
- **Status:** aprovada

### D-019 — Uma única fonte SVG master para a marca
- **Data:** 2026-07-30
- **Decisão:** todos os ativos derivam de um único SVG master.
- **Motivo:** consistência e manutenção.
- **Consequência:** nenhum logotipo criado nesta fase.
- **Riscos evitados:** divergência entre variações do logo.
- **Status:** aprovada

### D-020 — Papéis em tabela separada e verificação no backend
- **Data:** 2026-07-30
- **Decisão:** papéis ficam em `user_roles`, nunca em localStorage, na tabela de perfil, em variável de frontend ou em token criado pelo cliente; permissões são verificadas no servidor.
- **Motivo:** prevenir escalada de privilégio.
- **Consequência:** RLS e funções de verificação de papel no banco.
- **Riscos evitados:** acesso administrativo indevido.
- **Status:** aprovada

### D-021 — Símbolo da marca: letra P com faixa de movimento
- **Data:** 2026-07-30
- **Decisão:** o símbolo é a letra P em geometria constante atravessada por uma faixa horizontal teal que avança para fora da letra; proibidos ícones de comida, moto, sacola, balão de conversa ou cursor.
- **Motivo:** identidade abstrata, escalável e não datada, aplicável a qualquer comércio local.
- **Consequência:** todos os ativos, ícones e telas usam essa forma; nenhuma ilustração de segmento.
- **Riscos evitados:** aparência de template de delivery; obsolescência da marca ao ampliar segmentos.
- **Status:** aprovada

### D-022 — Geometria da marca em fonte única e ativos gerados por script
- **Data:** 2026-07-30
- **Decisão:** a geometria vive apenas em `tools/brand-geometry.mjs`, o wordmark é armazenado em contornos e todos os arquivos de `public/brand` são produzidos por `npm run brand:generate`.
- **Motivo:** garantir que todos os ativos derivem de uma única fonte, sem edição manual.
- **Consequência:** nenhum PNG é editado à mão; nenhum logotipo é redesenhado em JSX; ajustes de marca exigem regeração.
- **Riscos evitados:** divergência entre variações; dependência de fonte instalada; ativos órfãos.
- **Status:** aprovada

### D-023 — Tokens semânticos obrigatórios em OKLCH
- **Data:** 2026-07-30
- **Decisão:** toda cor, raio, elevação e tipografia da interface passa por tokens semânticos declarados em `src/styles.css` no formato OKLCH; classes de cor cruas são proibidas nos componentes.
- **Motivo:** consistência, tema escuro confiável e controle central da identidade.
- **Consequência:** novas cores exigem token em `:root` e `.dark` e registro em `@theme inline`.
- **Riscos evitados:** deriva visual; quebra do tema escuro; contraste insuficiente.
- **Status:** aprovada

### D-024 — Isolamento estrutural por chave estrangeira composta
- **Data:** 2026-07-30
- **Decisão:** toda tabela operacional possui `store_id` e `UNIQUE (id, store_id)`; todo relacionamento interno usa FK composta `(pai_id, store_id) → (id, store_id)`.
- **Motivo:** o isolamento entre lojas não pode depender apenas de RLS ou de filtro de aplicação.
- **Consequência:** vincular registro de outra loja passa a ser impossível no nível do banco, mesmo com policy mal escrita.
- **Riscos evitados:** vazamento entre lojas; produto ou grupo de opções cruzado; pedido apontando para bairro de outro tenant.
- **Status:** aprovada

### D-025 — Entidades globais sem `store_id` artificial
- **Data:** 2026-07-30
- **Decisão:** `plans` e `user_profiles` permanecem globais; apenas `user_roles` liga usuário e loja.
- **Motivo:** não distorcer a modelagem para forçar simetria.
- **Consequência:** o acesso a entidades globais será protegido por verificação de papel de administrador, não por `store_id`.
- **Riscos evitados:** duplicação de planos por loja; modelagem confusa.
- **Status:** aprovada

### D-026 — Negação por padrão na Fase 04
- **Data:** 2026-07-30
- **Decisão:** RLS habilitada e forçada em todas as tabelas de `public`, com zero policies, `REVOKE ALL` de `anon` e `authenticated` e `GRANT` somente ao papel de serviço.
- **Motivo:** nenhuma tela está conectada nesta fase; qualquer acesso aberto seria exposição gratuita.
- **Consequência:** o linter reporta "RLS sem policy" como informativo — esse é o estado desejado até a Fase 06.
- **Riscos evitados:** tabela publicamente legível; `GRANT` apressado sem policy correspondente.
- **Status:** aprovada

### D-027 — Token público de acompanhamento criptograficamente aleatório
- **Data:** 2026-07-30
- **Decisão:** `orders.public_tracking_token` usa `gen_random_bytes(24)` em hexadecimal, com restrição de unicidade.
- **Motivo:** o acompanhamento é acessível sem login e não pode ser enumerável.
- **Consequência:** o token nunca deriva de telefone, número do pedido, data ou sequência.
- **Riscos evitados:** varredura de pedidos de terceiros; exposição de dados do cliente.
- **Status:** aprovada

### D-028 — Preços e endereço congelados no pedido
- **Data:** 2026-07-30
- **Decisão:** `orders`, `order_items` e `order_item_options` guardam nome, preço e opções no momento da compra, além de snapshot do endereço e do bairro.
- **Motivo:** alteração posterior de catálogo ou de taxa não pode reescrever o histórico.
- **Consequência:** o backend recalcula tudo na criação e grava os valores; o cliente nunca envia preço confiável.
- **Riscos evitados:** manipulação de preço; divergência de relatório; contestação de valor.
- **Status:** aprovada

### D-029 — Contador de entregas sempre derivado
- **Data:** 2026-07-31
- **Decisão:** removida a coluna armazenada `couriers.completed_deliveries_count`. O total de entregas concluídas é calculado pela função `public.courier_completed_deliveries_count(_courier_id, _store_id)` e pela view `public.courier_delivery_counts`, ambas contando `deliveries.status = 'concluida'`.
- **Motivo:** contador armazenado pode ser incrementado manualmente, divergir da realidade e virar embrião de módulo financeiro.
- **Consequência:** nenhuma coluna `delivery_count`, `completed_deliveries` ou `total_deliveries` pode ser criada no futuro.
- **Status:** aprovada

### D-030 — Aceite de entrega por operação atômica
- **Data:** 2026-07-31
- **Decisão:** `UNIQUE(order_id)` em `deliveries` garante uma entrega por pedido, mas o aceite concorrente será resolvido por `UPDATE ... WHERE courier_id IS NULL AND status IN ('pendente','atribuida') RETURNING *`, considerando sucesso apenas quando exatamente uma linha retorna.
- **Motivo:** dois entregadores podem tentar aceitar a mesma entrega no mesmo instante.
- **Consequência:** implementação obrigatória nas fases de gestão de entregadores e experiência do entregador; nunca ler-e-depois-escrever.
- **Status:** aprovada

### D-031 — Funções de contexto de segurança no schema `private`
- **Data:** 2026-07-31
- **Decisão:** todas as funções que resolvem identidade, loja e papel (`is_store_member`, `is_store_manager`, `current_courier_id`, `current_courier_store_id`, `is_platform_admin`, `is_public_store`) vivem no schema `private`, com `SECURITY DEFINER` e `search_path` fixo.
- **Motivo:** policies que consultam `user_roles` diretamente causam recursão; funções em `public` viram RPC chamável.
- **Consequência:** o schema `private` nunca entra nos schemas expostos da Data API.
- **Status:** aprovada

### D-032 — Isolamento por loja com negação por padrão
- **Data:** 2026-07-31
- **Decisão:** toda tabela operacional recebe policies comparando `store_id` com as lojas do usuário. Nenhuma policy usa `USING (true)`. `GRANT` só é concedido para a operação que alguma policy permite.
- **Motivo:** o produto é multi-tenant; consulta entre lojas não pode existir nem por engano.
- **Consequência:** `audit_logs`, `order_status_history`, assinaturas e cobranças ficam somente leitura na API; escrita só por `service_role`.
- **Status:** aprovada

### D-034 — Catálogo público por coluna, dados sensíveis da loja fechados
- **Data:** 2026-07-31
- **Decisão:** o visitante do cardápio lê apenas lojas com status `ativa` e o catálogo publicado. O `GRANT SELECT` de `anon` em `stores` é por coluna e exclui `document`, `legal_name` e `email`.
- **Motivo:** o cardápio precisa ser público, o cadastro fiscal da loja não.
- **Consequência:** consultas públicas devem listar colunas explicitamente; `select *` como visitante falha por privilégio.
- **Status:** aprovada

### D-035 — Acompanhamento por token fora do RLS
- **Data:** 2026-07-31
- **Decisão:** `orders` não recebe policy para `anon`. O acompanhamento por `public_tracking_token` será servido por função de servidor que valida o token e devolve apenas campos de acompanhamento.
- **Motivo:** uma policy não consegue exigir posse do token; liberar `orders` para `anon` exporia todos os pedidos da loja.
- **Status:** aprovada

### D-036 — Escrita ampla de gestão é temporária
- **Data:** 2026-07-31
- **Decisão:** na Fase 06 a escrita nas tabelas da loja fica restrita a `proprietario` e `gerente`. Atendente e cozinha ficam somente leitura até a Fase 07 definir a autorização por ação.
- **Motivo:** isolamento não é autorização; abrir escrita para todos os cargos seria permissivo demais.
- **Consequência:** a Fase 07 deve substituir `private.is_store_manager` por verificações por ação.
- **Status:** aprovada

### D-037 — Isolamento não é autorização
- **Data:** 2026-07-31
- **Decisão:** revogada a D-036. Nenhuma escrita é liberada por pertencer à loja. Toda operação exige uma ação nomeada da matriz de autorização.
- **Motivo:** a Fase 06 abriu escrita ampla para proprietário e gerente, antecipando decisões de fases posteriores.
- **Consequência:** todas as policies de escrita baseadas em `private.is_store_manager` foram removidas; cada fase dona reabre o que precisa.
- **Riscos evitados:** permissão excessiva por padrão; cargo com poder não previsto.
- **Status:** aprovada

### D-038 — Catálogo fechado de permissões
- **Data:** 2026-07-31
- **Decisão:** as ações autorizáveis vivem no enum `public.app_permission`. Nenhuma permissão em texto livre, nenhuma string montada em runtime.
- **Motivo:** nome inventado não pode virar permissão silenciosa.
- **Consequência:** criar ação nova exige migration e atualização de `docs/AUTHORIZATION_MATRIX.md` e `src/domain/permissions.ts`.
- **Riscos evitados:** permissão fantasma; divergência entre código e banco.
- **Status:** aprovada

### D-039 — Autorização centralizada em `private.has_permission`
- **Data:** 2026-07-31
- **Decisão:** toda decisão de permissão passa por `private.has_permission(acao, loja)`, que usa apenas `auth.uid()`, exige perfil e vínculo ativos e nega por padrão. Nenhuma policy reimplementa lógica de papel.
- **Motivo:** lógica de papel espalhada em dezenas de policies diverge com o tempo.
- **Consequência:** a matriz de papéis por ação vive em `private.permission_roles`, versionada em código.
- **Riscos evitados:** regra contraditória entre tabelas; escalada de privilégio por policy esquecida.
- **Status:** aprovada

### D-040 — Contexto de permissões é orientação de interface
- **Data:** 2026-07-31
- **Decisão:** `public.get_my_authorization_context()` devolve apenas as permissões do próprio usuário, para esconder botões e menus. A verificação real permanece no banco em toda operação.
- **Motivo:** interface não é barreira de segurança.
- **Consequência:** nenhuma tela pode assumir permissão a partir de estado local; a função nunca aceita identidade por parâmetro.
- **Riscos evitados:** autorização apenas no frontend; permissão inferida de token do cliente.
- **Status:** aprovada

### D-041 — Plataforma sem acesso a dado de cliente
- **Data:** 2026-07-31
- **Decisão:** não existe permissão de plataforma sobre cliente, endereço, pedido, item de pedido ou entrega. A ausência é estrutural, não filtro de aplicação.
- **Motivo:** o administrador do SaaS opera a plataforma, não a operação da loja.
- **Consequência:** suporte trabalha com contexto institucional e não com dado pessoal do consumidor.
- **Riscos evitados:** exposição indevida de dado pessoal; risco legal.
- **Status:** aprovada

### D-042 — Configurações da loja só mudam por RPC verificada
- **Data:** 2026-07-31
- **Decisão:** toda alteração de dados, identidade, horários, atendimento, bairros e pagamentos passa por função do banco que valida permissão, versão e conteúdo. Nenhuma escrita direta em tabela pelo cliente.
- **Motivo:** validação de formulário não é validação de negócio.
- **Consequência:** o `store_id` enviado pela interface é sempre reconferido contra o vínculo real do usuário.
- **Riscos evitados:** alteração de configuração de outra loja; gravação de valor inválido.
- **Status:** aprovada

### D-043 — Arquivamento em vez de exclusão no catálogo
- **Data:** 2026-07-31
- **Decisão:** categorias e produtos nunca são apagados pela interface; eles são arquivados e podem ser restaurados.
- **Motivo:** itens de catálogo serão referenciados por pedidos históricos.
- **Consequência:** todas as listagens filtram arquivados por padrão e o estado arquivado bloqueia edição.
- **Riscos evitados:** perda de histórico; referência quebrada em pedido antigo.
- **Status:** aprovada

### D-044 — Produto simples exige categoria da própria loja
- **Data:** 2026-07-31
- **Decisão:** todo produto pertence obrigatoriamente a uma categoria e a validação de pertencimento acontece no banco, com chave composta por loja.
- **Motivo:** categoria é a unidade de organização do cardápio e o ponto natural de vazamento entre lojas.
- **Consequência:** não existe produto órfão nem produto apontando para categoria de outra loja.
- **Riscos evitados:** mistura de catálogo entre lojas; item invisível no cardápio.
- **Status:** aprovada

### D-045 — Imagens do catálogo em espaço privado por loja
- **Data:** 2026-07-31
- **Decisão:** o bucket `store-catalog` é privado, organizado por `{store_id}/categories|products/{id}/arquivo`, e o acesso administrativo usa apenas endereços temporários.
- **Motivo:** endereço público permanente vaza conteúdo e permite varredura.
- **Consequência:** a referência guardada no banco é o caminho interno, nunca uma URL. A troca de imagem só apaga a anterior depois de gravar a nova.
- **Riscos evitados:** acesso a imagem de outra loja; link permanente indexável; perda de imagem em falha parcial.
- **Status:** aprovada

### D-046 — Ordenação e concorrência explícitas no catálogo
- **Data:** 2026-07-31
- **Decisão:** a ordem de categorias e produtos é um campo próprio reordenado em lote, e toda edição envia a versão que o usuário estava vendo.
- **Motivo:** duas pessoas editando o mesmo cardápio é cenário comum na operação.
- **Consequência:** edição sobre dado desatualizado é recusada com aviso de recarregar, sem sobrescrever silenciosamente.
- **Riscos evitados:** perda de alteração de outro operador; ordem instável no cardápio.
- **Status:** aprovada

### D-047 — Pizza com vários sabores é regra configurável do grupo de opções
- **Data:** 2026-07-31
- **Decisão:** o preço de um item com frações (meio a meio e afins) segue uma regra escolhida pela loja no grupo de sabores ou no produto: `highest_price` (cobra o sabor mais caro) ou `average_price` (média proporcional às frações). Sem tabela ou motor específico de pizza.
- **Motivo:** o mesmo motor genérico de opções precisa resolver sabores, adicionais, seleções, quantidades e preços para qualquer segmento.
- **Consequência:** o grupo de opções ganha um campo de regra de precificação por fração; o cálculo final é sempre refeito no banco no momento do pedido.
- **Riscos evitados:** motor paralelo só para pizzaria; divergência entre preço mostrado e preço cobrado.
- **Status:** aprovada
- **Questão relacionada:** Q-005

### D-048 — Venda por peso no MVP é peso exato ou embalagem fixa
- **Data:** 2026-07-31
- **Decisão:** produtos vendidos por peso oferecem apenas opções previamente definidas (por exemplo 250 g, 500 g, 1 kg ou embalagem fechada). Não existe preço estimado nem ajuste de valor depois que o pedido é feito.
- **Motivo:** total determinístico, preço congelado e checkout confiável valem mais que flexibilidade de balança nesta primeira versão.
- **Consequência:** o modelo de produto permanece genérico com unidade, quantidade e peso; nada de tabela por segmento. Ajuste posterior de peso fica para fase futura.
- **Riscos evitados:** cobrança surpresa para o cliente; total que muda depois do fechamento; recálculo inseguro fora do banco.
- **Status:** aprovada
- **Questão relacionada:** Q-017

### D-049 — Um único motor genérico de opções para todos os segmentos
- **Data:** 2026-07-31
- **Decisão:** tamanhos, sabores, adicionais, complementos, escolhas obrigatórias e seleções por quantidade são representados por apenas duas estruturas: variações do produto e grupos de opções com itens. Não existe tabela específica por segmento.
- **Motivo:** o produto é multi-segmento; qualquer estrutura dedicada criaria manutenção paralela e regras divergentes.
- **Consequência:** o grupo de opções carrega tipo de seleção, mínimos, máximos, estratégia de preço, efeito no preço e contagem de porções. O mesmo grupo pode ser reaproveitado por vários produtos da mesma loja.
- **Riscos evitados:** motor paralelo por nicho; divergência de cálculo entre segmentos.
- **Status:** aprovada

### D-050 — Preço configurado é sempre calculado no servidor
- **Data:** 2026-07-31
- **Decisão:** o preço de um produto configurado nunca é calculado no navegador. A interface monta a seleção e o banco devolve preço unitário, total, detalhamento por grupo e erros de validação.
- **Motivo:** o valor cobrado precisa ter uma fonte única e auditável, e a prévia administrativa deve mostrar exatamente o que o pedido cobraria.
- **Consequência:** a prévia da loja consome a mesma rotina que o pedido consumirá nas fases seguintes.
- **Riscos evitados:** preço mostrado diferente do cobrado; manipulação de valores pelo cliente.
- **Status:** aprovada

### D-051 — Preço específico por variação vive em tabela própria
- **Data:** 2026-07-31
- **Decisão:** quando um item de opção custa diferente em cada tamanho, o valor é gravado em uma tabela de preço por par variação/item. Sem valor específico, vale o preço adicional do item.
- **Motivo:** manter o item único e reaproveitável, sem duplicar grupos por tamanho.
- **Consequência:** a gravação é feita em bloco e de forma transacional; a validação avisa quando faltam preços em grupo que substitui o preço base.
- **Riscos evitados:** explosão de grupos duplicados; preço incoerente entre tamanhos.
- **Status:** aprovada

### D-052 — Produto publicado precisa de configuração válida
- **Data:** 2026-07-31
- **Decisão:** o banco recusa publicar, ou manter publicado, um produto cuja configuração esteja inválida — sem variação padrão, com grupo obrigatório sem itens, com dois grupos substituindo o preço, entre outros.
- **Motivo:** um produto publicado com configuração quebrada gera pedido impossível de precificar.
- **Consequência:** ativar produto, desativar variação, arquivar grupo ou desvincular grupo passam pela mesma checagem antes de concluir.
- **Riscos evitados:** cardápio com item impossível de comprar; pedido sem preço definido.
- **Status:** aprovada

### D-053 — Endereço público da loja é /loja/{slug}
- **Data:** 2026-07-30
- **Decisão:** o cardápio público do MVP responde em `/loja/{slug}`; `$slug` é apenas a sintaxe de parâmetro do roteador e nunca aparece na URL final.
- **Motivo:** fechar a Q-002 sem depender de domínio próprio nem de subdomínio por loja.
- **Consequência:** o slug é validado por expressão regular antes de qualquer consulta; slug inválido ou inexistente devolve resposta neutra.
- **Riscos evitados:** enumeração de lojas por mensagens diferentes; link quebrado com parâmetro literal.
- **Status:** aprovada

### D-054 — Cliente sem conta, com dados apenas no aparelho
- **Data:** 2026-07-30
- **Decisão:** o cliente não cria conta, não informa senha, telefone, CPF ou e-mail. Primeiro nome e endereços ficam somente no armazenamento local do próprio aparelho, com chave isolada por slug.
- **Motivo:** reduzir atrito na jornada e evitar guardar dado pessoal no servidor antes de existir pedido.
- **Consequência:** o servidor recebe apenas modalidade, identificador de bairro e versão de configuração. Nada de nome ou endereço em requisição, URL, log ou métrica.
- **Riscos evitados:** vazamento de dado pessoal; mistura de dados entre lojas no mesmo navegador.
- **Status:** aprovada

### D-055 — Endereço salvo é sugestão, nunca confirmação
- **Data:** 2026-07-30
- **Decisão:** toda jornada exige confirmação explícita da modalidade e do endereço. Selecionar um endereço salvo apenas o destaca; a confirmação acontece em tela própria, com opções de editar, escolher outro, cadastrar novo ou mudar para retirada.
- **Motivo:** entrega no endereço errado é o erro mais caro da operação.
- **Consequência:** a confirmação é guardada como impressão digital de modalidade, endereço, bairro e versão da configuração da loja. Qualquer alteração invalida a confirmação e devolve o cliente à etapa de revisão.
- **Riscos evitados:** pedido enviado para endereço antigo; taxa cobrada com base em bairro desatualizado.
- **Status:** aprovada

### D-056 — Armazenamento local tratado como entrada não confiável
- **Data:** 2026-07-30
- **Decisão:** todo conteúdo lido do aparelho passa por validação de esquema antes de uso, com descarte de chaves perigosas e de registros corrompidos, e com funcionamento em memória quando o armazenamento estiver indisponível.
- **Motivo:** o conteúdo local pode ser editado pelo próprio usuário ou por outra aba.
- **Consequência:** dado inválido é descartado em silêncio e a jornada recomeça na etapa correspondente, sem erro técnico visível.
- **Riscos evitados:** poluição de protótipo; travamento por dado malformado; confirmação forjada.
- **Status:** aprovada

### D-057 — Carrinho vive no aparelho e é recotizado no servidor
- **Data:** 2026-07-30
- **Decisão:** o carrinho do cliente é guardado apenas no armazenamento local, isolado por slug canônico e com validade de sete dias. Nenhuma linha de carrinho é gravada no banco nesta fase.
- **Motivo:** o cliente não tem conta; persistir carrinho no servidor criaria dado pessoal sem pedido correspondente.
- **Consequência:** o carrinho é reconstruído a partir do aparelho e revalidado a cada abertura, mudança de item, retorno de foco ou reconexão.
- **Riscos evitados:** carrinho órfão no banco; mistura de carrinhos entre lojas no mesmo navegador.
- **Status:** aprovada

### D-058 — Nenhum preço vindo do navegador é aceito
- **Data:** 2026-07-30
- **Decisão:** o corpo enviado à cotação contém somente identificadores públicos, quantidades e a modalidade. Preço, subtotal, taxa e total são sempre calculados no servidor pelo motor canônico da Fase 10 e pela validação de atendimento da Fase 12.
- **Motivo:** qualquer valor exibido no aparelho é editável pelo usuário.
- **Consequência:** os valores guardados localmente são apenas "último valor conhecido", usados para exibição offline e para detectar mudança de preço.
- **Riscos evitados:** manipulação de total; cobrança divergente do cardápio publicado.
- **Status:** aprovada

### D-059 — Cotação do carrinho em uma única chamada
- **Data:** 2026-07-30
- **Decisão:** o navegador faz uma única requisição para recalcular o carrinho inteiro. A agregação por linha acontece no servidor, com limite de quarenta linhas, corpo máximo e limite de frequência por instância.
- **Motivo:** conexões fracas e cardápios grandes tornam inviável uma chamada por item.
- **Consequência:** respostas fora de ordem são descartadas por número de sequência; falha de rede mantém os últimos valores conhecidos com aviso explícito.
- **Riscos evitados:** total intercalado de duas respostas; sobrecarga do banco; abuso do endpoint público.
- **Status:** aprovada

### D-060 — Mudanças do cardápio nunca são aplicadas em silêncio
- **Data:** 2026-07-30
- **Decisão:** item esgotado, item removido do cardápio, configuração inválida e mudança de preço bloqueiam o avanço e são comunicados linha a linha, com ação de remover ou revisar.
- **Motivo:** o cliente precisa reconhecer a mudança antes de pagar por ela.
- **Consequência:** o botão de avanço só é liberado com todas as linhas válidas, pedido mínimo atingido e contexto de atendimento confirmado.
- **Riscos evitados:** cobrança surpresa; pedido enviado com item indisponível.
- **Status:** aprovada

### D-061 — Telefone obrigatório em entrega e em retirada
- **Data:** 2026-07-31
- **Decisão:** o telefone do cliente é obrigatório nas duas modalidades. A identificação continua sem cadastro e sem senha, formada por primeiro nome e telefone, coletados no checkout (Fase 14).
- **Motivo:** mesmo na retirada a loja precisa avisar sobre item indisponível, alteração de preparo, pedido pronto, atraso, dúvida sobre observação ou impossibilidade de atender.
- **Consequência:** fluxo único de identificação; validação de formato no servidor; nenhum pedido criado sem forma de contato.
- **Riscos evitados:** pedido de retirada sem contato; duas jornadas divergentes de identificação.
- **Status:** aprovada

### D-062 — Pedido agendado fica para pós-MVP
- **Data:** 2026-07-31
- **Decisão:** o MVP não terá agendamento. Nenhum campo improvisado de data ou hora será criado, e a observação livre não pode ser usada nem interpretada como agendamento.
- **Motivo:** agendamento real depende de horário de funcionamento, disponibilidade futura, fila operacional, capacidade da cozinha, prazo de preparo e confirmação da loja.
- **Consequência:** o checkout da Fase 14 cria apenas pedidos imediatos; agendamento entra em fase própria pós-MVP com máquina de estados dedicada.
- **Riscos evitados:** promessa não cumprida ao cliente; observação ignorada pela operação; estado de pedido ambíguo.
- **Status:** aprovada

### D-063 — A criação do pedido é uma única transação no servidor
- **Data:** 2026-07-31
- **Decisão:** cliente, endereço, pedido, itens, opções e histórico são gravados por uma única função transacional no banco, executável apenas pela role de serviço. O navegador nunca escreve nessas tabelas.
- **Motivo:** pedido pela metade é pior do que pedido recusado.
- **Consequência:** qualquer falha desfaz tudo; a resposta é sempre pedido criado por completo ou motivo explícito de recusa.
- **Riscos evitados:** pedido sem itens; item órfão; total gravado antes da validação.
- **Status:** aprovada

### D-064 — Nenhum valor exibido no checkout é aceito como verdade
- **Data:** 2026-07-31
- **Decisão:** no envio, cada linha é recalculada pelo motor canônico, a taxa vem da validação de atendimento e o pedido mínimo é reavaliado. O corpo enviado carrega apenas identificadores, quantidades e escolhas.
- **Motivo:** preço na mão do navegador é preço manipulável.
- **Consequência:** o cliente pode ver uma recusa por mudança de preço ou item indisponível no momento do envio.
- **Riscos evitados:** pedido com preço adulterado; venda abaixo do mínimo; taxa de entrega forjada.
- **Status:** aprovada

### D-065 — Idempotência com verificação de conteúdo
- **Data:** 2026-07-31
- **Decisão:** cada tentativa de envio carrega uma chave de idempotência por loja. Reenvio com o mesmo conteúdo devolve o pedido já criado; reenvio da mesma chave com conteúdo diferente é recusado.
- **Motivo:** conexão instável e toque duplo no botão são a regra, não a exceção.
- **Consequência:** o pedido é criado uma única vez; a numeração sequencial por loja é protegida por trava.
- **Riscos evitados:** pedido duplicado; número de pedido repetido; chave reaproveitada para outro carrinho.
- **Status:** aprovada

### D-066 — O token de acompanhamento só existe em hash no banco
- **Data:** 2026-07-31
- **Decisão:** o banco guarda apenas o SHA-256 do token de acompanhamento (`orders.tracking_token_hash`, único). O token bruto é devolvido uma única vez, no momento da criação do pedido, e um gatilho impede que ele volte a ser persistido.
- **Motivo:** o link de acompanhamento é a credencial do cliente; vazamento de backup, dump ou log não pode virar acesso a pedidos.
- **Consequência:** um reenvio idempotente cujo primeiro retorno se perdeu não recupera o link; o cliente ainda vê número, totais e situação pelo comprovante local.
- **Riscos evitados:** enumeração a partir de dump; token em log de banco; reuso de token exposto.
- **Status:** aprovada

### D-067 — O status interno nunca chega ao cliente
- **Data:** 2026-07-31
- **Decisão:** o banco traduz o enum operacional para um código público estável (`received`, `confirmed`, `preparing`, `out_for_delivery`, `ready_for_pickup`, `delivered`, `picked_up`, `declined`, `canceled`) e o navegador escolhe o texto humano a partir desse código.
- **Motivo:** o enum interno é detalhe de operação e vai mudar; ele não pode virar contrato público.
- **Consequência:** mudanças na operação não quebram a tela pública nem revelam a fila interna da loja.
- **Riscos evitados:** vazamento de organização interna; acoplamento do cliente ao schema.
- **Status:** aprovada

### D-068 — Acompanhamento por polling com versão de status
- **Data:** 2026-07-31
- **Decisão:** o acompanhamento usa polling consciente de visibilidade, enviando a versão conhecida do status. Sem mudança, a resposta é apenas `changed: false`. Estado final encerra o polling.
- **Motivo:** Realtime público exigiria abrir o banco ao anônimo; polling barato resolve o MVP sem essa superfície.
- **Consequência:** a atualização leva de 12 a 30 segundos; aba oculta ou aparelho offline não consultam.
- **Riscos evitados:** canal Realtime aberto ao anônimo; tráfego desnecessário; consumo de bateria.
- **Status:** aprovada
