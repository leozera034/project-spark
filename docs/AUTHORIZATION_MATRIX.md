# Matriz de Autorização por Papel e Ação — Pediu Aqui (Fase 07)

> **Isolamento ≠ autorização.** A Fase 06 garante que ninguém enxergue outra loja.
> Esta fase define **o que cada cargo pode fazer dentro da própria loja**.

## 1. Princípios

1. **Negação por padrão.** Nenhuma ação é permitida sem entrada explícita nesta matriz.
2. **Fonte única.** Toda decisão passa por `private.has_permission(acao, loja)`.
   Nenhuma policy repete lógica de papel.
3. **O cliente nunca declara identidade.** A função usa apenas `auth.uid()`.
   Não existe parâmetro `user_id`, `role` ou `store_id` vindo do navegador que
   altere o resultado.
4. **Catálogo fechado de ações.** As ações são valores do enum
   `public.app_permission`. Um nome inventado não compila a consulta.
5. **Perfil inativo não age.** `user_profiles.is_active = false` derruba todas as
   permissões, independentemente do papel.
6. **Vínculo inativo não age.** `user_roles.is_active = false` é ignorado.
7. **A interface não decide.** `public.get_my_authorization_context()` devolve as
   permissões do próprio usuário apenas para orientar menus e botões. A verificação
   real acontece no banco, em toda operação.

## 2. Função central

```sql
private.has_permission(_permission public.app_permission, _target_store_id uuid DEFAULT NULL)
```

Ordem de avaliação:

| Etapa | Regra |
| --- | --- |
| 1 | `auth.uid()` nulo → **falso** |
| 2 | perfil inexistente ou inativo → **falso** |
| 3 | ação sem papel atribuído na matriz → **falso** |
| 4 | ação `platform.*` → exige `admin_plataforma` ativo **e** loja alvo nula |
| 5 | ação `courier.*` → exige entregador ativo cuja loja seja exatamente a loja alvo |
| 6 | demais ações → exige loja alvo **e** papel ativo vinculado àquela loja |

`SECURITY DEFINER`, `search_path` fixo, no schema `private` — logo não é chamável
como RPC e não causa recursão ao ler `user_roles`.

## 3. Matriz

Legenda: `PRO` proprietário · `GER` gerente · `ATD` atendente · `COZ` cozinha ·
`ENT` entregador · `ADM` administração da plataforma.

### Loja

| Ação | PRO | GER | ATD | COZ | ENT | ADM |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| `store.view_basic` | ✔ | ✔ | ✔ | ✔ | — | — |
| `store.update_profile` | ✔ | — | — | — | — | — |
| `store.manage_settings` | ✔ | ✔ | — | — | — | — |
| `store.manage_hours` | ✔ | ✔ | — | — | — | — |
| `store.manage_neighborhoods` | ✔ | ✔ | — | — | — | — |
| `store.manage_payment_methods` | ✔ | ✔ | — | — | — | — |

### Catálogo

| Ação | PRO | GER | ATD | COZ | ENT | ADM |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| `catalog.view` | ✔ | ✔ | ✔ | ✔ | — | — |
| `catalog.create` | ✔ | ✔ | — | — | — | — |
| `catalog.update` | ✔ | ✔ | — | — | — | — |
| `catalog.archive` | ✔ | ✔ | — | — | — | — |

### Pedidos

| Ação | PRO | GER | ATD | COZ | ENT | ADM |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| `orders.view_queue` | ✔ | ✔ | ✔ | — | — | — |
| `orders.view_customer_contact` | ✔ | ✔ | ✔ | — | — | — |
| `orders.accept` | ✔ | ✔ | ✔ | — | — | — |
| `orders.reject` | ✔ | ✔ | ✔ | — | — | — |
| `orders.start_preparation` | ✔ | ✔ | ✔ | ✔ | — | — |
| `orders.mark_ready` | ✔ | ✔ | ✔ | ✔ | — | — |
| `orders.cancel` | ✔ | ✔ | — | — | — | — |

A cozinha **não** enxerga contato do cliente nem cancela pedido.

### Cozinha

| Ação | PRO | GER | ATD | COZ | ENT | ADM |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| `kitchen.view` | ✔ | ✔ | — | ✔ | — | — |
| `kitchen.start_preparation` | ✔ | ✔ | — | ✔ | — | — |
| `kitchen.mark_ready` | ✔ | ✔ | — | ✔ | — | — |

### Equipe

| Ação | PRO | GER | ATD | COZ | ENT | ADM |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| `team.view` | ✔ | ✔ | — | — | — | — |
| `team.invite` | ✔ | — | — | — | — | — |
| `team.change_role` | ✔ | — | — | — | — | — |
| `team.disable` | ✔ | — | — | — | — | — |

Gerente **não** promove ninguém: mudança de papel é exclusiva do proprietário.

### Entregadores (gestão pela loja)

| Ação | PRO | GER | ATD | COZ | ENT | ADM |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| `couriers.view` | ✔ | ✔ | ✔ | — | — | — |
| `couriers.create` | ✔ | ✔ | — | — | — | — |
| `couriers.update` | ✔ | ✔ | — | — | — | — |
| `couriers.assign` | ✔ | ✔ | ✔ | — | — | — |
| `couriers.reset_access` | ✔ | ✔ | — | — | — | — |

### Entregador (próprias ações)

| Ação | PRO | GER | ATD | COZ | ENT | ADM |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| `courier.view_self` | — | — | — | — | ✔ | — |
| `courier.view_offered_deliveries` | — | — | — | — | ✔ | — |
| `courier.view_assigned_delivery` | — | — | — | — | ✔ | — |
| `courier.update_delivery_status` | — | — | — | — | ✔ | — |
| `courier.register_incident` | — | — | — | — | ✔ | — |

Nenhuma ação de entregador envolve valor, repasse, saldo ou acerto (D-010).

### Relatórios, assinatura e plataforma

| Ação | PRO | GER | ATD | COZ | ENT | ADM |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| `reports.view_operational` | ✔ | ✔ | — | — | — | — |
| `subscription.view` | ✔ | — | — | — | — | — |
| `platform.stores.*` | — | — | — | — | — | ✔ |
| `platform.plans.*` | — | — | — | — | — | ✔ |
| `platform.billing.*` | — | — | — | — | — | ✔ |
| `platform.audit.view` | — | — | — | — | — | ✔ |
| `platform.support.open_context` | — | — | — | — | — | ✔ |

A administração da plataforma **não** possui nenhuma permissão sobre cliente,
endereço, pedido, item de pedido ou entrega. Isso é ausência de linha na matriz,
não filtro de aplicação.

## 4. O que esta fase ainda não libera

A matriz existe e é aplicável, mas as **policies de escrita e as leituras
operacionais** só serão criadas nas fases donas de cada assunto:

| Assunto | Fase | Permissões já definidas, ainda sem policy |
| --- | --- | --- |
| Cardápio público / visitante | 11 | — (acesso `anon` continua fechado) |
| Gestão de catálogo | 12–14 | `catalog.create/update/archive` |
| Pedidos e cozinha | 17–19 | `orders.*`, `kitchen.*` |
| Equipe | 20 | `team.*` |
| Entregadores (loja) | 21 | `couriers.*` |
| Aplicativo do entregador | 22 | `courier.*` (exceto `view_self`, já ativa) |
| Relatórios | 23 | `reports.view_operational` |
| Assinatura e cobrança | 24 | `subscription.view`, `platform.billing.*` |
| Administração da plataforma | 25 | `platform.*` |

Hoje estão ativas apenas as leituras mínimas: dados institucionais da própria
loja, catálogo interno da própria loja e o próprio cadastro do entregador.

## 5. Plano de teste

1. Atendente tenta editar produto → negado.
2. Cozinha tenta ler contato do cliente → negado.
3. Gerente tenta trocar papel de usuário → negado.
4. Entregador tenta ler outro entregador da mesma loja → negado.
5. Entregador tenta ler entrega de outra loja → negado.
6. Administração da plataforma tenta ler pedido de qualquer loja → negado.
7. Usuário com perfil desativado perde todas as permissões imediatamente.
8. Usuário com vínculo desativado perde as permissões daquela loja.
9. Chamada de `private.has_permission` como RPC → função inexistente na API.
10. `get_my_authorization_context()` de um usuário nunca retorna permissão de loja
    à qual ele não está vinculado.
