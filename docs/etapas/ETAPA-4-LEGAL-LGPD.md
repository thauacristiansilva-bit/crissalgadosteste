# SaborFlow — Etapa 4: Termos, Privacidade e registro de aceite

## Objetivo

Esta etapa cria a base jurídica/técnica para transparência e registro de aceite no SaborFlow, sem adicionar dependências e sem criar migration.

## O que foi implementado

- `/termos`: Termos de Uso públicos e versionados.
- `/privacidade`: Aviso de Privacidade público e versionado.
- Cadastro por e-mail/senha exige aceite dos Termos e ciência do Aviso de Privacidade.
- Cadastro por Google exige o mesmo aceite antes de criar a conta.
- A versão aceita é gravada no `sf_audit_log` com usuário, versão, data, origem, IP e User-Agent.
- Contas administrativas antigas são encaminhadas uma vez para `/legal/aceite` ao entrar pelo fluxo normal do painel.
- Quando a constante de versão for atualizada, o painel poderá solicitar um novo aceite.
- Cadastro opcional de consumidor da loja exige ciência do Aviso de Privacidade e registra o evento de auditoria associado à conta do cliente.
- Checkout público informa a finalidade básica do uso dos dados e oferece link para Privacidade.
- Rodapés do site institucional e da loja exibem links de Termos/Privacidade.
- Corrigido um campo de senha duplicado que havia ficado na tela acumulada de contratação.

## Onde alterar as versões no futuro

Arquivo:

`lib/legal-documents.ts`

Constantes:

- `TERMS_VERSION`
- `PRIVACY_VERSION`
- `LEGAL_LAST_UPDATED`

Sempre que houver mudança material que exija novo aceite, altere a versão correspondente. Não altere a versão para simples correção tipográfica sem impacto material, salvo orientação jurídica.

## Banco de dados

NÃO existe migration nesta etapa.

O histórico utiliza `sf_audit_log`, que já existe no SaborFlow. Os eventos são:

- `legal.terms.accepted`
- `legal.privacy.acknowledged`
- `legal.customer_privacy.acknowledged`

## Observação jurídica importante

Os textos entregues formam uma base operacional alinhada à arquitetura técnica atual do SaborFlow e aos princípios de transparência da LGPD. Antes de uma abertura comercial ampla, recomenda-se revisão por profissional jurídico, principalmente para inserir/confirmar:

- razão social do operador do SaborFlow;
- CNPJ do operador;
- endereço empresarial;
- canal formal de privacidade/encarregado, quando aplicável;
- política comercial de cancelamento e reembolso;
- detalhes dos principais operadores/suboperadores contratados;
- regras específicas do modelo tributário e dos planos comercializados.

A Política de Privacidade não deve usar consentimento como base genérica para todo tratamento. O checkbox do cadastro registra concordância com os Termos e ciência do Aviso. Consentimentos opcionais de marketing devem continuar separados.

## Deploy

Não executar migration e não instalar dependência nova.

Depois de extrair o pacote na raiz do projeto:

```powershell
git status
```

Adicione somente os arquivos desta etapa conforme o guia enviado junto ao pacote, faça commit e `git push origin main`. O Railway executará o build/deploy automaticamente.
