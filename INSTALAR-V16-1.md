# Correção V16.1 — Login 100% genérico do SaborFlow

Esta atualização corrige o pacote anterior e deixa a tela de login sem qualquer empresa cliente.

## O login mostra somente
- Plataforma SaborFlow
- SaborFlow
- Acesso ao sistema
- Campos de e-mail e senha

## O login NÃO mostra
- nome de empresa cliente
- cidade de empresa cliente
- logo de empresa cliente
- e-mail pré-preenchido de empresa cliente
- textos "identidade da plataforma", "marca registrada" ou "identidade fixa"

Os dados da empresa aparecem somente depois do login, no Dashboard.

## Instalação
Copie `app`, `components` e `public` diretamente para a raiz do projeto e aceite substituir os arquivos.
Depois execute:

```powershell
Ctrl + C
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run dev
```

Abra `/login` em janela anônima para evitar sessão/cache antigo.
