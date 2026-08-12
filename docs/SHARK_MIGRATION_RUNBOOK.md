# SHARK — Migration Runbook

Escopo: branch `feat/shark-category-engine-2026-08-11`, Project Spark/SHARK.

## Regra de execução

Não aplicar a cadeia parcialmente em produção. Antes de qualquer DDL, executar `supabase/tests/shark_environment_preflight.sql` e `supabase/tests/shark_legacy_preflight.sql`. Qualquer exception interrompe a aplicação. Fazer snapshot/backup do banco antes da primeira migration.

## Cadeia SHARK — ordem obrigatória

1. `20260811040000_shark_category_engine_foundation.sql`
2. `20260811040100_shark_pricing_engine_v2.sql`
3. `20260811040200_shark_storefront_projection.sql`
4. `20260811040300_shark_catalog_admin_extensions.sql`
5. `20260811040400_shark_combo_builder.sql`
6. `20260811040500_shark_selection_canonicalization.sql`
7. `20260811040600_shark_profile_public_rpc.sql`
8. `20260811040700_shark_order_option_snapshot.sql`
9. `20260811040800_shark_linked_stock_guard.sql`
10. `20260811040900_shark_combo_fk_integrity.sql`
11. `20260811041000_shark_combo_variant_invariants.sql`
12. `20260811041100_shark_atomic_checkout_guard.sql`
13. `20260811041200_shark_atomic_inventory_reservations.sql`
14. `20260811041300_shark_inventory_management_api.sql`
15. `20260811041400_shark_storefront_popularity.sql`
16. `20260811041500_shark_storefront_recommendations.sql`
17. `20260811041600_shark_storefront_experience_profile.sql`
18. `20260811041700_shark_starter_group_drafts.sql`
19. `20260811041800_shark_safe_group_publish.sql`
20. `20260811041900_shark_variant_flavor_limits.sql`
21. `20260811042000_shark_flavor_portions_by_variant.sql`
22. `20260811042100_shark_storefront_flavor_structure_rpc.sql`
23. `20260811042200_shark_flavor_portion_capacity_sync.sql`
24. `20260811042300_shark_combo_choice_availability.sql`
25. `20260811042400_shark_combo_self_reference_guard.sql`
26. `20260811042500_shark_flavor_item_capacity_trigger.sql`
27. `20260811042600_shark_variant_group_rules.sql`
28. `20260811042700_shark_variant_group_pricing_rules.sql`
29. `20260811042800_shark_restaurant_profile_defaults.sql`
30. `20260811042900_shark_meal_group_defaults.sql`
31. `20260811043000_shark_burger_profile_defaults.sql`
32. `20260811043100_shark_buildable_experience_hints.sql`
33. `20260811043200_shark_burger_draft_semantics.sql`
34. `20260811043300_shark_burger_meal_guard.sql`
35. `20260811043400_shark_burger_explicit_experience.sql`
36. `20260811043500_shark_remaining_profile_defaults.sql`
37. `20260811043600_shark_remaining_profile_drafts.sql`
38. `20260811043700_shark_consolidate_experience_state.sql`
39. `20260811043800_shark_capability_contract.sql`
40. `20260811043900_shark_category_profile_public_policy.sql`
41. `20260811044000_shark_template_rpc_hardening.sql`
42. `20260811044100_shark_selection_group_canonicalization.sql`
43. `20260811044200_shark_storefront_payload_minimization.sql`
44. `20260811044300_shark_checkout_inventory_error_contract.sql`
45. `20260811044400_shark_inventory_optimistic_concurrency.sql`
46. `20260811044500_shark_inventory_write_contract.sql`
47. `20260811044600_shark_ranking_evidence_threshold.sql`
48. `20260811044700_shark_variant_size_source_of_truth.sql`
49. `20260811044800_shark_variant_group_rule_integrity.sql`
50. `20260811044900_shark_combo_graph_integrity.sql`
51. `20260811045000_shark_multiflavor_invariants.sql`
52. `20260811045100_shark_final_rpc_lockdown.sql`
53. `20260811045200_shark_variant_option_price_projection.sql`
54. `20260811045300_shark_variant_option_price_rpc.sql`
55. `20260811045400_shark_variant_option_price_integrity.sql`
56. `20260811045500_shark_effective_variant_option_prices.sql`

## Pós-aplicação obrigatório

Executar, nesta ordem:

1. `supabase/tests/shark_post_migration_contract.sql`
2. `supabase/tests/shark_engine_contract.sql`

Não liberar storefront se qualquer contrato levantar exception.

## Smoke test funcional

Validar pelo menos: produto simples; produto com variação; adicional com preço recalculado no servidor; adicional com override de preço por P/M/G mostrando o valor efetivo da variação selecionada; rejeição de preço específico cuja variação ou opção pertença a outro produto; pizza multi-sabor com regra `highest`; partes de sabor por tamanho; açaí com escolhas incluídas; combo com produto vinculado; rejeição de auto-referência/ciclo de combo; estoque concorrente; cancelamento/recusa liberando reserva; alteração manual de estoque com `expected_updated_at`; publicação de grupo sem permitir rascunho vazio; regras de min/max/incluídos por tamanho; `burger_experience` e `meal_experience` controlando a linguagem da UI sem heurística por combinação de grupos.

## Stop conditions

Interromper se houver: objeto ausente no preflight; dados órfãos; mais de uma variação default ativa; produto marcado com variantes sem variante disponível; preço negativo legado; falha de FK; conflito `burger_experience + meal_experience`; `max_flavors > flavor_parts`; ciclo de combo; preço por variação apontando para variação/opção de outro produto; regra por variação cujo limite efetivo seja impossível; grant de RPC server-only para `anon` ou `authenticated`.

## Rollback

As migrations criam tabelas, colunas, funções, triggers, constraints e backfills. Não usar rollback manual improvisado migration por migration. Se a aplicação falhar depois de alterações persistidas, restaurar o snapshot anterior ou executar um plano de rollback previamente revisado. Não apagar dados SHARK manualmente em produção.

## Estado de liberação

A camada de banco e o contrato principal frontend/server estão preparados para aplicação controlada após snapshot e os dois preflights. O configurador usa apenas `burger_experience`/`meal_experience` explícitos para escolher a experiência semântica e consome a matriz server-only de preços efetivos por variação para atualizar os rótulos de acréscimo quando o cliente troca de tamanho. O preço final continua sendo recalculado e validado pelo motor canônico no servidor.

A promoção ao usuário final ainda depende da aplicação completa `40000–45500`, execução dos contratos pós-migração e smoke test funcional no Supabase interno do Lovable.
