# SaborFlow — FASE 17
## Site institucional

Esta fase cria o site público comercial separado do painel e do storefront das lojas.

Rotas:
- `/`
- `/solucoes`
- `/recursos`
- `/segmentos`
- `/planos`
- `/demo`
- `/faq`
- `/entrar`
- `/contratar`

### Comportamento da raiz
- domínio compartilhado/plataforma: site institucional SaborFlow;
- domínio próprio reconhecido de uma organização: storefront daquela loja;
- lojas no domínio compartilhado continuam em `/loja/{slug}`.

### Planos
`/planos` lê os planos comerciais reais cadastrados no banco. Se ainda não houver planos públicos, a página não inventa preços: mostra que os planos estão em preparação.

### Banco
Não há migration nesta fase.

### Instalação
Extraia o ZIP na raiz do projeto, substituindo os arquivos.

```powershell
git restore next-env.d.ts
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
```

Se o build passar, confira `git status --short` antes de adicionar arquivos ao Git.
