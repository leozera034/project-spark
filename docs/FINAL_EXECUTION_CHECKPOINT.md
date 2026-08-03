# Checkpoint de Execução Final — Pediu Aqui

Documento de controle da execução contínua (Central Demo do Preview + Fases 24 a 32).
Status permitidos: `not_started`, `in_progress`, `completed`, `completed_with_external_gate`,
`blocked`, `failed`.

## Bloco Zero — Central Demo exclusiva do Preview

| campo | valor |
| --- | --- |
| bloco | Central Demo do Preview |
| status | completed |
| iniciado_em | 2026-08-03 |
| concluido_em | 2026-08-03 |
| arquivos | `src/lib/qa-demo.server.ts`, `src/lib/qa-demo.functions.ts`, `src/routes/preview/demo.tsx`, `docs/PREVIEW_DEMO_CENTER.md` |
| migrations | nenhuma (usa contas Auth já provisionadas) |
| testes | verificação manual no Preview (rota, gate de ambiente, unlock e troca de perfil) |
| bloqueios | nenhum |
| próximo_passo | Fase 24 — Capacitor Android (bloqueada por gate externo) |

Decisões aplicadas:
- rota canônica `/preview/demo` (nenhum namespace `/admin/qa` foi criado);
- gate `APP_ENV ∈ { preview, development, staging }` com negação por ausência ou valor desconhecido;
- chave `QA_PREVIEW_ACCESS_KEY` apenas como secret, comparada em tempo constante, com rate limit;
- capacidade QA de 30 minutos em cookie HttpOnly cifrado (`QA_SESSION_SECRET`), vinculada ao ambiente;
- login demo por magic link server-side + `verifyOtp` no navegador: sessão Auth real, sem senha,
  sem service role e sem JWT administrativo devolvidos ao cliente;
- troca de perfil executa teardown completo (canais Realtime, sessão, cache TanStack Query,
  storage local sensível, título da página) antes de autenticar a nova conta.

## Fases 24 a 32

| bloco | status | bloqueio / observação |
| --- | --- | --- |
| Fase 24 — Capacitor Android | blocked | requer toolchain Android/Gradle e assinatura de APK, indisponíveis neste ambiente de execução; nenhum build pode ser comprovado. |
| Fase 25 — Firebase Cloud Messaging | blocked | requer conta Firebase real, `google-services.json` e credenciais de servidor não fornecidas. |
| Fase 26 — Localização e abertura de rota | not_started | depende do shell nativo da Fase 24 para permissões de localização. |
| Fase 27 — Endurecimento de segurança | not_started | próximo bloco executável sem gate externo. |
| Fase 28 — Observabilidade | not_started | executável sem gate externo. |
| Fase 29 — Testes automatizados | not_started | executável sem gate externo. |
| Fase 30 — QA visual e operacional | not_started | depende da Fase 29. |
| Fase 31 — Deploy e distribuição | blocked | requer domínio, secrets de CI e certificado de assinatura. |
| Fase 32 — Documentação final | not_started | fecha após 27 a 30. |

Nenhum resultado de build, instalação em aparelho, publicação ou evidência de teste externo foi
declarado como concluído.
