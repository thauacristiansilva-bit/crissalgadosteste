# Aplicar Etapa 2 no SaborFlow (GitHub → Railway)

1. Extraia este ZIP na raiz do projeto, onde está `package.json`, substituindo os arquivos existentes.

2. Execute a limpeza dos documentos históricos:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\APLICAR-LIMPEZA-REPOSITORIO.ps1
```

3. Confira o que mudou:

```powershell
git status
```

4. Esta etapa não adiciona pacote npm e não possui migration PostgreSQL.

5. Adicione alterações e remoções/movimentos da limpeza:

```powershell
git add -u
git add app components lib docs scripts next.config.mjs proxy.ts
```

6. Confira exatamente o que entrará no commit:

```powershell
git status
git diff --cached --stat
```

7. Commit e push:

```powershell
git commit -m "Etapa 2 - reforca seguranca e organiza repositorio"
git push origin main
```

8. O Railway conectado à branch `main` fará Build e Deploy automaticamente.

9. No Railway, confirme o deploy como `SUCCESS`. Depois teste o login pelo domínio de produção. Se aparecer erro PostgreSQL, abra os Logs e procure por:

```text
[SaborFlow] Falha no login PostgreSQL:
```

Não compartilhe `DATABASE_URL`, secrets, tokens ou senhas.
