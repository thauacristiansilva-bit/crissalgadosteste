# Etapa 5 — Presença digital da empresa

## Objetivo

Separar a experiência pública da empresa em três destinos claros:

- `/` ou `/loja/{slug}`: landing page / apresentação da empresa.
- `/cardapio` ou `/loja/{slug}/cardapio`: consulta de produtos.
- `/pedir` ou `/loja/{slug}/pedir`: fluxo direto para montar o pedido.

## O que foi adicionado

- Landing page pública com capa, logo, mensagem de boas-vindas e botões de ação.
- Seção Sobre nós configurável pelo painel.
- Galeria de até 8 fotos usando o upload de imagens já existente.
- Produtos em destaque na landing page.
- Endereço, horários e mapa.
- Redes sociais e WhatsApp.
- Links separados para site, cardápio e pedido direto.
- Links específicos para Instagram e WhatsApp com parâmetro `origem` preparado para métricas futuras.
- Navegação entre apresentação, cardápio e pedido.
- Retorno do rastreamento de pedido para a rota de cardápio correta.

## Banco de dados

Não existe migration nesta etapa.

Os campos adicionais são armazenados no JSONB de `sf_organization_settings`:

- `aboutTitle`
- `aboutText`
- `galleryTitle`
- `galleryImages`

Empresas antigas continuam compatíveis porque os campos são opcionais.

## Dependências

Nenhuma dependência npm nova.

## Observação sobre imagens

A galeria usa o mesmo armazenamento atual de logo/capa. Enquanto o projeto continuar usando `UPLOAD_DIR`/Railway Volume, mantenha atenção ao consumo de armazenamento. A migração para storage externo/CDN continua recomendada antes de escalar horizontalmente.

## Teste no Railway

Depois do deploy, validar:

1. `/loja/{slug}` abre a landing page.
2. `/loja/{slug}/cardapio` abre o cardápio.
3. `/loja/{slug}/pedir` abre o fluxo de pedido.
4. Em domínio próprio, `/`, `/cardapio` e `/pedir` resolvem a mesma empresa.
5. Configurações da loja permitem salvar Sobre nós e galeria.
6. Links e QR Codes mostram os novos destinos.
7. Um pedido finalizado continua abrindo o rastreamento normalmente.
