# Etapa 11 — Campanhas + Cashback no checkout

Esta etapa junta duas evoluções:

1. Campanhas da Central de Comunicação passam a segmentar clientes da loja (novos, repetidos, frequentes, elite, ativos, adormecidos, inativos e cadastrados sem pedido).
2. Cashback passa a aparecer e funcionar no checkout do cliente, separado de cupom.

## Cashback

- Conta do cliente continua vinculada ao CPF/PIN.
- 100 pontos internos = R$ 1,00. O cliente vê apenas valor em reais.
- O saldo aparece no checkout mesmo quando está zerado.
- O cliente escolhe se quer usar o cashback.
- Cupom é aplicado primeiro; cashback é aplicado depois sobre o restante dos produtos.
- Taxa de entrega não pode ser paga com cashback nesta etapa.
- O servidor calcula o desconto com base no saldo real; não confia em valor enviado pelo navegador.
- O débito e o pedido ficam na mesma transação.
- Pedido cancelado devolve o cashback utilizado.
- Cashback novo só é creditado quando o pedido passa para concluído.
- O novo cashback é calculado sobre produtos após cupom e cashback usado, sem taxa de entrega.

Exemplo: configuração 5 significa 5% de cashback.

## Campanhas

A Central de Comunicação agora usa públicos ligados ao comportamento dos clientes:
- Todos com consentimento
- Novos clientes
- Compraram novamente
- Frequentes
- Melhores clientes
- Ativos
- Sem comprar há algum tempo
- Inativos
- Cadastrados sem pedido

O cupom continua opcional e separado do cashback.

O disparo externo continua condicionado à conexão/configuração do canal (e-mail/WhatsApp/SMS). Esta etapa não força envio automático.

## Migration

Depois do deploy, execute:

```bash
node scripts/migrate-multiempresa.mjs
```

Migration nova:

`049_campaigns_cashback_checkout.sql`
