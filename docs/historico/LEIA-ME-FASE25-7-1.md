# SaborFlow — Correção 25.7.1: login de entregador ativo + vínculo operacional

## Problema corrigido

Criar/aceitar a senha ativa `sf_users` e `sf_memberships`, mas o app do entregador também depende de um perfil em `sf_couriers` ativo e vinculado ao `sf_staff_members` correto. Assim, uma conta podia estar autenticada e ainda aparecer como se o login estivesse inativo/não operacional no workspace de entregas.

## O que muda

- ao aceitar convite de um colaborador `courier`, o sistema tenta reconciliar automaticamente o perfil operacional;
- se já houver courier ligado ao colaborador, ele é ativado;
- se houver exatamente um courier não vinculado com mesmo telefone ou nome, ele é vinculado e ativado;
- se não houver candidato e o colaborador tiver telefone, um perfil operacional é criado automaticamente;
- se houver ambiguidade, o sistema não escolhe um entregador arbitrariamente;
- o aviso no `/entregador` passa a distinguir conta autenticada de perfil operacional não vinculado;
- o script `scripts/reconcile-courier-logins.mjs` corrige convites já aceitos antes desta fase;
- se existir evidência segura de convite consumido + senha criada, mas a membership ainda tiver ficado `invited`, o script reconcilia `sf_users`, `sf_memberships` e `sf_staff_members` antes de corrigir o perfil do entregador.

## Migration

Não há migration nova. A migration 025 precisa já estar aplicada, porque ela criou `sf_couriers.staff_member_id`.

## Instalação

Extraia o ZIP na raiz do projeto e execute no terminal PowerShell do VS Code:

```powershell
git restore next-env.d.ts
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
```

Se passar:

```powershell
git status --short
```

Stage somente:

```powershell
git add -- `
"lib/team-access-db.ts" `
"components/operational/courier-workspace.tsx" `
"scripts/reconcile-courier-logins.mjs"
```

Valide:

```powershell
git diff --cached --check
git --no-pager diff --cached --name-only
```

Commit e push:

```powershell
git commit -m "Corrigir ativacao e vinculo do login do entregador"
git push origin main
```

Depois do Railway ficar `SUCCESS`, corrija os logins de entregador que já foram aceitos antes desta fase:

```powershell
node scripts/reconcile-courier-logins.mjs
```

O script lê `DATABASE_URL` do ambiente e, se necessário, tenta `.env.local` e `.env`.

## Teste

1. Admin → Equipe e acessos: o colaborador deve ficar com `Login ativo`.
2. Configurações → Entregadores: o perfil deve ficar `Ativo` e vinculado ao colaborador.
3. Abra janela anônima e faça login com o entregador.
4. Acesse `/entregador`.
5. Deve aparecer `Perfil vinculado`; pedidos atribuídos ao courier devem aparecer.
