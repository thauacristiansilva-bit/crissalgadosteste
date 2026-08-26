# SaborFlow — Etapa 9 — Teste de carga seguro

Este pacote cria um serviço temporário no Railway usando k6. Ele faz somente requisições GET nas páginas públicas `/`, `/cardapio` e `/pedir`. Não cria pedidos, não altera clientes e não escreve no banco.

## 1. Enviar os arquivos

Na raiz do projeto:

```powershell
git add loadtest/Dockerfile
git add loadtest/loadtest.js
git add LEIA-ME-TESTE-CARGA.md
git commit -m "Etapa 9 - adiciona teste de carga seguro"
git push origin main
```

## 2. Criar serviço temporário no Railway

Crie um serviço a partir do mesmo repositório GitHub e renomeie para:

`saborflow-loadtest`

Não adicione volume, domínio, banco ou Cron.

Variáveis:

```text
RAILWAY_DOCKERFILE_PATH=loadtest/Dockerfile
TARGET_URL=https://appsaborflow.com.br
LOAD_VUS=25
LOAD_DURATION=2m
THINK_MIN_MS=500
THINK_MAX_MS=1500
```

O script aceita apenas `appsaborflow.com.br` e subdomínios, como proteção contra teste acidental em terceiros.

## 3. Protocolo

Comece com 25 VUs durante 2 minutos. Durante o teste acompanhe Metrics do serviço `crissalgadosteste` e do `Postgres`.

Se o teste passar e aplicação/banco continuarem saudáveis, altere somente `LOAD_VUS` e faça novo deploy, nesta ordem:

- 25
- 50
- 100
- 250
- 500

Não pule níveis. Pare se houver aumento relevante de erros, CPU/RAM sustentadas em nível crítico ou degradação forte de latência.

## 4. Critérios iniciais de aprovação

No resumo do k6:

- `http_req_failed`: menor que 1%
- `checks`: maior que 99%
- `http_req_duration p(95)`: menor que 1500 ms
- `http_req_duration p(99)`: menor que 3000 ms
- `/api/health` deve responder 200 antes e depois do teste

No Railway, como referência operacional inicial:

- CPU da aplicação: idealmente abaixo de 70% sustentado
- RAM da aplicação: idealmente abaixo de 80%
- CPU do PostgreSQL: idealmente abaixo de 70% sustentado
- RAM do PostgreSQL: idealmente abaixo de 80%

Picos curtos não são, sozinhos, motivo para reprovar. O que importa é saturação sustentada, erros e aumento persistente de latência.

## 5. Importante

Este é um teste de capacidade do backend executado a partir da infraestrutura do Railway. Ele não mede perfeitamente a experiência de um usuário real no Brasil, pois localização, operadora e navegador mudam a latência final.

Depois de concluir todos os testes, o serviço `saborflow-loadtest` pode ser removido.
