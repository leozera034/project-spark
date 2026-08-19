# Evolution API QA — Comandiva

Este diretório prepara uma instância de QA da Evolution API para o Comandiva sem custo inicial.

## Arquitetura de QA

- Evolution API v2.3.7 em um Render Free Web Service.
- Render Postgres Free dedicado ao QA da Evolution.
- Redis desabilitado.
- Estado da instância do WhatsApp salvo no PostgreSQL (`DATABASE_SAVE_DATA_INSTANCE=true`).
- Dados de mensagens, contatos, chats e histórico desabilitados para reduzir consumo.
- Chave global da Evolution gerada automaticamente pelo Render.
- O Comandiva continua fail-closed até a URL e a chave da Evolution serem cadastradas como secrets no Supabase e a instância ser validada.

## Deploy no Render

1. Crie uma conta gratuita em https://dashboard.render.com/.
2. Crie um novo Blueprint apontando para o repositório `leozera034/project-spark`.
3. Use o caminho de Blueprint `infra/evolution/render.yaml`.
4. Quando o Render pedir `SERVER_URL`, informe a URL HTTPS pública que ele reservar para o serviço `comandiva-evolution-qa`.
5. Confirme que tanto o Web Service quanto o Postgres estão no plano `Free` antes de aplicar.
6. Aguarde `/server/ok` responder com sucesso.
7. No serviço, copie o valor gerado de `AUTHENTICATION_API_KEY`; não coloque essa chave no GitHub.

## Conectar ao Supabase

No projeto `pediu-aqui`, salve como Edge Function secrets:

- `EVOLUTION_API_BASE_URL` = URL HTTPS pública do Render, sem barra final.
- `EVOLUTION_API_KEY` = `AUTHENTICATION_API_KEY` gerada pelo Render.

Não envie essas chaves pelo chat e não as coloque no frontend.

## Limitações do QA gratuito

Render Free Web Services podem dormir após inatividade e o Postgres Free do Render expira depois do período gratuito informado pelo próprio Render. Esta configuração é destinada somente a homologação e primeiros testes, não a operação 24/7 de produção.
