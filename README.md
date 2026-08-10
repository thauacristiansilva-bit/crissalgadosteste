# CrisFlow / Cris Salgados — plataforma de pedidos e operação

Sistema Next.js 16 que reúne **site do cliente, delivery, retirada, PDV, cozinha/KDS, estoque, clientes, caixa, marketing e administração** no mesmo servidor.

> Nome padrão nesta versão: **CrisFlow**. Em Admin → Configurações você pode trocar o nome do sistema, cores, logo e capa sem editar código.

## O que já está incluído

### Site do cliente
- Capa horizontal configurável (estilo banner/capa), logo, cores e textos editáveis pelo admin.
- Cardápio, categorias, busca, destaques, fotos, carrinho e cupom.
- Retirada ou delivery.
- Agendamento por dia e horário, respeitando o expediente.
- Delivery com Google Maps, GPS de alta precisão, pino arrastável e clique/toque para ajustar o ponto.
- CEP **opcional**: quando usado, ViaCEP preenche rua, bairro, cidade e estado; o cliente informa o número.
- Geocodificação/reversa pelo Google Maps para refinar o endereço quando o pino muda.
- Taxa calculada pela área de entrega cadastrada no mapa do admin.
- PIX, dinheiro, cartão, troco e observações.
- Login de cliente com CPF + PIN e opção “manter login salvo”. O CPF é usado como identificador; o PIN evita que qualquer pessoa que saiba o CPF consiga entrar.
- Dados do cliente logado preenchem pedidos futuros.
- Pontos de fidelidade.
- Depois do pedido: escolha entre abrir WhatsApp com o resumo pronto ou acompanhar pelo site.
- Página de acompanhamento por referência.
- Feedback de 1 a 5 com emojis após conclusão.
- Chatbot rápido para horário, entrega, pagamento e WhatsApp.

### Admin
- Dashboard com indicadores e alerta de caixa fechado.
- Pedidos em tempo real, filtros, pagamento, entregador e status.
- Impressão manual de ticket de cozinha e cliente.
- Download do ticket do cliente em PDF.
- Fila para impressão automática com agente Windows.
- PDV/balcão com o mesmo cardápio e estoque.
- Cozinha/KDS com relógio, ordem por horário prometido e prioridade verde/amarela/vermelha.
- Inventário: disponibilidade, estoque, estoque mínimo e alertas.
- Cardápio: criar/editar produtos, foto por arquivo local, destaque, disponibilidade e estoque.
- Categorias.
- Clientes: busca, segmentação automática, status, pontos, WhatsApp, novo cliente, importação CSV e exportação CSV.
- Vendas e caixa: abertura/fechamento, lançamentos financeiros, histórico e CSV.
- Marketing: cupons, fidelidade, segmentos, mensagens de WhatsApp, links do Google e rastreamento.
- Avaliações internas e atalho para o link oficial de avaliação no Google.
- QR Codes para página principal e cardápio.
- Equipe e funções (cadastro de colaboradores e papéis operacionais).
- Configurações de pagamentos, negócio, horários, login do cliente, impressão, Google, fiscal e totem.
- Cadastro de entregadores.
- Áreas/taxas de delivery no Google Maps.
- Totem/autoatendimento em `/totem` quando habilitado.

## Limites de integrações externas desta versão

Algumas funções dependem de credenciais/serviços de terceiros e por isso ficam preparadas, mas não podem ser “inventadas” dentro do ZIP:

- **Avaliação Google:** o sistema registra a nota interna e abre o link configurado para o cliente publicar a avaliação no Google. Ele não publica a nota no Google sem a ação do cliente.
- **WhatsApp em massa:** abre conversas com mensagem pronta. Envio servidor-a-servidor em massa exige sua conta/API oficial do WhatsApp Business e regras próprias da Meta.
- **NF-e/NFC-e:** há campo para provedor fiscal e atalho por pedido. Emissão fiscal real exige escolher um provedor, certificado/credenciais e dados tributários da empresa.
- **Equipe:** o módulo cadastra funções e permissões-base. Nesta entrega, o login do painel continua sendo o login administrativo principal; autenticação individual de cada funcionário pode ser ligada depois sem mudar os cadastros.

## Configuração local

Abra a pasta que contém `package.json` e rode:

```powershell
npm install
npm run dev
```

- Cliente: `http://localhost:3000`
- Admin: `http://localhost:3000/admin`
- Totem: `http://localhost:3000/totem`

### `.env.local`

Crie `.env.local` na raiz:

```env
ADMIN_EMAIL=admin@crissalgados.com
ADMIN_PASSWORD=troque-por-uma-senha-forte
SESSION_SECRET=gere-uma-chave-longa-e-aleatoria
CLIENT_SESSION_SECRET=gere-outra-chave-longa-e-aleatoria

NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=sua-chave-restrita-do-google
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=seu-map-id

PRINT_AGENT_TOKEN=gere-um-token-forte-para-a-impressora
```

Nunca envie `.env.local` para o GitHub.

## Google Maps

No Google Cloud, use seu projeto do Maps e habilite as APIs usadas pelo sistema:

- Maps JavaScript API
- Geocoding API

Restrinja a chave aos seus sites, por exemplo:

```text
http://localhost:3000/*
http://127.0.0.1:3000/*
https://SEU-DOMINIO.up.railway.app/*
```

O mapa do cliente e o mapa de áreas do admin usam a mesma chave. Um Map ID próprio é recomendado para os marcadores avançados; durante testes o projeto possui fallback de demonstração.

## Dados e privacidade

- Arquivo operacional local: `data/store.json` (ignorado pelo Git).
- Seed inicial versionado: `data/store.seed.json`.
- O CPF completo **não é salvo em texto puro**: a conta guarda hash do CPF e somente os 4 últimos dígitos para identificação visual.
- O PIN é salvo com hash derivado por scrypt.
- Antes de uso comercial, publique política de privacidade/LGPD, termos e canais para correção/exclusão de dados.

## Railway — persistência recomendada

Para não perder pedidos/fotos em redeploy, crie um **Volume** e monte em:

```text
/data
```

No Railway → Variables configure:

```env
DATA_FILE=/data/store.json
UPLOAD_DIR=/data/uploads
```

Na primeira inicialização em um volume vazio, o servidor copia o conteúdo de `data/store.seed.json` para o arquivo operacional.

Também configure no Railway:

```env
ADMIN_EMAIL=...
ADMIN_PASSWORD=...
SESSION_SECRET=...
CLIENT_SESSION_SECRET=...
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=...
PRINT_AGENT_TOKEN=...
```

Depois faça novo deploy.

> Com armazenamento JSON, mantenha **1 réplica** do serviço. Para crescimento real, múltiplas unidades/alto volume ou integrações complexas, migre a persistência para PostgreSQL/Supabase.

## Impressão automática

O navegador não é usado para impressão silenciosa. O ZIP inclui um agente Windows que consulta pedidos novos e imprime na impressora configurada:

```text
INICIAR-IMPRESSAO-AUTOMATICA.ps1
CONFIGURAR-IMPRESSAO-AUTOMATICA.md
```

Configure o mesmo `PRINT_AGENT_TOKEN` no Railway e no agente. Deixe o computador da loja e a impressora ligados durante o atendimento.

## Importação de clientes

Use `IMPORTAR-CLIENTES-EXEMPLO.csv` como modelo. Colunas obrigatórias:

```text
Nome;Telefone;CPF;PIN;Email
```

O PIN precisa ter de 4 a 6 números.

## Atualizar o sistema que já está no GitHub/Railway

Leia `ATUALIZAR-NO-RAILWAY.md` antes de copiar esta versão sobre o projeto atual.

## Sugestões de nomes

- **CrisFlow** — melhor para manter a marca Cris e transmitir operação integrada.
- **PedidoCris** — mais simples e direto para o cliente final.
- **CrisHub** — bom se o produto crescer para vários módulos.
- **SaborFlow** — bom se futuramente quiser vender o sistema para outros negócios.
- **PedidoFlow** — nome genérico para produto SaaS.
- **SalgadoHub** — muito ligado ao nicho atual.
- **CrisPOS** — forte para PDV, mas reduz a percepção do delivery/site.
- **ComandaFlow** — bom para restaurantes, mesas e atendimento presencial.

Antes de adotar um nome comercial fora da Cris Salgados, confira disponibilidade de domínio, redes sociais e registro de marca.

## Mapa e entrega automatizados

O sistema usa Google Maps Platform para localizar a empresa e os clientes sem cadastro operacional de bairros. O Admin pode escolher preço fixo, entrega grátis, distância percorrida, faixas por distância ou áreas personalizadas desenhadas no mapa. Consulte `MAPA-E-ENTREGA-AUTOMATIZADOS.md`.
