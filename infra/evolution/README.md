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
2. Clique em **New → Blueprint** e conecte o repositório `leozera034/project-spark`.
3. Use o caminho de Blueprint `infra/evolution/render.yaml`.
4. Antes de aplicar, confirme que `comandiva-evolution-qa` e `comandiva-evolution-db` aparecem no plano **Free**.
5. Aplique o Blueprint e aguarde o Web Service ficar disponível.
6. Abra a URL HTTPS pública gerada pelo Render e confirme que `/server/ok` responde.
7. Em **Environment** do serviço, adicione `SERVER_URL` com a própria URL HTTPS pública do serviço, sem barra final, e faça um redeploy.
8. Copie o valor gerado de `AUTHENTICATION_API_KEY`; não coloque essa chave no GitHub nem no frontend.

## Conectar ao Supabase

No projeto `pediu-aqui`, salve como Edge Function secrets:

- `EVOLUTION_API_BASE_URL` = URL HTTPS pública do Render, sem barra final.
- `EVOLUTION_API_KEY` = `AUTHENTICATION_API_KEY` gerada pelo Render.

Não envie essas chaves pelo chat.

## Limitações do QA gratuito

Render Free Web Services podem dormir após inatividade. O Postgres Free do Render é temporário e não deve ser tratado como banco de produção. Esta configuração é destinada somente a homologação e primeiros testes, não a operação 24/7.
