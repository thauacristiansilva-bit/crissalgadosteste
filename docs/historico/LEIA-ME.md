# Correção de build Railway v16.3

Esta correção resolve os três erros que bloquearam o deploy:

1. `GoogleAddress` / `locationType` no checkout.
2. `fix_login_sidebar_footer/app/login/page.tsx` sendo compilado indevidamente.
3. `v16patch/app/login/page.tsx` sendo compilado indevidamente.

Os avisos de acesso dinâmico ao filesystem não foram a causa do build falhar; são warnings do Turbopack.

## Instalação

Copie `lib/google-maps-client.ts` e `.gitignore` para a raiz do projeto, substituindo os existentes.
Depois rode `LIMPAR-E-TESTAR-BUILD.ps1` na raiz do projeto.

Se `npm run build` concluir com sucesso:

```powershell
git add .gitignore lib/google-maps-client.ts
git add -u
git commit -m "Corrigir build Railway SaborFlow v16.3"
git push origin main
```
