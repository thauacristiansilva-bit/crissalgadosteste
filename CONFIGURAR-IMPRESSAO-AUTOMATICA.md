# Impressão automática no Windows

A impressão automática precisa de um computador Windows ligado na loja e conectado à impressora. O navegador sozinho não pode imprimir silenciosamente sem uma confirmação do usuário.

1. No Railway, crie uma variável `PRINT_AGENT_TOKEN` com uma senha longa e aleatória.
2. No Admin > Configurações > Impressoras e tickets, ative **Impressão automática** e escolha os tickets desejados.
3. No computador da loja, clique com o botão direito em `INICIAR-IMPRESSAO-AUTOMATICA.ps1` e execute com PowerShell. Se o Windows bloquear scripts, abra PowerShell e execute:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

4. Informe a URL do Railway, o mesmo `PRINT_AGENT_TOKEN` e o nome exato da impressora.
5. Deixe a janela aberta durante o atendimento.

A fila é persistida pelo pedido: se o agente estiver desligado, o pedido continua não impresso e será buscado quando o agente voltar, desde que os dados do servidor não sejam perdidos por um redeploy do armazenamento local.
