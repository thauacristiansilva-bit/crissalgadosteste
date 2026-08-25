# CrisFlow — mapa e entrega automatizados com Google Maps

Esta versão elimina o subsistema operacional de bairros. Não existe lista de bairros, sincronização de bairros nem preço por bairro.

O bairro pode continuar salvo internamente apenas como um componente do endereço retornado pelo Google, junto com rua, número, cidade, UF e CEP. O cliente e o Admin não precisam manter listas manuais.

## Arquitetura

- Google Maps JavaScript API: mapa do Admin e do checkout.
- Places API (New): autocomplete moderno de endereço por rua, número, CEP ou lugar.
- Geocoding API: coordenadas/GPS/pino para endereço e endereço para coordenadas.
- Routes API: distância real de carro pelas ruas para preço por km e faixas de distância.
- Polígonos no Google Maps: áreas personalizadas desenhadas pelo Admin, cada uma com sua taxa.

## Modos de preço e cobertura

1. Sem preço: entrega grátis.
2. Preço fixo: um valor único.
3. Distância percorrida: taxa base + valor por km da rota de carro.
4. Áreas personalizadas: o Admin desenha polígonos no mapa e define o preço de cada área.
5. Faixas por distância: preços diferentes para intervalos, por exemplo 0–3 km, 3–6 km e 6–10 km.

Também é possível configurar entrega grátis acima de determinado valor do pedido. A gratuidade não ignora a cobertura: se o modo for área personalizada ou distância, o endereço ainda precisa estar dentro da cobertura configurada.

## Fluxo do Admin

Em Configurações, pesquise o endereço da empresa no autocomplete do Google, selecione o resultado e ajuste o pino exatamente na entrada. Rua, número, cidade, UF, CEP e demais componentes são gravados automaticamente.

Em Preços e cobertura de entrega, escolha o modo de cobrança. Em Áreas personalizadas, clique no mapa para criar pelo menos três vértices; depois arraste os pontos para ajustar o polígono e defina o preço daquela área.

## Fluxo do cliente

O cliente pode pesquisar o endereço no autocomplete do Google ou tocar em Usar minha localização atual. O sistema obtém as coordenadas, preenche o endereço, mostra o pino para conferência e calcula a taxa automaticamente. Cidade/UF/bairro não aparecem como campos manuais.

## APIs do Google a habilitar

- Maps JavaScript API
- Places API (New)
- Geocoding API
- Routes API

Google Maps Platform exige uma conta de faturamento ativa. Esta versão prioriza qualidade e automação e, por isso, não é a versão sem billing.

## Variáveis

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=
GOOGLE_MAPS_SERVER_API_KEY=
```

Use uma chave de navegador para Maps JavaScript/Places/Geocoding e uma chave privada separada para Routes. `GOOGLE_MAPS_SERVER_API_KEY` nunca deve usar o prefixo `NEXT_PUBLIC_`, nunca deve ir para o navegador e nunca deve ser commitada no Git.
