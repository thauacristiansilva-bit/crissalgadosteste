# Atualizar a versão já publicada no Railway

Este guia considera que seu projeto atual já está conectado ao GitHub e que o Railway faz deploy automático da branch `main`.

## 1. Backup dos dados atuais

Na pasta antiga do projeto:

```powershell
Copy-Item .\data\store.json "$env:USERPROFILE\Downloads\cris-store-backup.json" -ErrorAction SilentlyContinue
Copy-Item .\.env.local "$env:USERPROFILE\Downloads\cris-env-backup.txt" -ErrorAction SilentlyContinue
```

## 2. Copiar a nova versão

Extraia este ZIP em uma pasta separada. Copie os arquivos da nova versão para a pasta que já possui o `.git` e o remote do GitHub.

Se quiser continuar com os dados locais antigos durante o teste, restaure:

```powershell
Copy-Item "$env:USERPROFILE\Downloads\cris-store-backup.json" .\data\store.json -Force
```

O sistema normaliza automaticamente campos novos quando lê dados de uma versão anterior.

## 3. Parar de versionar dados reais

Versões antigas podem ter `data/store.json` rastreado porque ele foi adicionado com `git add -f`. Agora existe `data/store.seed.json` para o seed e `data/store.json` deve ser privado.

Rode:

```powershell
git rm --cached data/store.json
```

Se aparecer que o arquivo não é rastreado, pode ignorar. O arquivo local não é apagado por `--cached`.

## 4. Configurar Google Maps local

No `.env.local`:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=SUA_CHAVE_ROTACIONADA_E_RESTRITA
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=SEU_MAP_ID
```

Não coloque a chave em nenhum arquivo que será commitado.

## 5. Testar antes de publicar

```powershell
npm install
npm run dev
```

Teste:

- `/` delivery, CEP, GPS e mapa;
- `/admin` login;
- Configurações → áreas do mapa;
- Cardápio → upload de foto;
- Clientes → criar conta;
- PDV;
- Cozinha;
- pedidos e impressão manual.

Depois pare com `Ctrl + C` e faça:

```powershell
npm run build
```

## 6. Railway Variables

Além das variáveis que já existem, confira:

```env
ADMIN_EMAIL=...
ADMIN_PASSWORD=...
SESSION_SECRET=...
CLIENT_SESSION_SECRET=...
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=...
PRINT_AGENT_TOKEN=...
```

## 7. Volume persistente

Crie/edite o Volume do serviço e monte em:

```text
/data
```

Adicione:

```env
DATA_FILE=/data/store.json
UPLOAD_DIR=/data/uploads
```

Assim pedidos, configurações, clientes e imagens sobrevivem a novos deploys.

## 8. Enviar para GitHub

```powershell
git status
git add .
git commit -m "Atualizar sistema CrisFlow completo"
git push
```

O Railway deverá iniciar o deploy automaticamente.

## 9. Pós-deploy

No admin:

1. Configurações → personalize cores, logo e capa.
2. Configure horários e meios de pagamento.
3. Configure áreas de entrega pelo mapa.
4. Cadastre entregadores.
5. Configure link de avaliação Google.
6. Se usar impressão automática, configure o agente Windows.
7. Faça um pedido real de teste pelo celular.
