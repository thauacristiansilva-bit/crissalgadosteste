# SaborFlow — Fase 1 PostgreSQL

Este pacote **não migra pedidos nem produtos ainda**.

Ele apenas:

1. adiciona o driver PostgreSQL (`pg`);
2. cria um pool de conexão reutilizável;
3. cria a rota protegida `/api/admin/database-health`;
4. mantém o banco `store.json` funcionando como antes;
5. inclui a correção de `GoogleAddress.locationType`;
6. limpa pastas antigas de patch que estavam entrando no build.

## Instalação

Com `npm run dev` parado, copie o conteúdo deste ZIP diretamente para a raiz do projeto.

Depois, no PowerShell, dentro da raiz do projeto:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\INSTALAR-E-TESTAR-POSTGRES.ps1
```

Se o build terminar com sucesso:

```powershell
git add app/api/admin/database-health/route.ts
git add lib/postgres.ts
git add lib/google-maps-client.ts
git add .gitignore
git add package.json
git add package-lock.json
git add -u

git status
```

Confirme que `.env.local` não aparece e que `data/store.json` não está sendo apagado.

Depois:

```powershell
git commit -m "Adicionar conexao PostgreSQL fase 1 SaborFlow"
git push origin main
```

## Teste no Railway

Espere o deploy ficar `SUCCESS`.

Entre primeiro no Admin, depois abra:

`https://SEU-DOMINIO/api/admin/database-health`

Resultado esperado:

```json
{
  "ok": true,
  "database": "connected",
  "checkedAt": "..."
}
```

Se retornar `401`, faça login no Admin primeiro.

Se retornar `503`, não altere o banco. Abra os logs do serviço e procure:
`[SaborFlow] Falha no teste do PostgreSQL:`

## Importante

- Não apague `data/store.json` ainda.
- Não crie tabelas manualmente no Railway.
- Não copie a senha do PostgreSQL para o código.
- `DATABASE_URL` deve continuar como referência Railway para o serviço `Postgres`.
