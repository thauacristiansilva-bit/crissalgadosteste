# SaborFlow — Etapa 9

Monitoramento, backup, healthcheck, métricas, carga e escala.

## Aplicação
Extraia esta pasta na raiz do projeto. Os arquivos são aditivos e não removem PostgreSQL, RLS ou Cloudflare R2.

## Variáveis Railway
HEALTHCHECK_DB_TIMEOUT_MS=3000
HEALTHCHECK_R2_TIMEOUT_MS=3000
DB_POOL_MAX=10
DB_POOL_IDLE_TIMEOUT_MS=30000
DB_POOL_CONNECTION_TIMEOUT_MS=5000
DB_STATEMENT_TIMEOUT_MS=15000

## Healthcheck Railway
Depois do primeiro deploy, configure o Healthcheck Path como `/api/ready`.

Teste:
```powershell
.\scripts\check-production.ps1 -BaseUrl "https://appsaborflow.com.br"
```

## Observabilidade
Acompanhe CPU, RAM, rede da aplicação e CPU, RAM, disco e logs do PostgreSQL.
Pontos iniciais de atenção: CPU sustentada acima de 80%, RAM acima de 85%, disco acima de 75%.

## Backup
Ative os backups disponíveis no serviço PostgreSQL. Além disso, faça backup lógico:
```powershell
$env:DATABASE_PUBLIC_URL="SUA_URL_PUBLICA_DO_POSTGRES"
.\scripts\backup-postgres.ps1
```
Nunca faça commit dos dumps.

## Teste de restauração
Restaure primeiro em um PostgreSQL temporário:
```powershell
.\scripts\restore-postgres.ps1 -BackupFile ".\backups\saborflow-ARQUIVO.dump" -TargetDatabaseUrl "postgresql://..."
```
Valide empresas, usuários, produtos, categorias, pedidos, configurações e isolamento por tenant.

## Teste de carga
```powershell
$env:LOAD_TEST_URL="https://appsaborflow.com.br/api/health"
$env:LOAD_TEST_DURATION_SECONDS="30"
$env:LOAD_TEST_CONCURRENCY="20"
node .\scripts\load-test.mjs
```
Repita com 20, 50, 100 e 200 concorrentes, um nível por vez, observando as métricas.

## Escala
Considere nova réplica quando houver p95 sustentado acima de aproximadamente 800–1000 ms, CPU sustentada em torno de 75–80% ou saturação clara da instância. Antes disso, confira se o PostgreSQL não é o gargalo.

Com DB_POOL_MAX=10: 1 réplica até 10 conexões; 2 até 20; 3 até 30, além de conexões administrativas e healthchecks.

## Git
```powershell
git status
git add app/api/health/route.ts app/api/ready/route.ts scripts POOL-POSTGRES.md LEIA-ME-ETAPA-9.md
git commit -m "Etapa 9 - monitoramento backup healthcheck e carga"
git push origin main
```

Após o deploy, rode novamente `check-production.ps1`.

## Checklist final
- /api/health responde 200
- /api/ready responde 200 com database.ok=true
- Railway configurado com /api/ready
- Observabilidade revisada
- Backups ativos
- Existe dump lógico externo
- Dump foi restaurado em banco temporário
- Carga 20/50/100/200 executada
- p50/p95/p99 e erros anotados
- Pool revisado
- Número de réplicas decidido pelas métricas

Não há IA nesta etapa.
