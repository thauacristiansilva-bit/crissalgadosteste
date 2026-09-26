# Hotfix Etapa 8 - Build TypeScript

Corrige dois erros de tipagem encontrados pelo build do Railway:

1. `dashboard-live` nao fazia parte de `RlsContextSource`. A rota de polling usa agora o contexto existente `tenant-session`.
2. `storeImage()` aceitava `contentType: string`, mas `safeImageExtension()` aceita somente `SafeImageType`. O parâmetro agora é restrito a JPEG, PNG ou WEBP validados.

## Arquivos funcionais alterados

- `app/api/dashboard/live/route.ts`
- `lib/storage/media.ts`

## Git

```powershell
git add app/api/dashboard/live/route.ts
git add lib/storage/media.ts
git commit -m "Hotfix Etapa 8 - corrige tipagem do build"
git push origin main
```

Nao rodar migration, SQL ou npm install.
