# Cris Salgados — Sistema completo

Projeto Next.js com site de pedidos, cozinha e painel administrativo no mesmo servidor.

## Novidades desta versão

### Agendamento e horário de funcionamento
- Pedidos enviados durante o expediente entram como **aceitos automaticamente**.
- O cliente escolhe **dia e horário de recebimento** para retirada ou delivery.
- O servidor valida o horário escolhido contra a agenda semanal cadastrada no admin.
- Delivery usa janela operacional configurável (por padrão **30 a 50 minutos**).
- Retirada possui antecedência mínima configurável.
- É possível definir intervalo dos horários (por exemplo, a cada 15 minutos) e quantos dias à frente podem ser agendados.

### Cozinha / KDS
- Relógio em tempo real no ambiente da cozinha.
- Pedidos ordenados pelo **horário de recebimento**, não pelo horário de criação.
- Verde: prazo confortável.
- Amarelo: entrando na janela de atenção.
- Vermelho: prioridade imediata ou atraso.
- Exibe horário em que o pedido entrou e horário que o cliente escolheu para receber.
- O admin consulta novos pedidos automaticamente a cada 5 segundos.

### Imagens dos produtos
- No cadastro/edição do produto há um botão para escolher imagem do **celular ou computador**.
- Aceita JPG, PNG e WEBP de até 5 MB.
- As imagens ficam em `public/uploads`.

### Áreas e taxas de entrega
- A taxa de delivery não é fixa.
- Em **Configurações → Áreas e taxas de entrega**, clique no mapa para posicionar uma área circular.
- Defina nome, raio em metros e valor da taxa.
- É possível cadastrar várias áreas.
- Quando áreas se sobrepõem, a menor área compatível é usada primeiro.
- O cliente calcula a entrega pelo endereço ou GPS.
- O servidor valida novamente a coordenada e bloqueia pedidos fora das áreas cadastradas.
- O projeto vem com 3 áreas de exemplo (1,5 km / 3 km / 5 km), que podem ser apagadas.

### Entregadores
- Cadastro de nome, telefone e veículo.
- Ativar/desativar entregadores.
- Pedidos de delivery podem receber um entregador pelo painel de pedidos.

## Site do cliente (`/`)
- Cardápio conectado ao admin
- Busca e categorias
- Fotos dos produtos
- Carrinho e quantidades
- Retirada ou delivery
- Escolha obrigatória de dia e horário
- CEP automático via ViaCEP
- Geocodificação do endereço e GPS
- Taxa calculada pela área de entrega
- PIX, dinheiro ou cartão
- Troco e observações
- Criação do pedido diretamente no servidor
- Página de acompanhamento em `/pedido/REFERENCIA`
- Atualização automática do status do pedido

## Administração (`/admin`)
- Login protegido
- Dashboard com indicadores
- Pedidos e pagamentos
- Aceite automático de pedidos WEB dentro do expediente
- Fluxo: aceito → preparação → pronto → em rota/concluído
- Tela de cozinha por prioridade de horário
- Produtos com upload de imagem
- Categorias e estoque
- Clientes
- Horário semanal
- Agendamento e tempos operacionais
- Áreas de entrega no mapa
- Cadastro de entregadores

## Abrir no VS Code

Abra **esta pasta**, a que contém `package.json`.

```powershell
npm install
npm run dev
```

Abra:

- Site do cliente: `http://localhost:3000`
- Admin: `http://localhost:3000/admin`

## Login local inicial

- E-mail: `admin@crissalgados.com`
- Senha: `cris1234`

## Trocar senha

Crie `.env.local` na raiz:

```env
ADMIN_EMAIL=admin@crissalgados.com
ADMIN_PASSWORD=SUA_SENHA_FORTE
SESSION_SECRET=UMA_CHAVE_LONGA_E_ALEATORIA
```

Depois reinicie `npm run dev`.

## Observação sobre domingo

A configuração inicial preserva o horário antigo do projeto: **segunda a sábado, 08:00–20:00; domingo fechado**. Para testar pedidos no domingo, entre no Admin → Configurações → Horários e habilite domingo.

## Dados locais

Pedidos, produtos, áreas, entregadores e configurações ficam em `data/store.json`. Imagens enviadas ficam em `public/uploads`.

Para produção pública com vários acessos simultâneos, a evolução recomendada continua sendo PostgreSQL/Supabase no lugar do JSON local.
