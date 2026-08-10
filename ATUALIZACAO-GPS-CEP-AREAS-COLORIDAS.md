# Atualização — GPS, CEP e áreas coloridas sem sobreposição

## Checkout do cliente

- Campo de CEP dedicado.
- Ao completar 8 dígitos, o sistema consulta o CEP automaticamente e preenche rua, bairro, cidade e UF internamente.
- Se algum componente vier incompleto, o Google Maps tenta refinar o endereço.
- "Usar minha localização atual" passa a observar o GPS por alguns segundos e escolhe a leitura de melhor precisão.
- O mapa se reposiciona imediatamente quando chega uma leitura melhor do GPS.
- A geocodificação reversa preenche rua, número (quando disponível), bairro e CEP.
- Ao mover o pino, o endereço é sincronizado novamente.

## Áreas personalizadas de entrega

- Cada área recebe automaticamente uma cor diferente e persistente.
- As cores também aparecem no mapa do cliente e na lista do Admin.
- O desenho fica vermelho quando é inválido.
- O botão Salvar fica bloqueado se o polígono cruzar a si mesmo ou sobrepor outra área.
- Áreas podem apenas encostar pela borda; não podem ocupar o mesmo espaço.
- A mesma validação é repetida no backend antes de gravar, evitando bypass pelo navegador.
- Áreas circulares legadas também são consideradas na validação de conflito.

## Instalação

1. Pare o servidor (`Ctrl + C`).
2. Copie os arquivos da atualização sobre o projeto atual e aceite substituir.
3. Não substitua `.env.local` nem `data/store.json`.
4. Limpe o cache: `Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue`.
5. Rode `npm run dev`.

## Teste rápido

1. Digite um CEP de 8 números no checkout e confira rua/bairro.
2. Clique em "Usar minha localização atual" e permita localização precisa.
3. Confira se o mapa centraliza no GPS e o endereço é preenchido.
4. No Admin, selecione Áreas personalizadas e crie duas áreas separadas: elas devem ter cores distintas.
5. Tente desenhar a segunda invadindo a primeira: o desenho deve ficar vermelho e não deve salvar.
