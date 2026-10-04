# HOTFIX — Publicações simples + formatos corretos

Esta atualização simplifica a área de Marketing do Sabor Flow.

## Novo fluxo

A arte NÃO é mais montada dentro do Sabor Flow.

O fluxo passa a ser:

**Criar arte fora → anexar → legenda → data/hora → agendar**

Pode criar a arte no Canva, Google Flow, IA ou qualquer outro editor.

## Formatos

### Instagram Feed
- proporção: **1:1**
- recomendado: **1080 × 1080 px**

### Instagram Story
- proporção: **9:16**
- recomendado: **1080 × 1920 px**

### WhatsApp Status
- proporção: **9:16**
- recomendado: **1080 × 1920 px**

O upload aceita JPG, PNG e WEBP.
Antes de salvar, o navegador:

1. valida a proporção;
2. redimensiona para a resolução correta;
3. converte para JPEG;
4. envia a arte normalizada.

Se a proporção estiver errada, a publicação não é agendada e a tela informa o tamanho correto.

## Armazenamento

Quando estas variáveis já estiverem configuradas:

```text
R2_ACCOUNT_ID
R2_BUCKET_NAME
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_PUBLIC_BASE_URL
```

o upload das publicações usa Cloudflare R2 automaticamente.

Isso evita perder a imagem quando um container do Railway reinicia e fornece uma URL HTTPS pública para o Instagram buscar a arte.

Se o R2 não estiver completo, existe fallback para o `UPLOAD_DIR` atual.

## Correção importante da fila

O cron estava retornando:

```text
claimed: 0
```

mesmo existindo posts agendados.

O motivo era RLS: o cron consultava a tabela sem um tenant e, por segurança, o banco não devolvia nenhuma linha.

Este hotfix executa o processador de publicações com `runWithRlsBypass`, reservado ao backend privilegiado protegido pelo `CRON_SECRET`.

Agora uma publicação do Instagram deve seguir:

```text
Agendada
→ cron encontra (claimed: 1)
→ Instagram recebe
→ Publicada
```

## Botão Publicada

O botão manual **Publicada** foi removido para Instagram.

Instagram só recebe status `published` depois de sucesso da API.

Para WhatsApp Status, o botão manual permanece porque o envio do Status continua assistido.

## Aplicação

Extraia este ZIP na raiz do projeto e rode:

```powershell
node APLICAR-HOTFIX-PUBLICACOES-SIMPLES-FORMATOS.js
npm run build
```

Se passar:

```powershell
git add .
git commit -m "Simplificar publicacoes e corrigir fila Instagram"
git push origin main
```

Não há migration nova neste hotfix.
