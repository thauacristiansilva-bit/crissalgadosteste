# Limites automáticos entre áreas de entrega

Esta atualização muda o comportamento das áreas personalizadas:

- Não bloqueia mais uma nova área por sobreposição com outra cobertura.
- Quando duas áreas cobrem o mesmo ponto, a área geograficamente menor (mais específica) tem prioridade.
- Uma área externa pode ser desenhada passando ao redor/por cima de uma área interna; a externa passa a valer imediatamente do limite da interna para fora.
- Pontos clicados ou arrastados a até 35 metros de uma borda existente são encaixados automaticamente nessa borda.
- As áreas continuam com cores diferentes e são desenhadas da maior para a menor, deixando a área específica visualmente por cima.
- Um ponto exatamente sobre a linha de divisão é considerado coberto, evitando ruas sem taxa por pequenas lacunas de desenho.
- O backend usa a mesma regra de prioridade, então um endereço recebe apenas uma área/taxa efetiva.

## Instalação

1. Pare o servidor com `Ctrl + C`.
2. Copie os arquivos desta atualização para a raiz do projeto e aceite substituir.
3. Limpe o cache: `Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue`.
4. Rode `npm run dev`.
5. Em Admin > Configurações > Preços e cobertura > Áreas personalizadas, desenhe a área 1 e depois uma área 2 maior ao redor dela.
