# Modo Cozinha — Tempo real (Fase 17)

A cozinha reutiliza a infraestrutura da Fase 16, sem canal novo e sem payload novo.

## Envelope do evento

```
store_id
order_id
event_type
status_version
created_at
```

Nada além disso trafega: nem itens, nem observações, nem cliente, telefone, endereço,
pagamento, valores, token ou nota interna.

## Assinatura

Canal `kitchen-orders:{store_id}`, filtro `store_id=eq.{store_id}` no servidor e nova
conferência do `store_id` no callback antes de qualquer consulta. Evento de outra loja é
descartado sem gerar requisição.

## Reação

O evento não é usado como dado: ele apenas invalida a chave `["kitchen","orders"]`, e a fila é
recarregada pela RPC autorizada. Evento repetido não duplica nada, e evento antigo não reverte
estado, porque o estado sempre vem da projeção mais recente.

## Fallback

Uma única estratégia centralizada em `useKitchenQueue`:

| Situação | Intervalo |
| --- | --- |
| Realtime assinado | 60 s (rede de segurança) |
| Realtime indisponível | 20 s |
| Offline | nenhum disparo |

Somam-se a isso a atualização ao voltar para a aba, ao reconectar e o botão **Atualizar**.
Não existem timers paralelos nem polling agressivo simultâneo ao canal saudável.

## Desmontagem

Sair da rota, trocar de loja ou perder a sessão remove o canal e interrompe o fallback.
