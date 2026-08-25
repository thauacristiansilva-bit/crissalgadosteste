# SaborFlow — Etapa 3: cadastro profissional e Login com Google

## O que esta etapa adiciona

- CPF obrigatório do responsável na criação de conta comercial.
- CNPJ opcional, conforme a empresa possua CNPJ.
- Validação matemática de CPF e CNPJ no backend.
- CPF de novos responsáveis armazenado como hash em `sf_users.cpf`.
- Últimos 4 dígitos do CPF guardados somente para identificação visual.
- CNPJ reaproveitado automaticamente na criação da primeira empresa.
- Cadastro comercial com Google Identity Services.
- Login Google na página administrativa para contas já vinculadas.
- Vinculação do Google em **Conta e segurança** para usuários que já utilizam e-mail/senha.
- Rate limit também no login comercial `/api/billing/sign-in`.
- Verificação do ID Token Google no servidor: assinatura RS256, `kid`, `iss`, `aud`, `exp`, `nbf` e `email_verified`.

## O que NÃO entra ainda

- Consulta oficial de CPF/CNPJ na Receita/Serpro.
- Preenchimento automático de razão social/nome da pessoa a partir de base oficial.
- Termos de Uso / Política de Privacidade / registro de aceite (Etapa 4).
- MFA / passkeys.

O sistema marca a validação cadastral oficial como pendente. Dígito verificador válido não é tratado como confirmação de existência na Receita.

## Banco de dados

Não existe migration nova nesta etapa. O projeto já possuía `sf_users.cpf` e `sf_users.google_subject` com índices únicos.

**Não execute migration.**

## Dependências

Nenhuma dependência npm nova foi adicionada. A validação do token Google usa `fetch` e `node:crypto` no backend.

**Não é necessário executar `npm install` por causa desta etapa.**

## Configurar Google no Railway

1. No Google Cloud Console, crie ou escolha um projeto.
2. Configure a tela de consentimento OAuth.
3. Em **Credenciais**, crie um **OAuth Client ID → Aplicativo da Web**.
4. Em **Origens JavaScript autorizadas**, cadastre todos os hosts reais usados pelo SaborFlow, por exemplo:
   - `https://SEU-PROJETO.up.railway.app`
   - `https://saborflow.com.br` quando estiver ativo
   - `https://app.saborflow.com.br` quando estiver ativo
5. O fluxo usa callback JavaScript/popup; ele não depende de um redirect URI próprio do SaborFlow.
6. Copie o Client ID terminado em `.apps.googleusercontent.com`.
7. No Railway → serviço SaborFlow → Variables, crie:

```text
NEXT_PUBLIC_GOOGLE_CLIENT_ID=SEU_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_ID=SEU_CLIENT_ID.apps.googleusercontent.com
```

Use o mesmo Client ID nas duas variáveis. Não é um segredo. O `GOOGLE_CLIENT_ID` é lido pelo backend e o `NEXT_PUBLIC_...` é incorporado ao frontend durante o build.

Se o app OAuth estiver em modo **Testing**, inclua os e-mails que serão usados nos testes como usuários de teste no Google Cloud.

Depois de alterar Variables, faça/reinicie o deploy no Railway para que a variável `NEXT_PUBLIC_...` entre no build.

## Ordem recomendada de deploy

1. Extraia este ZIP sobre a raiz do projeto.
2. Confira:

```powershell
git status
```

3. Adicione somente os arquivos desta etapa:

```powershell
git add .env.example
git add app/admin/nova-empresa/page.tsx
git add app/api/admin/google-link/route.ts
git add app/api/auth/google/route.ts
git add app/api/billing/google/route.ts
git add app/api/billing/sign-in/route.ts
git add app/api/billing/signup/route.ts
git add components/admin/login-form.tsx
git add components/admin/organization-onboarding-form.tsx
git add components/admin/security-panel.tsx
git add components/billing/commercial-checkout.tsx
git add lib/admin-user-db.ts
git add lib/auth-providers/google.ts
git add lib/billing-contracting.ts
git add lib/commercial-registration.ts
git add docs/etapas/ETAPA-3-CADASTRO-GOOGLE.md
```

4. Confira exatamente o que será enviado:

```powershell
git status
git diff --cached --stat
```

5. Commit e push:

```powershell
git commit -m "Etapa 3 - cadastro profissional e login com Google"
git push origin main
```

6. O Railway fará build e deploy automaticamente.

## Testes no ambiente real do Railway

Depois do deploy:

- `/contratar`: criar conta com e-mail/senha + CPF + CNPJ.
- `/contratar`: criar outra conta de teste usando Google.
- CPF matematicamente inválido deve ser recusado.
- CNPJ matematicamente inválido deve ser recusado quando a opção CNPJ estiver ativa.
- Depois de contratar/criar empresa, verificar se o CNPJ aparece pré-preenchido na criação da primeira loja.
- `/admin` → **Conta e segurança**: vincular Google em uma conta antiga de e-mail/senha.
- Sair e testar `/login` usando Google.
- Uma Conta Google com e-mail diferente do e-mail SaborFlow não deve conseguir ser vinculada.

## Logs úteis no Railway

Procure por:

```text
[SaborFlow Google Billing]
[SaborFlow Google Admin]
[SaborFlow Google Link]
[SaborFlow Billing Login]
```

Nunca envie `DATABASE_URL`, `SESSION_SECRET`, tokens ou outras credenciais ao compartilhar logs.
