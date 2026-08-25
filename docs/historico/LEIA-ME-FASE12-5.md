# SaborFlow — Fase 12.5 — Painel compacto + PDV com entrega — v17.12.5

Este patch deve ser aplicado **depois** das Fases 10, 11 e 12 já validadas.

## O que muda

### 1. Sidebar do Admin mais compacta

- O topo da sidebar passa a mostrar somente a marca **PLATAFORMA** e a logo SaborFlow.
- Sai da sidebar o card grande de empresa, status de pedidos online, `Nova empresa` e `Abrir loja`.
- A navegação `Operação` usa itens mais compactos e ganha mais altura útil, reduzindo bastante a rolagem até as últimas opções.
- O bloco do administrador e o botão `Sair` ficam menores.
- A função multiempresa não é removida: se o usuário possuir mais de uma empresa, um seletor compacto aparece no cabeçalho principal do Admin.

### 2. PDV com Retirada ou Entrega

O painel `Pedidos PDV` passa a permitir:

- `Retirada`;
- `Entrega`;
- escolha de cliente cadastrado;
- reutilização do endereço salvo do cliente;
- digitação manual de endereço;
- busca de endereço pelo Google Maps;
- rua, número, bairro, CEP, cidade, UF e complemento;
- cálculo da taxa antes de registrar o pedido;
- exibição de subtotal, entrega e total;
- associação do pedido à conta do cliente quando uma conta é selecionada.

### 3. Segurança da taxa e do preço

O navegador não define a taxa final do pedido.

A nova rota administrativa de cotação usa a organização da sessão do Admin e chama a mesma regra de preço de entrega já usada pelo backend. Ao registrar o pedido, `createTenantCheckoutOrder()` calcula novamente preço dos produtos, complementos, disponibilidade, estoque e taxa de entrega.

Isso evita aceitar preço ou taxa adulterados pelo navegador.

## Arquivos do patch

```text
app/api/admin/pdv-customers/route.ts
app/api/admin/pdv-delivery-quote/route.ts
app/api/admin/pdv-order/route.ts
components/admin/admin-dashboard.tsx
components/admin/organization-switcher.tsx
components/admin/pdv-panel.tsx
```

## Banco de dados

**Não há migration nova na Fase 12.5.**

Não rode migration por causa deste patch.

## Variáveis de ambiente

Não há variável nova.

Para localizar um endereço que ainda não possui latitude/longitude, o PDV reutiliza a integração já existente com:

```text
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
```

Se um cliente já tiver endereço com coordenadas salvas, a cotação pode reutilizar essas coordenadas.

## Instalação

Extraia o ZIP na raiz do projeto e substitua os arquivos solicitados.

Depois:

```powershell
git restore next-env.d.ts
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
```

Os warnings já conhecidos do Turbopack sobre filesystem em `media/[name]` e `lib/db.ts` continuam não sendo erro quando o build termina com sucesso.

Se houver `Build error occurred`, `Type error` ou `Failed to type check`, pare e não faça commit.

## Git

Adicione somente os arquivos desta fase:

```powershell
git add app/api/admin/pdv-customers/route.ts
git add app/api/admin/pdv-delivery-quote/route.ts
git add app/api/admin/pdv-order/route.ts
git add components/admin/admin-dashboard.tsx
git add components/admin/organization-switcher.tsx
git add components/admin/pdv-panel.tsx
```

Confira:

```powershell
git diff --cached --check
git --no-pager diff --cached --name-only
git status --short
```

Não use `git add .`.

Se estiver correto:

```powershell
git commit -m "Adicionar PDV com entrega e compactar painel SaborFlow"
git push origin main
```

Aguarde o Railway ficar `SUCCESS`.

## Teste 1 — Sidebar

Abra o Admin e confirme:

1. topo da sidebar com apenas logo + `PLATAFORMA`;
2. sem card grande da empresa;
3. sem botões `Nova empresa` e `Abrir loja` na sidebar;
4. seção `Operação` começando mais acima;
5. mais opções visíveis sem precisar rolar tanto;
6. usuário e `Sair` compactos no rodapé.

Se o usuário tiver mais de uma empresa, o seletor aparece de forma compacta no cabeçalho principal e deve continuar trocando a organização ativa.

## Teste 2 — PDV Retirada

1. Abra `Pedidos PDV`.
2. Selecione `Retirada`.
3. Adicione um produto.
4. Informe cliente/pagamento se necessário.
5. Clique em `Registrar pedido`.
6. Confirme que o pedido aparece em `Pedidos` como retirada.

## Teste 3 — PDV Entrega com cliente salvo

1. Abra `Pedidos PDV`.
2. Selecione `Entrega`.
3. Adicione um produto.
4. Em `Cliente cadastrado`, escolha uma conta.
5. Se houver endereço salvo, os campos devem ser preenchidos.
6. Clique em `Localizar e calcular entrega`.
7. Confira taxa e total.
8. Clique em `Registrar pedido para entrega`.
9. Em `Pedidos`, confirme tipo `delivery`, cliente, endereço e taxa.

## Teste 4 — PDV Entrega com endereço manual

1. Selecione `Entrega`.
2. Escolha `Digitar cliente / endereço manualmente`.
3. Informe nome e telefone.
4. Pesquise o endereço pelo campo do Google ou preencha rua/número/bairro/cidade/UF/CEP.
5. Clique em `Localizar e calcular entrega`.
6. Confira taxa e total.
7. Registre o pedido.

## Importante sobre áreas personalizadas

Se a empresa estiver configurada com:

```text
deliveryPricingMode = customAreas
```

o endereço precisa estar dentro de uma área de entrega ativa. Se não existir nenhuma área cadastrada, a mensagem esperada é:

```text
Esse endereço está fora das áreas personalizadas de entrega.
```

Nesse caso, cadastre as áreas no Admin ou altere o modo de cálculo para o modelo realmente utilizado pela empresa (por exemplo, faixas por distância).

## Critérios de aprovação da Fase 12.5

A fase está aprovada quando:

- o build termina com sucesso;
- a sidebar fica compacta conforme solicitado;
- retirada continua criando pedido;
- delivery calcula a taxa pela empresa ativa;
- endereço e número chegam ao pedido;
- o backend recalcula a taxa ao registrar;
- um endereço fora da cobertura continua sendo rejeitado;
- produtos com complementos continuam usando a validação server-side da Fase 11/12.
