# Atualização — Painel Admin com identidade SaborFlow

## O que foi ajustado

- Painel do admin com paleta inspirada na logo do **SaborFlow**
  - laranja principal
  - marrom escuro
  - tons claros quentes para fundo e destaques
- Logo do **SaborFlow®** fixa no topo do painel
- Marca do sistema exibida também no cabeçalho e em destaque no conteúdo
- A marca **não depende das configurações do cliente** e não some
- A logo da loja do cliente continua aparecendo separadamente dentro do painel

## Arquivos alterados

- `components/admin/admin-dashboard.tsx`
- `public/saborflow-brand.png`

## Como instalar a atualização

1. Feche o projeto (`Ctrl + C` no terminal)
2. Extraia o conteúdo deste pacote dentro da pasta do projeto
3. Substitua os arquivos quando solicitado
4. Apague a pasta `.next`
5. Rode novamente:

```powershell
npm run dev
```

## Observação

A marca fixa é a do sistema **SaborFlow®**.
Ela não substitui o nome e a logo da empresa cliente; ela funciona como assinatura oficial da plataforma.
