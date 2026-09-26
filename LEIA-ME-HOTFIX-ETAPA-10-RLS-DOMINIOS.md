# SaborFlow — Hotfix Etapa 10 — RLS de domínios

Corrige o erro:

`new row violates row-level security policy for table "sf_organization_domains"`

## Causa

As operações de domínio customizado precisavam reafirmar explicitamente o escopo RLS da organização antes de abrir a conexão/transaction PostgreSQL. Em algumas sequências da rota administrativa, o INSERT chegava à tabela com o contexto tenant não aplicado à conexão e o PostgreSQL bloqueava corretamente a gravação.

## O que este hotfix corrige

- cadastro/renovação da verificação de domínio dentro do escopo RLS da organização;
- leitura, verificação e remoção de domínio dentro do escopo RLS;
- tratamento amigável quando o mesmo domínio já pertence a outra organização;
- validação de posse antes de remover um Custom Hostname do Cloudflare, evitando que uma organização tente remover hostname pertencente a outra;
- cleanup tenant-scoped quando o cadastro no Cloudflare falhar.

## Arquivo alterado

- `lib/organization-security-db.ts`

## Banco de dados

Não há migration.

## Dependências

Não há pacote npm novo.

## Instalação

Extraia este ZIP na raiz do projeto, substituindo o arquivo existente.

Depois execute:

```powershell
git status
git add lib/organization-security-db.ts
git commit -m "Hotfix Etapa 10 - corrige RLS de dominios customizados"
git push origin main
```

Não use `git add .`.

Aguarde o Railway terminar o deploy e voltar para `Active`. Depois tente novamente `Admin > Segurança > Domínio customizado > Gerar verificação`.
