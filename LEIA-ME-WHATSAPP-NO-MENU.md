# WhatsApp como módulo próprio no painel

Este hotfix adiciona o módulo **ATENDIMENTO > WhatsApp** ao menu lateral principal do SaborFlow.

O WhatsApp deixa de depender de localizar a área de Integrações. A nova área reúne:
- conexão oficial pela Meta / Embedded Signup;
- conversas reais;
- IA x atendente humano;
- etiquetas;
- notas internas;
- histórico;
- modelos de mensagem.

## Aplicação
Extraia o ZIP na raiz do projeto e sobrescreva os arquivos.

Depois rode:

```bash
npm run build
```

Se passar:

```bash
git add .
git commit -m "Adiciona WhatsApp como modulo proprio no painel"
git push
```

Não há migration nova neste hotfix.
