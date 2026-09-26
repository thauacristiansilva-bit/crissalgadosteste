const fs = require("fs");

const file =
  "components/admin/delivery-settings.tsx";

if (!fs.existsSync(file)) {
  throw new Error(
    `Arquivo nao encontrado: ${file}`
  );
}

const backup =
  `${file}.bak-mapa-classico`;

fs.copyFileSync(file, backup);

let s =
  fs.readFileSync(
    file,
    "utf8"
  );

// ============================================================
// 1. REMOVE googleMapsMapId DO IMPORT
// ============================================================

s = s.replace(
  /import\s*\{\s*googleMapsMapId,\s*hasGoogleMapsKey,\s*loadGoogleMaps\s*\}\s*from\s*"@\/lib\/google-maps-client"/,
  'import { hasGoogleMapsKey, loadGoogleMaps } from "@/lib/google-maps-client"'
);

// ============================================================
// 2. MAPA PADRAO DO GOOGLE - SEM MAP ID
// ============================================================

const mapRegex =
  /const map = new google\.maps\.Map\(mapContainer\.current,\s*\{[\s\S]*?gestureHandling:\s*"greedy",?\s*\}\)/;

if (!mapRegex.test(s)) {
  throw new Error(
    "Bloco de inicializacao do mapa nao encontrado."
  );
}

s = s.replace(
  mapRegex,
`const map = new google.maps.Map(mapContainer.current, {
          center,
          zoom: 18,

          // Mapa Google padrao, sem Map ID e sem Cloud Styling.
          mapTypeId: google.maps.MapTypeId.ROADMAP,

          streetViewControl: true,
          mapTypeControl: true,
          fullscreenControl: true,
          zoomControl: true,

          clickableIcons: true,
          gestureHandling: "greedy",
        })`
);

// ============================================================
// 3. MARCADOR DA EMPRESA
//    AdvancedMarker -> Marker classico
// ============================================================

const storeMarkerRegex =
  /\s*const\s*\{\s*AdvancedMarkerElement\s*\}\s*=\s*await\s+google\.maps\.importLibrary\("marker"\)\s*[\r\n]+\s*storeMarkerRef\.current\s*=\s*new\s+AdvancedMarkerElement\(\{[\s\S]*?\}\)/;

if (!storeMarkerRegex.test(s)) {
  throw new Error(
    "Marcador AdvancedMarker da empresa nao encontrado."
  );
}

s = s.replace(
  storeMarkerRegex,
`
        storeMarkerRef.current = new google.maps.Marker({
          map,
          position: center,
          title:
            settings.storeName ||
            "Empresa",
        })`
);

// ============================================================
// 4. LIMPEZA E MOVIMENTO DO MARCADOR
// ============================================================

s = s.replaceAll(
  "storeMarkerRef.current.map = null",
  "storeMarkerRef.current.setMap?.(null)"
);

s = s.replaceAll(
  "storeMarkerRef.current.position = center",
  "storeMarkerRef.current.setPosition?.(center)"
);

s = s.replaceAll(
  "vertexMarkersRef.current.forEach((marker) => { marker.map = null })",
  "vertexMarkersRef.current.forEach((marker) => marker.setMap?.(null))"
);

// ============================================================
// 5. SUBSTITUI MARCADORES DOS VERTICES
// ============================================================

const vertexRegex =
  /    void \(async \(\) => \{[\s\S]*?    \}\)\(\)/;

if (!vertexRegex.test(s)) {
  throw new Error(
    "Bloco dos marcadores dos vertices nao encontrado."
  );
}

const vertexBlock =
`    vertexMarkersRef.current =
      zonePoints.map(
        (point, index) => {
          const marker =
            new google.maps.Marker({
              map,
              position: point,
              draggable: true,
              title:
                \`Ponto \${index + 1}\`,

              label: {
                text:
                  String(index + 1),
                color: "#ffffff",
                fontSize: "11px",
                fontWeight: "700",
              },

              icon: {
                path:
                  google.maps.SymbolPath.CIRCLE,
                scale: 13,

                fillColor:
                  previewColor,
                fillOpacity: 1,

                strokeColor:
                  "#ffffff",
                strokeOpacity: 1,
                strokeWeight: 2,
              },
            })

          marker.addListener(
            "dragend",
            () => {
              const position =
                marker.getPosition()

              if (!position) {
                return
              }

              const lat =
                position.lat()

              const lng =
                position.lng()

              const rawPoint = {
                lat,
                lng,
              }

              const snapped =
                snapPointToDeliveryBoundaries(
                  rawPoint,
                  deliveryZonesRef.current,
                  {
                    ignoreZoneId:
                      editingZoneIdRef.current,
                    maxDistanceMeters:
                      35,
                  },
                )

              if (snapped) {
                setZoneMessage(
                  \`Ponto encaixado no limite de “\${snapped.zone.name}” (\${Math.round(snapped.distanceMeters)} m).\`,
                )
              }

              setZonePoints(
                (current) =>
                  current.map(
                    (
                      item,
                      itemIndex,
                    ) =>
                      itemIndex ===
                      index
                        ? (
                            snapped?.point ||
                            rawPoint
                          )
                        : item,
                  ),
              )
            },
          )

          return marker
        },
      )`;

s = s.replace(
  vertexRegex,
  vertexBlock
);

// ============================================================
// 6. BOTAO CENTRALIZAR TAMBEM APLICA ZOOM
// ============================================================

s = s.replace(
  /onClick=\{\(\)\s*=>\s*mapRef\.current\?\.setCenter\?\.\(\{\s*lat:\s*settings\.storeLatitude,\s*lng:\s*settings\.storeLongitude\s*\}\)\}/,
`onClick={() => {
          const map = mapRef.current

          if (!map) return

          map.setCenter({
            lat:
              settings.storeLatitude,
            lng:
              settings.storeLongitude,
          })

          map.setZoom(18)
        }}`
);

// ============================================================
// 7. VALIDACOES
// ============================================================

if (
  s.includes(
    "googleMapsMapId()"
  )
) {
  throw new Error(
    "Ainda existe googleMapsMapId() no arquivo."
  );
}

if (
  s.includes(
    "AdvancedMarkerElement"
  )
) {
  throw new Error(
    "Ainda existe AdvancedMarkerElement no arquivo."
  );
}

fs.writeFileSync(
  file,
  s,
  "utf8"
);

console.log("");
console.log(
  "=========================================="
);
console.log(
  "MAPA CLASSICO GOOGLE APLICADO"
);
console.log(
  "=========================================="
);
console.log(
  "Map ID removido do editor de areas."
);
console.log(
  "Cloud Styling removido desse mapa."
);
console.log(
  "ROADMAP padrao ativado."
);
console.log(
  "POIs e labels liberados."
);
console.log(
  `Backup: ${backup}`
);
console.log("");