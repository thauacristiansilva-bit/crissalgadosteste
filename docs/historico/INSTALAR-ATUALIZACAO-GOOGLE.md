# Instalação da atualização Google Maps automatizada

## 1. Pare o servidor

No terminal do VS Code:

```powershell
Ctrl + C
```

Não substitua arquivos enquanto `npm run dev` estiver rodando.

## 2. Copie os arquivos do ZIP para a raiz do projeto

Exemplo:

```text
C:\Users\thaua\Downloads\cris-salgados-agendamento-entrega-pronto
```

Aceite substituir os arquivos existentes.

O pacote de atualização não inclui `.env.local` nem `data/store.json`.

## 3. Remova os módulos antigos de bairros/Correios/OpenStreetMap

Na raiz do projeto:

```powershell
powershell -ExecutionPolicy Bypass -File .\LIMPAR-SISTEMA-BAIRROS.ps1
```

Esse script também apaga o cache `.next`.

## 4. Google Cloud

Habilite:

- Maps JavaScript API
- Places API (New)
- Geocoding API
- Routes API

## 5. `.env.local`

Mantenha suas variáveis atuais e adicione/configure:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=SUA_CHAVE_DO_NAVEGADOR
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=SEU_MAP_ID
GOOGLE_MAPS_SERVER_API_KEY=SUA_CHAVE_PRIVADA_PARA_ROUTES
```

Não envie essas chaves pelo chat e não faça commit de `.env.local`.

## 6. Inicie

```powershell
npm run dev
```

Teste primeiro `/admin` e depois o checkout do cliente.

## 7. Railway

Cadastre as mesmas três variáveis em Variables. A chave `GOOGLE_MAPS_SERVER_API_KEY` é privada e não deve usar `NEXT_PUBLIC_`.

Depois:

```powershell
git status
git add .
git commit -m "Automatizar mapa e cobertura de entrega"
git push
```
