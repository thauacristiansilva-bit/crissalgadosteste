# Correção do ícone Facebook

A versão instalada do `lucide-react` não exporta um componente chamado `Facebook`.

Esta correção:
- remove o import inválido `Facebook` de `lucide-react`;
- adiciona um ícone local `FacebookBrandIcon`;
- atualiza a vitrine e as configurações do Admin para usar esse ícone local;
- não altera `.env.local` nem `data/store.json`.

## Instalação
1. Pare `npm run dev` com `Ctrl + C`.
2. Copie o conteúdo deste ZIP sobre a raiz do projeto e aceite substituir arquivos.
3. Execute:

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run dev
```
