# Atualização — pedido para agora, agendamento e carrinho persistente

## Tipo de pedido
No checkout, o cliente escolhe:
- **Para agora**
- **Quero agendar a entrega**

### Para agora
- Delivery entra imediatamente na fila.
- Previsão exibida ao cliente: **30 a 50 minutos**.
- O prazo operacional do pedido usa 50 minutos como limite prometido.
- Para retirada, é usada a antecedência de retirada configurada no Admin.

### Agendado
- Abre um campo de calendário nativo do celular/navegador.
- O cliente pode selecionar uma data entre hoje e **60 dias à frente**.
- Depois escolhe um horário disponível dentro do expediente cadastrado.
- Dias/horários sem expediente não podem ser concluídos.

## Carrinho persistente
A sacola é salva no `localStorage` do navegador com a chave `crisflow_cart_v1`.
- Atualizar a página não apaga os produtos.
- Fechar e abrir o site novamente mantém a sacola no mesmo navegador.
- Os itens são reconstruídos usando o catálogo atual, evitando manter preço antigo gravado no navegador.
- Estoque atual é respeitado ao restaurar a sacola.
- Depois de um pedido confirmado, a sacola persistida é apagada.

## Migração automática
Instalações antigas são migradas uma vez para:
- delivery mínimo: 30 min;
- delivery máximo: 50 min;
- agendamento: 60 dias.

Depois da migração, o Admin continua podendo editar os tempos normalmente.
