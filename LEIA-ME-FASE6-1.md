# SaborFlow — Fase 6.1: Persistência do legado durante a migração

## Por que esta correção é necessária

Os imports das Fases 4, 5 e 6 mostraram:

`Origem: /app/data/store.seed.json`

Isso significa que, naquele container, o importador não conseguiu ler o
`DATA_FILE` persistente e usou o seed do código.

Enquanto `store.json` ainda é necessário para módulos não migrados, ele precisa
ficar em um Volume do **serviço da aplicação**, não somente no volume do
PostgreSQL.

## Antes de avançar para a Fase 7

### 1. Suba estes scripts

Copie `scripts/` deste ZIP para o projeto e rode:

```powershell
git add scripts/bootstrap-persistent-store.mjs
git add scripts/check-persistent-store.mjs
git commit -m "Adicionar bootstrap do armazenamento persistente SaborFlow"
git push origin main
```

Espere Railway `SUCCESS`.

### 2. Railway — Volume da aplicação

No Project Canvas:

- crie um novo Volume;
- conecte ao serviço `crissalgadosteste`;
- Mount Path: `/data`

IMPORTANTE: este é um volume da aplicação. Não altere o volume do Postgres.

### 3. Variáveis do serviço `crissalgadosteste`

Adicione:

```text
DATA_FILE=/data/store.json
UPLOAD_DIR=/data/uploads
```

Salve/deploy as staged changes.

O Railway também fornecerá automaticamente:

`RAILWAY_VOLUME_MOUNT_PATH=/data`

### 4. Inicializar o Volume

Depois do deploy, no Console de `crissalgadosteste`:

```bash
node scripts/bootstrap-persistent-store.mjs
```

O script:

- usa o seed/arquivo atual como base para configurações ainda legadas;
- restaura Categorias/Produtos do PostgreSQL;
- restaura Pedidos do PostgreSQL;
- restaura Contas de clientes do PostgreSQL;
- grava tudo em `/data/store.json`;
- não altera as tabelas do PostgreSQL.

Depois:

```bash
node scripts/check-persistent-store.mjs
```

### 5. Reiniciar o serviço

Faça um redeploy/restart e execute novamente:

```bash
node scripts/check-persistent-store.mjs
```

Os números precisam permanecer iguais depois do restart.

### 6. Health checks

Confira:

- `/api/admin/catalog-health`
- `/api/admin/orders-health`
- `/api/admin/customers-health`

Queremos `ok: true` e `countsMatch: true`.

Só depois disso avance para a Fase 7.
