# SaborFlow — FASE 25.3.2.2

Correção focada em dois pontos da gestão de equipe:

1. O link de convite/recuperação fica visível em um cartão persistente, com campo selecionável, botão **Copiar link** e ação **Abrir link**.
2. Owner/Admin passam a ter a ação **Excluir** em qualquer perfil de colaborador.

## Exclusão segura

- exige governança de acesso (`access.manage` / Owner/Admin);
- usa PostgreSQL tenant-aware e respeita RLS;
- se houver login vinculado, desativa apenas a membership desta empresa e revoga tokens pendentes;
- não apaga `sf_users`, pois o mesmo usuário pode participar de outra organização;
- se houver perfil de entregador vinculado, ele é desvinculado antes de excluir o colaborador;
- proprietário (`owner`) não pode ser excluído por esta operação;
- não usa `store.json`;
- não há migration.

## Arquivos funcionais

- `components/admin/team-panel.tsx`
- `app/api/staff/[id]/route.ts`
- `lib/organization-db.ts`

## Build

```powershell
git restore next-env.d.ts
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
```

## Stage

```powershell
git add -- `
"components/admin/team-panel.tsx" `
"app/api/staff/[id]/route.ts" `
"lib/organization-db.ts"

git diff --cached --check
git --no-pager diff --cached --name-only
```

## Commit

```powershell
git commit -m "Exibir convite e permitir excluir colaborador"
git push origin main
```

Não rode migration.

Depois do deploy, se o colaborador já estiver como **Convite pendente**, clique em **Novo convite** para gerar um token novo; o link ficará visível no cartão verde.
