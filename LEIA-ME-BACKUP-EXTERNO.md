# SaborFlow — Backup externo PostgreSQL → Cloudflare R2

## Objetivo
Executar um `pg_dump` diário do PostgreSQL do Railway e armazenar o arquivo em um bucket privado do Cloudflare R2.

## Arquivos
- `backup/Dockerfile`
- `backup/backup.sh`

## Segurança
Crie um bucket R2 separado, por exemplo `saborflow-backups`.
NÃO habilite domínio público nem acesso público nesse bucket.
Crie um token R2 com `Object Read & Write` restrito somente ao bucket de backups.

## Variáveis do novo serviço Railway

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
AWS_ACCESS_KEY_ID=<access key do token do bucket de backup>
AWS_SECRET_ACCESS_KEY=<secret key do token do bucket de backup>
AWS_DEFAULT_REGION=auto
ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
BUCKET=saborflow-backups
BACKUP_PREFIX=saborflow
RAILWAY_DOCKERFILE_PATH=backup/Dockerfile
```

Use o nome real do serviço Postgres no `DATABASE_URL`. Se o serviço se chama `Postgres`, a referência acima está correta.

## Cron
Railway usa UTC. Para executar todos os dias às 03:00 no fuso UTC-3:

```text
0 6 * * *
```

## Resultado esperado nos logs

```text
[SaborFlow Backup] Iniciando backup PostgreSQL...
[SaborFlow Backup] Gerando pg_dump em formato custom...
[SaborFlow Backup] Validando estrutura do dump...
[SaborFlow Backup] Enviando dump para R2 privado...
[SaborFlow Backup] SUCESSO: s3://saborflow-backups/...
```

## Organização no bucket

```text
saborflow/
  2026/
    08/
      26/
        saborflow-20260826-060000.dump
        saborflow-20260826-060000.dump.sha256
```

## Retenção recomendada
No Cloudflare R2, crie uma Lifecycle Rule para apagar objetos do bucket de backup após 14 dias inicialmente. Aumente a retenção quando o plano de armazenamento for revisado.

## Teste de restauração
Não restaure por cima da produção para testar. Faça o teste em um banco temporário/scratch com `pg_restore --exit-on-error`.
