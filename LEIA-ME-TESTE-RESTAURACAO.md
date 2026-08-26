# SaborFlow — Teste seguro de restauração

Este pacote restaura o backup R2 mais recente em um PostgreSQL temporário.

## Segurança
O script verifica se o banco de destino está vazio antes de fazer qualquer restauração. Se já houver tabelas públicas, ele encerra sem alterar o banco.

## Arquivos
- `backup/restore.Dockerfile`
- `backup/restore-test.sh`

## Serviço Railway sugerido
Crie um serviço separado chamado `saborflow-restore-check`, usando o mesmo repositório GitHub.

Variáveis:

```env
TARGET_DATABASE_URL=${{postgres-restore-test.DATABASE_URL}}
AWS_ACCESS_KEY_ID=<mesmo access key do bucket privado de backup>
AWS_SECRET_ACCESS_KEY=<mesmo secret do bucket privado de backup>
AWS_DEFAULT_REGION=auto
ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
BUCKET=saborflow-backups
BACKUP_PREFIX=saborflow
RAILWAY_DOCKERFILE_PATH=backup/restore.Dockerfile
```

IMPORTANTE: `TARGET_DATABASE_URL` deve apontar para `postgres-restore-test`, nunca para o Postgres de produção.

Não configure cron nesse serviço. Ele é apenas um teste pontual e deve encerrar sozinho.
