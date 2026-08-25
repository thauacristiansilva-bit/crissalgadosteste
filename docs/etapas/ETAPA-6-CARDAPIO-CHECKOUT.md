# Etapa 6 — Cardápio e checkout

Objetivo: reduzir atrito no pedido manual e deixar a jornada pronta para receber pedidos interpretados por IA nas próximas etapas, sem duplicar a regra de preços, carrinho ou confirmação.

## Alterações

- Checkout dividido em 3 etapas: Recebimento, Pagamento e Revisão.
- A confirmação final mostra os itens, adicionais, forma de recebimento, endereço, pagamento, desconto, entrega e total.
- Nome e WhatsApp ganharam rótulos e validação mais clara; o telefone é formatado enquanto o cliente digita.
- Login da conta do cliente continua opcional e serve apenas para preencher dados automaticamente.
- Cupom e observações viraram áreas opcionais recolhidas para reduzir poluição visual.
- Endereço de delivery mantém Google Maps, CEP, geolocalização e cálculo de taxa, porém com textos mais curtos.
- Ao reabrir o checkout de delivery, a cotação é recalculada quando já existe uma localização conhecida, evitando reaproveitar uma taxa antiga após alterar o carrinho.
- Categorias do cardápio mostram a quantidade de produtos disponíveis.
- Busca sem resultado agora possui estado vazio e botão para limpar filtros.
- Produto pode ser aberto para ver detalhes mesmo quando não possui adicionais.
- Modal do produto exibe imagem, descrição e deixa mais claro quando existem escolhas obrigatórias/adicionais.
- O carrinho atual continua sendo a fonte do pedido. A futura IA deverá preencher esse mesmo fluxo e nunca criar preço ou pedido diretamente.

## Banco / dependências

- Nenhuma migration.
- Nenhuma tabela nova.
- Nenhuma dependência npm nova.
- Nenhuma variável nova no Railway.

## Testes no Railway

Após o deploy:

1. Abrir `/loja/SEU-SLUG/cardapio` e testar busca e categorias.
2. Abrir um produto simples pelos detalhes e adicioná-lo.
3. Abrir um produto com adicionais e validar escolhas obrigatórias.
4. Abrir o carrinho e avançar para o checkout.
5. Testar retirada para agora.
6. Testar pedido agendado.
7. Testar delivery, CEP/Google Maps e cálculo da taxa.
8. Testar PIX, dinheiro e cartão, conforme habilitados.
9. Testar cupom e observações.
10. Conferir a etapa final de revisão e confirmar o pedido.
