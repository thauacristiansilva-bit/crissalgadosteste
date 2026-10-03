# Etapa 8B — WhatsApp Embedded Signup v4

Esta etapa adiciona o botão principal **Conectar meu WhatsApp** na área de Integrações.

## Railway

Adicione as variáveis abaixo depois de criar a configuração WhatsApp Embedded Signup v4 no painel da Meta:

```env
META_APP_ID=
META_APP_SECRET=
META_WHATSAPP_CONFIG_ID=
META_GRAPH_API_VERSION=
META_WHATSAPP_SOLUTION_ID=
```

`META_WHATSAPP_SOLUTION_ID` pode ficar vazio quando a sua configuração não exigir Solution ID.

Não envie `META_APP_SECRET` pelo chat e não exponha essa variável no navegador.

## O que o fluxo faz

1. O cliente cria/define um PIN de 6 dígitos.
2. Clica em **Conectar meu WhatsApp**.
3. O popup oficial da Meta é aberto.
4. A Meta devolve a autorização, WABA e Phone Number ID.
5. O servidor troca o código por token.
6. O servidor confirma se o número pertence à WABA autorizada.
7. Registra o número para Cloud API.
8. Cria/atualiza a conexão criptografada do SaborFlow.
9. Assina a WABA no webhook específico daquela conexão.
10. Ativa a conexão.

## Depois de aplicar

```bash
npm run build
```

Se passar:

```bash
git add .
git commit -m "Adiciona conexao simplificada do WhatsApp pela Meta"
git push
```

Não existe migration nova nesta etapa.
