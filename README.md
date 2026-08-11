# Pediu Aqui — Project Spark

SaaS multi-loja para cardápio digital, pedidos online e operação de entregas próprias de cada estabelecimento. `Project Spark` é o nome técnico/histórico do repositório; o produto é **Pediu Aqui**.

## Superfícies

- Cliente público: `/loja/{slug}` — sem conta.
- Loja: `/app/loja` — equipe autenticada e isolada por loja.
- Entregador: `/app/entregador` — entregador próprio da loja.
- Administração SaaS: `/admin` — administrador da plataforma.

## Stack

- React 19 + TanStack Start/Router/Query
- TypeScript
- Tailwind CSS
- Supabase (Auth, PostgreSQL, RLS, RPCs)
- Lovable como ambiente de edição/preview

Projeto Lovable vinculado: `ac064684-e750-45e3-8b8f-80f4dd7f5eb7`.

## Desenvolvimento

```sh
npm install
cp .env.example .env
npm run dev
```

Nunca versione `.env` ou credenciais reais.

## Gates de qualidade

```sh
npm run test:hygiene
npm run lint:ci
npm run typecheck
npm run build
```

O workflow `.github/workflows/quality-gate.yml` executa esses gates em PRs e pushes. Contratos SQL ficam em `supabase/tests/` e podem ser executados no CI quando `SPARK_DATABASE_URL` estiver configurada como secret do repositório.

## Banco

Mudanças de schema, segurança e RPCs devem ser reproduzíveis por migrations em `supabase/migrations/`. O isolamento de loja é regra de segurança, não convenção de UI.

## Android

O APK planejado é exclusivo do entregador. O web app atual usa TanStack Start com SSR/Nitro, portanto o shell Capacitor não deve ser criado apontando diretamente para o build SSR. A decisão e os gates estão documentados em `docs/NATIVE_ANDROID_READINESS.md`.

## Documentação de referência

- `docs/PROJECT_MASTER_PLAN.md` — escopo e regras de negócio.
- `docs/AUTHORIZATION_MATRIX.md` — autorização.
- `docs/DATABASE_ARCHITECTURE.md` — arquitetura de dados.
- `docs/BRAND_GUIDELINES.md` — identidade visual.
- `docs/NATIVE_ANDROID_READINESS.md` — estratégia Android/FCM/localização.
