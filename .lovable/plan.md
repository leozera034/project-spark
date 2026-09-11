# Corrigir configuração pública de autenticação em produção

## Implementação
- Criar um bootstrap público e validado no servidor usando somente a URL do projeto esperado e uma chave publishable/anon.
- Serializar essa configuração no documento SSR antes dos scripts da aplicação, sem incluir chaves secretas.
- Fazer o cliente do navegador consumir primeiro o bootstrap síncrono, mantendo os fallbacks atuais e a rejeição de outro projeto.

## Validação
- Executar `npm run lint:ci` e `npm run check`.
- Validar `/` e `/entrar/loja` em 390×844 e 1280×1800, confirmando autenticação inicializada e ausência da tela global de erro.
- Não alterar banco, migrations, regras comerciais ou publicar.
