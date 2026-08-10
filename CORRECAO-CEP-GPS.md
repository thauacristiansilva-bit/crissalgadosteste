# Correção CEP + localização atual

Esta versão altera o checkout de delivery para:

- buscar o CEP automaticamente quando o cliente completa 8 dígitos;
- manter o botão **Buscar CEP** como alternativa;
- consultar o ViaCEP pelo próprio servidor Next.js (`/api/address/cep`), evitando depender de uma chamada direta do navegador;
- preencher rua, bairro, cidade e UF pelo CEP; o número continua editável pelo cliente;
- usar o Google Maps para geocodificação reversa da localização atual;
- preencher automaticamente rua, número (quando o Google souber), bairro, cidade, UF e CEP ao usar o GPS;
- atualizar novamente esses dados quando o cliente arrasta o pino ou toca em outro ponto do mapa;
- usar a biblioteca de geocodificação do Maps JavaScript API via `importLibrary("geocoding")`.

## Arquivos principais alterados

- `components/store/storefront.tsx`
- `lib/google-maps-client.ts`
- `app/api/address/cep/route.ts`

## Google Cloud

Mantenha habilitadas no projeto:

- Maps JavaScript API
- Geocoding API

E mantenha no `.env.local`:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=SUA_CHAVE
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=SEU_MAP_ID
```

Depois reinicie o Next.js (`npm run dev`).
