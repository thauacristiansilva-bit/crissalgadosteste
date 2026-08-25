# Aplicar Etapa 8 no Railway

1. Extraia o ZIP na raiz do SaborFlow.
2. Use `git status`.
3. Adicione somente os arquivos listados nas instruções entregues pelo ChatGPT.
4. Commit e push para `main`.
5. Aguarde o Build/Deploy do Railway ficar verde.
6. O sistema continuará em modo local caso `MEDIA_STORAGE_MODE` não seja `r2`.
7. Crie/configure o bucket R2 e as variáveis no Railway.
8. Faça Redeploy.
9. No ADM, abra `Segurança da conta → Storage e CDN` e migre os lotes de imagens.
10. Só remova o Volume depois de zero arquivos locais e testes visuais completos.
11. Em Railway → Settings → Deploy, configure Healthcheck Path como `/api/health`.

Nenhuma migration e nenhum `npm install` são necessários nesta etapa.
