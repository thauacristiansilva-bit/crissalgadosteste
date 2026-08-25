# SaborFlow — Etapa 6.1

## Objetivo

Corrigir o fluxo de aceite e acompanhamento dos pedidos antes da implantação da IA/WhatsApp.

## O que mudou

### Aceite automático ou manual

Em Configurações > Configurações de pedidos agora existe a opção:

- **Aceitar automaticamente**: novos pedidos online entram com status `accepted`.
- **Revisar e aceitar um por um**: novos pedidos online entram com status `pending` e aguardam a equipe.

O PDV continua criando pedidos aceitos, pois a venda já foi criada por um operador autenticado.

Na tela Pedidos, quando houver pedidos pendentes, também aparece **Aceitar pendentes (N)** para confirmar todos de uma vez.

### Acompanhamento persistente

A loja passa a manter uma referência do último pedido por empresa no navegador. Enquanto houver um pedido ativo, aparece **Meu pedido** e um aviso de pedido em andamento.

O acompanhamento continua consultando o status do pedido periodicamente e mostra a etapa `Recebido` antes de `Aceito` quando a loja utiliza confirmação manual.

### WhatsApp sem remover o pedido do fluxo

O SaborFlow deixa de substituir a página pelo WhatsApp após a finalização.

- `site`: vai direto para o acompanhamento.
- `whatsapp`: vai para o acompanhamento e posiciona o cliente na área de WhatsApp.
- `ask`: mostra as duas opções; o WhatsApp abre em nova guia.

O pedido permanece no PostgreSQL e continua disponível no Admin, Cozinha e acompanhamento público.

### Histórico da conta do cliente

Clientes autenticados por CPF + PIN passam a ver os últimos pedidos daquela empresa em **Minha conta > Meus pedidos**, com status, data, total e link para acompanhamento.

## Banco de dados

Nenhuma migration é necessária. A nova configuração `orderAcceptanceMode` é armazenada no JSONB já existente de configurações da organização.

Empresas existentes assumem automaticamente `automatic` até que o administrador altere para `manual`.

## Railway

Não há nova dependência npm e não há nova variável de ambiente.
