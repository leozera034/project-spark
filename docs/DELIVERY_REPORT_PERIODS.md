# Definição de Períodos de Relatório

## Timezone
Todos os períodos são calculados no servidor usando o `timezone` cadastrado na tabela `public.stores`.

## Períodos Canônicos
- **Hoje:** [meia-noite local, início do dia seguinte local).
- **Semana:** [segunda-feira local, próxima segunda-feira local).
- **Mês:** [primeiro dia do mês local, primeiro dia do próximo mês local).
- **Personalizado:** Interpretado no timezone da loja, limite máximo de 366 dias.
