# Evolution API — infraestrutura WhatsApp do Comandiva

Este diretório prepara o motor self-hosted usado pelo Comandiva para conectar o WhatsApp de cada loja sem exigir conta, painel ou credencial de um SaaS terceiro.

## Fluxo implementado

1. A contratação do módulo é confirmada pelo billing do Comandiva.
2. O lojista abre a Central WhatsApp dentro do próprio Comandiva.
3. `comandiva-evolution-onboarding` cria ou reutiliza uma instância dedicada para a loja.
4. O QR Code retornado pela Evolution é exibido dentro do Comandiva.
5. A tela consulta o estado da sessão até o WhatsApp ficar conectado.
6. O número e a saúde da sessão ficam associados à loja em `private.integration_provider_accounts`.
7. Mensagens manuais e automações passam pelo backend; a API key da Evolution nunca entra no navegador.
8. O worker `comandiva-whatsapp-worker` reutiliza a mesma infraestrutura para os envios automáticos.

O nome da instância é derivado internamente do `store_id`; o lojista nunca precisa conhecer esse identificador.

## Arquitetura de homologação

- Evolution API v2.3.7.
- Um único serviço atende múltiplas lojas; não existe mensalidade de provider por instância/lojista.
- PostgreSQL dedicado ao estado da Evolution.
- Redis desabilitado na configuração inicial.
- Estado da sessão do WhatsApp salvo no PostgreSQL (`DATABASE_SAVE_DATA_INSTANCE=true`).
- Dados de mensagens, contatos, chats e histórico desabilitados para reduzir armazenamento; o histórico comercial relevante continua no Supabase do Comandiva.
- Chave global da Evolution gerada pelo host e armazenada apenas em secrets de backend.
- O Comandiva permanece fail-closed enquanto a URL e a chave não estiverem configuradas.

## Deploy inicial no Render

O `render.yaml` deste diretório é um Blueprint de homologação. Ele permite validar o fluxo ponta a ponta antes de contratar infraestrutura 24/7.

1. No Render, escolha **New → Blueprint** e conecte `leozera034/project-spark`.
2. Informe `infra/evolution/render.yaml` como Blueprint.
3. Confirme os recursos `comandiva-evolution-qa` e `comandiva-evolution-db`.
4. Aplique o Blueprint e aguarde o Web Service ficar disponível.
5. Abra a URL HTTPS pública e confirme que `/server/ok` responde.
6. Em **Environment**, defina `SERVER_URL` com a própria URL HTTPS pública, sem barra final, e faça um redeploy.
7. Mantenha `AUTHENTICATION_API_KEY` somente no backend. Não salve essa chave no Git, frontend, screenshot, issue ou chat.

## Secrets no Supabase

No projeto `pediu-aqui`, adicione os mesmos dois secrets às Edge Functions:

- `EVOLUTION_API_BASE_URL` — URL HTTPS pública da Evolution, sem barra final.
- `EVOLUTION_API_KEY` — valor de `AUTHENTICATION_API_KEY` do serviço Evolution.

Esses secrets são consumidos por:

- `comandiva-evolution-onboarding` — criação de instância, QR, status, desconexão e envio manual.
- `comandiva-whatsapp-worker` — envios automáticos já existentes.

Não envie os valores desses secrets por chat.

## Homologação mínima depois do deploy

Antes de liberar comercialmente:

1. Ative o módulo em uma loja de teste ou sandbox de billing.
2. Gere o QR pela Central WhatsApp do Comandiva.
3. Escaneie com um número dedicado a teste.
4. Confirme que a tela muda para **Conectado** sem refresh manual.
5. Envie uma mensagem manual para um telefone de teste.
6. Confirme o registro no histórico do Comandiva.
7. Dispare uma automação transacional e confirme o worker.
8. Reinicie o serviço Evolution e confirme que a sessão é recuperada pelo PostgreSQL.
9. Teste desconectar e conectar novamente.

## Produção

O Blueprint atual usa recursos gratuitos para homologação. Render Free pode dormir por inatividade e o Postgres gratuito não deve ser considerado armazenamento de produção.

Para produção, mantenha a mesma arquitetura e migre o Web Service e o PostgreSQL para recursos persistentes 24/7. Isso continua sendo **um custo de infraestrutura compartilhada do Comandiva**, não uma mensalidade de API por lojista.

Não declare o WhatsApp automático como homologado antes de o checklist acima passar com um número real de teste.
