# Hotfix — tipos consolidados + cashback

Corrige regressão causada por uma versão antiga de `lib/types.ts` levada pela Etapa 11.

Inclui novamente tipos já usados pelo sistema: layouts, cores do cardápio, pausas de horário, impressora, IA, WhatsApp, complementos, recomendações e cashback.

Também:
- exporta `loyaltyEntitlementActive` para `cashback-db.ts`;
- restaura `optionConsumptions` no consumo de ingredientes;
- mantém `cashbackUsed` como compatibilidade para ticket/resumo/PDF.

Depois de aplicar, execute `npm run build`.
Não há migration nova neste hotfix.
