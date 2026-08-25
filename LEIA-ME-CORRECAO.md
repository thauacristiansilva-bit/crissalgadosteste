# SaborFlow — correção Fase 3.1

Corrige o erro PostgreSQL:

`42P08: inconsistent types deduced for parameter $2 (text versus uuid)`

Causa: o mesmo parâmetro `$2` era usado como `uuid` em `organization_id`
e também forçado para `text` em `entity_id` dentro do registro de auditoria.

A correção usa parâmetros separados para os dois campos.

## Aplicação

Copie `scripts/bootstrap-first-organization.mjs` para a pasta `scripts/`
do projeto, substituindo o arquivo existente.

Depois:

```powershell
npm run build
git add scripts/bootstrap-first-organization.mjs
git commit -m "Corrigir bootstrap da primeira organizacao SaborFlow"
git push origin main
```

Espere o deploy Railway ficar SUCCESS.

No Console do serviço Railway, execute somente:

```bash
node scripts/bootstrap-first-organization.mjs
```

Não é necessário rodar novamente a migration 002. Ela já foi aplicada.

O bootstrap anterior estava dentro de uma transação; como falhou, as inserções
daquele bootstrap foram revertidas.
