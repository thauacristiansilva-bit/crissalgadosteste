# SaborFlow — Etapa 2: Segurança

Esta etapa reforça a aplicação sem alterar o esquema do PostgreSQL e sem adicionar dependências npm.

## Alterações principais

- Rate limit no login administrativo por IP e por conta.
- Mensagens de login genéricas para reduzir enumeração de usuários.
- Comparação de senha com hash fictício quando a conta não existe, reduzindo diferença de tempo da resposta.
- Senhas novas passam a exigir no mínimo 12 caracteres. Senhas antigas continuam válidas para login.
- Proteção central contra requisições cross-site em métodos que alteram estado (`POST`, `PUT`, `PATCH`, `DELETE`).
- Exceções explícitas para webhooks e worker interno que possuem autenticação/assinatura próprias.
- Headers de segurança: HSTS, CSP mínima, anti-clickjacking, `nosniff`, Referrer Policy e Permissions Policy.
- Remoção do header `X-Powered-By` do Next.js.
- Rotas de upload passam a exigir sessão tenant verificada e permissão específica.
- Uploads JPG/PNG/WEBP são verificados pelos bytes reais do arquivo, não apenas pelo MIME enviado pelo navegador.
- Diagnósticos de banco exigem permissão de segurança e deixam de retornar a lista completa de tabelas.

## Observação sobre rate limit

O rate limit desta etapa é por processo da aplicação. Ele protege a implantação atual de instância única. Quando o SaborFlow usar várias réplicas, a etapa de escala deverá migrar esse estado para Redis/serviço compartilhado ou para uma camada WAF/rate limiting externa.

## Banco de dados

Nenhuma migration é necessária nesta etapa.
