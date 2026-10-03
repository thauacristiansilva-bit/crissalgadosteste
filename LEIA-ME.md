# HOTFIX — ETAPA 12C: Marketing + Conectar Instagram

Este hotfix corrige dois pontos encontrados no código atual:

1. O menu de Marketing estava aparecendo como **Cupons e campanhas**.
2. O componente da conexão Meta/Instagram existia no projeto, mas não estava sendo renderizado na tela de Publicações.

## Aplicar

Extraia o ZIP na raiz do Sabor Flow e rode:

```powershell
node APLICAR-HOTFIX-ETAPA-12C-MARKETING-INSTAGRAM.js
npm run build
```

Se o build passar:

```powershell
git add .
git commit -m "Hotfix Etapa 12C - conectar Instagram ao Marketing"
git push origin main
```

Depois do deploy, no painel administrativo procure:

**Clientes e marketing → Marketing e divulgações**

No topo da área **Publicações programadas + flyers** deverá aparecer:

**Instagram / Meta → Conectar Instagram**

## Se Marketing ainda não aparecer

A seção `marketing` exige a permissão operacional `marketing.manage`.
Perfis owner/admin/manager normalmente possuem essa permissão, mas um perfil com permissões personalizadas pode não possuir.

Nesse caso, abra **Equipe e acessos** e habilite a permissão de gerenciar Marketing/divulgação para o usuário.
