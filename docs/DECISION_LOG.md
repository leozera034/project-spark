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
