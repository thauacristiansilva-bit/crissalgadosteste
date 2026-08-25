# SaborFlow — FASE 25.4 / 25.5

## Rota do entregador + rastreamento ao vivo com privacidade por entrega ativa

Esta fase implementa, em conjunto:

1. correção definitiva da origem pública dos links de convite/recuperação;
2. rota do entregador da localização atual até o endereço/coordenadas do cliente;
3. GPS ao vivo do entregador autenticado;
4. acompanhamento do cliente em tempo quase real;
5. privacidade por entrega ativa: somente o cliente da parada atual recebe coordenadas;
6. quando o mesmo entregador estiver atendendo outro pedido, o cliente vê apenas **"Entregador em outra entrega"**;
7. uma única entrega ativa por entregador;
8. limpeza automática da localização ao finalizar/sair da entrega ativa;
9. opção por empresa para ativar/desativar rastreamento ao vivo.

O `store.json` não volta ao runtime. As rotas alteradas nesta fase permanecem PostgreSQL tenant-aware e sob RLS.

---

## 0. Variável obrigatória/recomendada no Railway

No serviço da aplicação, abra **Variables** e configure:

```text
APP_BASE_URL=https://crissalgadosteste-production.up.railway.app
```

Não use `/` no final.

O código também reconhece `X-Forwarded-Host` e `RAILWAY_PUBLIC_DOMAIN` como fallback, mas `APP_BASE_URL` deve ficar configurada como origem canônica da aplicação.

Depois desta variável, novos links de convite devem sair como:

```text
https://crissalgadosteste-production.up.railway.app/convite/...
```

Nunca como `localhost:3000` em produção.

A rota operacional desta fase usa o link universal do Google Maps para navegação e o mapa público do OpenStreetMap para mostrar a posição ao cliente. **Não é necessária uma nova chave de mapa só para esta fase.** As chaves Google já existentes no SaborFlow podem continuar normalmente.

---

## 1. Build local

Extraia este ZIP na raiz do projeto e execute:

```powershell
git restore next-env.d.ts
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
```

Os dois warnings conhecidos de `app/api/media/[name]/route.ts` continuam não bloqueantes se o build terminar com sucesso.

Se houver `Type error`, `Build error occurred` ou `Failed to type check`, pare antes do commit.

---

## 2. Arquivos funcionais

```text
app/api/admin/delivery-dispatch-health/route.ts
app/api/admin/delivery-tracking-health/route.ts
app/api/admin/rbac-health/route.ts
app/api/admin/team/access/route.ts
app/api/admin/workspaces-health/route.ts
app/api/courier/location/route.ts
app/api/order-status/[reference]/route.ts
app/api/orders/[id]/route.ts
app/api/settings/route.ts
components/admin/settings-panel.tsx
components/operational/courier-workspace.tsx
components/store/order-tracker.tsx
database/migrations/027_delivery_live_tracking.sql
lib/delivery-tracking-db.ts
lib/organization-db.ts
lib/public-origin.ts
lib/types.ts
```

Stage somente esses arquivos:

```powershell
git add -- `
"app/api/admin/delivery-dispatch-health/route.ts" `
"app/api/admin/delivery-tracking-health/route.ts" `
"app/api/admin/rbac-health/route.ts" `
"app/api/admin/team/access/route.ts" `
"app/api/admin/workspaces-health/route.ts" `
"app/api/courier/location/route.ts" `
"app/api/order-status/[reference]/route.ts" `
"app/api/orders/[id]/route.ts" `
"app/api/settings/route.ts" `
"components/admin/settings-panel.tsx" `
"components/operational/courier-workspace.tsx" `
"components/store/order-tracker.tsx" `
"database/migrations/027_delivery_live_tracking.sql" `
"lib/delivery-tracking-db.ts" `
"lib/organization-db.ts" `
"lib/public-origin.ts" `
"lib/types.ts"

git diff --cached --check
git --no-pager diff --cached --name-only
```

Não use `git add .`.

Commit:

```powershell
git commit -m "Adicionar rota e rastreamento ao vivo das entregas"
git push origin main
```

---

## 3. Migration 027

Depois do Railway ficar `SUCCESS`, rode:

```bash
node scripts/migrate-multiempresa.mjs
```

Esperado:

```text
APLICANDO 027_delivery_live_tracking...
OK 027_delivery_live_tracking
```

A migration **não cria nova tabela tenant**. Ela amplia `sf_couriers` com:

```text
active_order_id
current_latitude
current_longitude
location_accuracy_meters
location_updated_at
```

O RLS de `sf_couriers` é reafirmado com `ENABLE` + `FORCE`.

Portanto a contagem global continua esperada em:

```text
45 enabled
45 forced
45 policies
```

Não inicie uma entrega para testar o GPS antes de aplicar a migration 027.

---

## 4. Configuração no Admin

Abra:

```text
Admin → Configurações → Totem, fiscal e rastreamento
```

Mantenha marcado:

```text
Rastreamento ao vivo da entrega
```

Essa opção é por organização. Ao desativá-la, nenhuma coordenada é exposta para o cliente.

---

## 5. Regra operacional do entregador

Ao clicar **Iniciar entrega** em `/entregador`:

```text
pedido pronto
→ entregador atribuído
→ navegador solicita localização
→ pedido passa para EM ROTA
→ pedido vira active_order_id do entregador
→ rota é montada da posição atual até o cliente
→ GPS começa a ser publicado
```

A tela publica localização no máximo aproximadamente a cada 5 segundos, conforme o navegador entrega novas leituras.

Enquanto a rota está ativa, o sistema tenta manter a tela acordada com Screen Wake Lock quando o navegador suporta esse recurso.

Existe apenas **uma entrega ativa por entregador**. Tentar iniciar outra antes de concluir a atual retorna conflito no backend.

---

## 6. Privacidade do cliente

Exemplo: Rafael tem os pedidos A e B.

### Rafael está entregando A

Cliente A recebe:

```text
Entregador a caminho
+ mapa
+ posição recente
```

A API só inclui `location` quando `active_order_id == pedido A` e a leitura tem menos de 2 minutos.

Cliente B recebe:

```text
Entregador em outra entrega
```

A resposta do backend **não inclui latitude nem longitude do Rafael para o cliente B**.

### Rafael conclui A

O sistema apaga imediatamente do perfil operacional:

```text
active_order_id
latitude
longitude
precisão
horário da posição
```

O cliente B passa a ver que o entregador foi definido, mas está aguardando o início da sua rota.

### Rafael inicia B

Somente então o cliente B passa a receber o mapa e a localização do entregador.

---

## 7. Teste completo recomendado

1. Gere **Novo convite** para um funcionário e confirme que o hostname é o Railway de produção.
2. Vincule o login do Rafael ao perfil de entregador.
3. Crie/tenha dois pedidos delivery, A e B, prontos e atribuídos ao Rafael.
4. Entre com o login do Rafael em `/entregador` pelo celular.
5. Clique **Iniciar entrega** em A e permita a localização do navegador.
6. Clique **Abrir rota** e confirme destino correto.
7. Abra o acompanhamento do cliente A: deve aparecer mapa/localização.
8. Abra o acompanhamento do cliente B: deve aparecer **Entregador em outra entrega**, sem mapa e sem coordenadas.
9. Finalize A.
10. Confirme que B não mostra localização até Rafael clicar **Iniciar entrega** em B.
11. Inicie B e confirme que o mapa passa a aparecer apenas para B.

---

## 8. Observação de plataforma móvel

O rastreamento desta fase usa `navigator.geolocation.watchPosition`, portanto funciona de forma confiável enquanto o workspace `/entregador` permanece ativo. Android/iOS podem reduzir ou suspender JavaScript quando o navegador fica completamente em segundo plano ou o aparelho bloqueia a aplicação. O sistema usa Wake Lock quando disponível, mas rastreamento de fundo garantido exige uma camada móvel/PWA endurecida ou wrapper nativo; isso deve ser validado em aparelho real antes de considerar rastreamento em background como definitivo.

A regra de privacidade no backend independe dessa limitação: posição velha (>2 minutos), posição de outra entrega ou posição após conclusão nunca é liberada ao cliente.
