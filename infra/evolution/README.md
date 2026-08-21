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
- Chave global da Evolution é gerada localmente no ambiente de QA e nunca é commitada.
- O Comandiva permanece fail-closed enquanto a URL e a chave não estiverem configuradas.

## Homologação sem cartão — GitHub Codespaces

O caminho padrão de QA é GitHub Codespaces. Ele evita exigir uma contratação de infraestrutura antes da homologação do produto.

A configuração em `.devcontainer/devcontainer.json` instala Docker dentro do Codespace, encaminha a porta 8080 e inicia automaticamente `infra/evolution/codespace/start.sh`. Esse script:

- gera uma API key aleatória e uma senha de PostgreSQL fora do repositório, em `$HOME/.comandiva-evolution-qa`;
- sobe PostgreSQL 15 e Evolution API v2.3.7 com Docker Compose;
- persiste o banco em volume Docker do Codespace;
- espera `/server/ok` responder antes de considerar o ambiente pronto;
- calcula a URL pública prevista do encaminhamento da porta 8080.

### Ação manual no Codespace

1. No GitHub, abra o repositório `leozera034/project-spark`.
2. Use **Code → Codespaces → Create codespace on main**.
3. Aguarde o terminal informar que `/server/ok` respondeu.
4. Abra a aba **PORTS** do Codespace.
5. Na porta `8080`, altere **Port Visibility** para **Public**.
6. Execute `bash infra/evolution/codespace/show-config.sh`.
7. Abra a URL exibida com `/server/ok` e confirme a resposta.
8. Copie `EVOLUTION_API_BASE_URL` e `EVOLUTION_API_KEY` diretamente para os Edge Function secrets do Supabase. Não envie a chave por chat.

A porta pública do Codespaces deve ser usada somente durante QA. Ao parar ou recriar o Codespace, confirme novamente a visibilidade da porta e a URL antes de testar.

## Secrets no Supabase

No projeto `pediu-aqui`, adicione os mesmos dois secrets às Edge Functions:

- `EVOLUTION_API_BASE_URL` — URL pública HTTPS da Evolution, sem barra final.
- `EVOLUTION_API_KEY` — chave mostrada apenas dentro do Codespace pelo helper `show-config.sh`.

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
8. Reinicie a stack no mesmo Codespace e confirme que a sessão é recuperada pelo PostgreSQL.
9. Teste desconectar e conectar novamente.

## Produção

Codespaces é somente ambiente de homologação e desenvolvimento. Não deve ser usado como infraestrutura permanente do WhatsApp dos lojistas.

Depois de validar o fluxo com um número real, migre a mesma stack para um host 24/7 com memória e PostgreSQL persistentes. Isso continua sendo **um custo de infraestrutura compartilhada do Comandiva**, não uma mensalidade de API por lojista.

O arquivo `render.yaml` permanece apenas como referência de infraestrutura e não é o caminho padrão de QA enquanto a conta do Render exigir billing para criar os recursos.

Não declare o WhatsApp automático como homologado antes de o checklist acima passar com um número real de teste.
