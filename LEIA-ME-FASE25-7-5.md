# SaborFlow — Fase 25.7.5: pedidos agendados fora do expediente

## Objetivo

Quando a loja estiver **fora do horário de funcionamento**, o cliente continua podendo montar o carrinho e finalizar o pedido normalmente. A diferença é que o pedido passa obrigatoriamente para **Agendado** e deve usar uma data/horário válido do expediente.

## Regra nova

- Dentro do expediente: cliente pode escolher **Para agora** ou **Agendado**.
- Fora do expediente, com `acceptingOrders=true`: carrinho e checkout continuam liberados, mas somente **Agendado** fica disponível.
- Fora do expediente, o cliente vê o aviso de que o pedido será recebido em um horário disponível do expediente.
- O backend também bloqueia tentativa de pedido `now` fora do expediente, então a regra não depende apenas da interface.
- Um agendamento continua sendo validado contra os horários configurados da empresa, antecedência mínima e limite de dias.
- Se o administrador desligar **Operação liberada** (`acceptingOrders=false`), pedidos online continuam totalmente pausados, inclusive agendados.

## Ajustes de consistência

A vitrine agora usa para os horários disponíveis:

- `settings.deliveryMinMinutes` para antecedência de delivery agendado;
- `settings.pickupLeadMinutes` para retirada;
- `settings.schedulingDaysAhead`, limitado ao máximo técnico de 60 dias.

Isso evita mostrar ao cliente um horário que o backend recusaria depois.

## Arquivos funcionais

- `components/store/storefront.tsx`
- `lib/tenant-checkout.ts`
- `app/api/admin/after-hours-scheduling-health/route.ts`

## Migration

**Não existe migration na Fase 25.7.5.**

## Build no terminal PowerShell do VS Code

Extraia o ZIP na raiz do projeto e rode:

```powershell
git restore next-env.d.ts
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
```

Se passar:

```powershell
git status --short
```

Stage somente dos arquivos funcionais:

```powershell
git add -- `
"components/store/storefront.tsx" `
"lib/tenant-checkout.ts" `
"app/api/admin/after-hours-scheduling-health/route.ts"
```

Confira:

```powershell
git diff --cached --check
git --no-pager diff --cached --name-only
```

Commit e push:

```powershell
git commit -m "Permitir pedidos agendados fora do expediente"
git push origin main
```

## Validação depois do Railway SUCCESS

Abra autenticado como administrador:

`https://crissalgadosteste-production.up.railway.app/api/admin/after-hours-scheduling-health`

Esperado:

```json
{
  "ok": true,
  "phase": "25.7.5-after-hours-scheduled-orders",
  "capabilities": {
    "publicCheckoutRemainsAvailableOutsideBusinessHours": true,
    "afterHoursCheckoutForcesScheduledTiming": true,
    "immediateOrdersBlockedOutsideBusinessHours": true,
    "scheduledOrdersValidatedAgainstBusinessHours": true,
    "manualAcceptingOrdersSwitchStillBlocksAllOnlineOrders": true,
    "postgresqlTenantAwareCheckoutPreserved": true
  }
}
```

## Teste funcional fora do expediente

Com `Operação liberada` ativa e a hora atual fora do horário configurado:

1. Abra a loja pública.
2. O status deve mostrar **Fechado · aceitando agendamentos**.
3. Adicione produtos ao carrinho.
4. O botão deve ser **Agendar pedido**, e não ficar bloqueado.
5. No checkout, `Para agora` não deve estar disponível.
6. Escolha uma data e um horário dentro do expediente.
7. Finalize o pedido.
8. No Admin/Cozinha o pedido deve aparecer com identificação **Agendado** e com `requestedFor` correspondente ao horário escolhido.

Também teste durante o expediente para confirmar que **Para agora** continua disponível.
