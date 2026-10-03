# HOTFIX ETAPA 12C — Instagram Login direto

Este hotfix troca a integração da ETAPA 12C do fluxo antigo de Facebook Login para o fluxo que está configurado no seu app:

**Instagram API com Instagram Login / Instagram Business Login**

## O que muda

- OAuth abre `instagram.com`;
- usa o **Instagram App ID** e a **Instagram App Secret**, que são diferentes do App ID principal da Meta;
- solicita somente:
  - `instagram_business_basic`
  - `instagram_business_content_publish`
- usa `graph.instagram.com` para perfil, container e publicação;
- mantém o token criptografado;
- tenta converter o token curto para token de longa duração;
- prepara renovação automática antes de expirar;
- mantém a fila/agendamento da ETAPA 12;
- altera os flyers gerados pelo criador do Sabor Flow para JPG para publicação automática.

## Aplicar

Extraia o ZIP na raiz do projeto e rode:

```powershell
node APLICAR-HOTFIX-ETAPA-12C-INSTAGRAM-LOGIN-DIRETO.js
npm run build
```

Se passar:

```powershell
git add .
git commit -m "Hotfix Etapa 12C - Instagram Login direto"
git push origin main
```

## Railway — novas variáveis

Não apague `META_APP_ID` nem `META_APP_SECRET`.
Eles podem continuar sendo usados por WhatsApp e outras integrações.

Crie estas duas novas variáveis:

```text
META_INSTAGRAM_APP_ID=
META_INSTAGRAM_APP_SECRET=
```

Na sua tela da Meta, o valor de `META_INSTAGRAM_APP_ID` é o **ID do app do Instagram**, não o App ID principal.

Mantenha também:

```text
META_TOKEN_ENCRYPTION_KEY=
META_OAUTH_STATE_SECRET=
APP_PUBLIC_URL=https://saborflow.com.br
CRON_SECRET=
MARKETING_TIMEZONE_OFFSET_MINUTES=-180
META_GRAPH_VERSION=v25.0
```

`META_INSTAGRAM_REDIRECT_URI` é opcional. Sem ela, o sistema usa:

```text
https://saborflow.com.br/api/meta/instagram/callback
```

## Meta Developers

Acesse:

**Casos de uso → Gerenciar mensagens e conteúdo no Instagram → API do Instagram → Configuração da API com login do Instagram**

### 1. Permissões

Garanta que estas permissões estejam disponíveis para o app:

```text
instagram_business_basic
instagram_business_content_publish
```

Se `instagram_business_content_publish` não aparecer no bloco inicial, abra **Permissões e recursos** e habilite a permissão de publicação de conteúdo.

### 2. Conta de teste

Enquanto o app estiver em modo de desenvolvimento, a conta profissional usada no teste precisa estar autorizada como testador/usuário do app.

Na própria configuração da API há a etapa **Gerar tokens de acesso / Adicionar conta**.

### 3. Login da empresa no Instagram

Na etapa:

**Configurar o login da empresa no Instagram**

abra as configurações de Business Login e adicione em **Valid OAuth Redirect URIs**:

```text
https://saborflow.com.br/api/meta/instagram/callback
```

Essa URL precisa ser cadastrada na configuração do **Instagram Login**. A URL que foi cadastrada anteriormente no **Facebook Login para Empresas** pode continuar lá, mas não é usada por este fluxo novo.

## Depois do deploy

Entre em:

**Marketing e divulgações → Publicações → Conectar Instagram**

O login deverá abrir no Instagram, não no Facebook.

Depois de autorizar, o painel deverá mostrar:

```text
Conectado
@usuario
Feed + Story
```

## Produção

Para permitir que clientes que não são testadores conectem as próprias contas, a Meta pode exigir análise do app/acesso avançado das permissões utilizadas. Durante desenvolvimento, teste primeiro com a conta adicionada ao app.
