# SaborFlow v15 — correção definitiva de identidade do Admin

Esta versão corrige o problema em que o layout antigo continuava aparecendo.

## Alterações

- Login redesenhado nas cores do SaborFlow
- Sidebar do Admin redesenhada em marrom + laranja/dourado
- Rodapé fixo no painel
- Logo SaborFlow fixa e independente da logo da empresa cliente
- Empresa cliente continua dinâmica conforme as Configurações do Admin
- Campo "Nome do sistema" removido das configurações
- API força `systemName: SaborFlow`
- Banco normalizado para manter o nome da plataforma

## Instalação

Pare o servidor:

```powershell
Ctrl + C
```

Copie as pastas/arquivos desta atualização diretamente para a raiz do projeto e aceite **Substituir**.

Depois execute:

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run dev
```

Acesse primeiro:

```text
http://localhost:3000/login
```

Se estiver logado e for redirecionado automaticamente para `/admin`, saia do painel antes de testar a nova tela de login.

## Arquivos da atualização

- `app/login/page.tsx`
- `app/api/settings/route.ts`
- `components/admin/login-form.tsx`
- `components/admin/admin-dashboard.tsx`
- `components/admin/settings-panel.tsx`
- `lib/db.ts`
- `public/saborflow-brand.png`
