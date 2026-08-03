# Arquitetura de Notificações Web (Fase 23)

## Fluxo de Alertas
1. **Trigger:** Evento Realtime (minimal payload) ou Timer (sem resposta).
2. **Sync:** Invalidação de cache TanStack Query.
3. **Fetch:** Chamada RPC para projeção de alertas (sanitizada).
4. **Eval:** Comparação de `version` e `status` para determinar se o alerta ainda é válido.
5. **UI:** Destaque visual (CSS border/glow).
6. **Audio:** AudioManager avalia se deve tocar baseado em:
   - Interação do usuário (Unlock Context).
   - Liderança de aba (Cross-tab).
   - Intervalo mínimo (Deduplicação/Aggregação).

## Proibição de PII
- Títulos de página: `(1) Pedido Novo | Pediu Aqui`.
- BroadcastChannel: `{ type: 'audio_trigger', alertType: 'new_order', timestamp: 123 }`.
- Logs: Apenas metadata e IDs técnicos.
