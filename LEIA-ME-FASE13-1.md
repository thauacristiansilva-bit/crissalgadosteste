# SaborFlow — Fase 13.1 — Ajuda contextual do Admin — v17.13.1

Pacote preparado sobre a Fase 13 (DRE gerencial) + Fase 12.5.

## Objetivo

Adicionar ajuda contextual discreta aos mecanismos administrativos que costumam gerar dúvida, sem aumentar a altura dos cards nem poluir a interface.

O padrão visual é um pequeno `?` circular de 18 px ao lado do nome da função.

### Comportamento

- desktop: abre ao passar o mouse ou focar pelo teclado;
- celular/tablet: abre ao tocar;
- fecha ao tocar fora ou pressionar `Esc`;
- tooltip usa portal no `document.body`, evitando corte por containers com `overflow`;
- textos ficam centralizados em `lib/admin-help.ts`;
- componente reutilizável em `components/admin/help-tip.tsx`;
- sem modal e sem alterar banco de dados.

## Áreas cobertas

### Caixa e Financeiro

- abrir / fechar caixa;
- lançamento financeiro;
- categoria da DRE.

### DRE gerencial

- DRE gerencial;
- receita líquida;
- CMV;
- lucro bruto;
- resultado líquido;
- margem bruta;
- margem líquida;
- ticket médio.

### Inventário

- estoque de produto pronto;
- estoque de ingredientes;
- estoque mínimo;
- custo por unidade;
- entrada, saída, perda e ajuste de saldo.

### Produtos / Montagem / Ficha técnica

- controlar estoque do produto pronto;
- ficha técnica base;
- grupos de complementos;
- mínimo e máximo de escolhas;
- incluídos grátis;
- grupo obrigatório;
- preço adicional;
- opção elegível para vaga grátis;
- ingredientes consumidos por opção.

### Pedidos / Cozinha / PDV

- fluxo e mudança de status;
- status de pagamento;
- cancelamento e reversão de estoque;
- atribuição de entregador;
- fluxo da cozinha;
- pedido para entrega no PDV;
- localização e cálculo da entrega.

### Entrega

- modo de preço/cobertura;
- cálculo por distância;
- faixas por quilômetros;
- áreas personalizadas;
- entrega grátis acima de determinado valor;
- entregadores.

### Configurações

- operação liberada;
- intervalo/agendamento;
- impressão automática;
- nome da impressora Windows;
- ticket de cozinha;
- ticket do cliente.

### Equipe e Segurança

- perfil operacional versus login;
- função do colaborador;
- convite de acesso;
- timezone;
- domínio customizado;
- agentes de impressão.

## Arquivos alterados

```text
components/admin/delivery-settings.tsx
components/admin/dre-panel.tsx
components/admin/help-tip.tsx
components/admin/inventory-panel.tsx
components/admin/kitchen-panel.tsx
components/admin/orders-panel.tsx
components/admin/pdv-panel.tsx
components/admin/product-composition-editor.tsx
components/admin/products-panel.tsx
components/admin/sales-panel.tsx
components/admin/security-panel.tsx
components/admin/settings-panel.tsx
components/admin/team-panel.tsx
lib/admin-help.ts
```

## Migration

**Não existe migration nova nesta fase.**

## Instalação

Extraia o ZIP na raiz do projeto, substituindo os arquivos indicados.

Depois:

```powershell
git restore next-env.d.ts
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
```

Os warnings conhecidos do Turbopack sobre acesso dinâmico ao filesystem não bloqueiam o deploy quando o build termina com sucesso.

Se o build falhar com `Build error`, `Type error` ou `Failed to type check`, não faça commit.

## Git

Adicione somente os arquivos desta fase:

```powershell
git add components/admin/delivery-settings.tsx
git add components/admin/dre-panel.tsx
git add components/admin/help-tip.tsx
git add components/admin/inventory-panel.tsx
git add components/admin/kitchen-panel.tsx
git add components/admin/orders-panel.tsx
git add components/admin/pdv-panel.tsx
git add components/admin/product-composition-editor.tsx
git add components/admin/products-panel.tsx
git add components/admin/sales-panel.tsx
git add components/admin/security-panel.tsx
git add components/admin/settings-panel.tsx
git add components/admin/team-panel.tsx
git add lib/admin-help.ts

git diff --cached --check
git --no-pager diff --cached --name-only
```

Não use `git add .`.

Depois:

```powershell
git commit -m "Adicionar ajuda contextual ao painel SaborFlow"
git push origin main
```

Não há migration para executar no Railway.

## Teste rápido após deploy

1. Abra `Admin → Vendas e caixa` e teste o `?` de **Caixa** e **Lançamento financeiro**.
2. Abra `Admin → DRE gerencial` e teste os indicadores CMV, margens e resultado líquido.
3. Abra `Admin → Inventário` e confirme as explicações de saldo, mínimo, custo e movimentações.
4. Abra `Produtos → Montagem` e teste mínimo, máximo, incluídos grátis e ingredientes da opção.
5. Abra `Admin → Configurações` e teste operação liberada, entrega e impressão.
6. Em celular, toque no `?` e depois fora dele: o tooltip deve abrir e fechar sem acionar o checkbox/botão ao lado.
7. Em desktop, passe o mouse e use `Tab` para confirmar suporte a mouse e teclado.

## Segurança e comportamento

A Fase 13.1 é somente de interface e conteúdo explicativo. Ela não altera permissões, cálculos, RLS, pedidos, estoque, DRE ou regras de negócio.
