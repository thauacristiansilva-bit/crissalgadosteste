# SaborFlow — Correção Fase 16.3

## Objetivo

Isolar visualmente e funcionalmente a DEMO de qualquer identidade/URL de loja real.

## Corrigido

- QR e links de uma DEMO passam a apontar para `/loja/<slug-demo>` em vez da raiz do deploy.
- Cabeçalhos e rodapé identificam explicitamente `PAINEL DEMO` / `Ambiente DEMO`.
- Compartilhamento usa `SaborFlow Demo` como título em ambiente demo.
- Mensagem padrão de marketing deixa de conter `Cris Salgados` e usa o nome do tenant atual.
- Metadata global deixa de usar branding fixo da Cris Salgados e passa a usar SaborFlow.
- Fallback de impressão deixa de usar nome de loja real.
- Novos trials usam `SaborFlow Trial Demo`.

## Importante sobre o domínio Railway

A correção impede que a DEMO gere links para a loja real. Enquanto o deploy continuar usando o hostname Railway atual, o hostname técnico continuará aparecendo na URL. Para remover também esse nome técnico da URL, será necessário apontar um domínio neutro do SaborFlow para o mesmo serviço.

## Arquivos funcionais

```text
app/admin/page.tsx
app/layout.tsx
components/admin/admin-dashboard.tsx
components/admin/links-panel.tsx
components/admin/marketing-panel.tsx
lib/demo-db.ts
lib/print-order.ts
```

Não há migration.

## Instalação

```powershell
git restore next-env.d.ts
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
```

Se o build passar:

```powershell
git add app/admin/page.tsx
git add app/layout.tsx
git add components/admin/admin-dashboard.tsx
git add components/admin/links-panel.tsx
git add components/admin/marketing-panel.tsx
git add lib/demo-db.ts
git add lib/print-order.ts

git diff --cached --check
git --no-pager diff --cached --name-only
```

Não use `git add .`.
