# maquetas

Las capturas de la app que salen en la landing (`frytcontrol.jflores.tech`) y
en el portafolio. No se hacen a mano: acá se renderizan las pantallas reales.

```sh
pnpm maquetas
```

Deja en `maquetas/salida/` un PNG por pantalla y tema, la imagen de Open Graph
y `maquetas.json`. Después, en el repo que las consume:

```sh
# en ../landings
node guiones/traer-maquetas.mjs frytcontrol ../planillas-fryt
```

## Cómo funciona

1. Construye la app con `--mode maquetas`, que apunta a un Supabase que no
   existe (`.env.maquetas`), y la sirve con `vite preview`.
2. Abre cada pantalla en Chromium con el reloj congelado en `INSTANTE`, la
   sesión de la dueña puesta en `localStorage` y el tema forzado.
3. Contesta **todas** las llamadas a Supabase desde `datos.mjs`, con un
   PostgREST mínimo (`postgrest.mjs`) que respeta filtros, orden y paginación.
4. Captura en las medidas del contrato de la landing: celular 780×1688,
   escritorio 1920×1200, Open Graph 1200×630.

## Los datos son inventados

Ningún dato del local aparece acá: los montos salen de un hash de la fecha y
los proveedores son nombres de fantasía. Los totales sí se calculan con las
mismas fórmulas que `turno_totales()` y las vistas, así que las pantallas
nunca muestran números que no cuadren entre sí.

El guion de los días (`GUION` en `datos.mjs`) es lo que hace que las maquetas
cuenten algo: un día sin abrir, uno al que le falta la tarde, uno con
descuadre, y hoy con la mañana cerrada y la tarde a medio cerrar.

## Dos corridas dan la misma imagen

Es la propiedad que hace que el manifiesto sirva: si una maqueta cambió,
cambió la app, no el tubo. Por eso el reloj se congela y las animaciones se
adelantan en tiempo falso (`clock.runFor`) en vez de esperarse en tiempo real.

```sh
pnpm maquetas && cp maquetas/salida/maquetas.json /tmp/antes.json
pnpm maquetas && diff /tmp/antes.json maquetas/salida/maquetas.json
```

Nueve de las diez salen idénticas al byte. La décima, Análisis en claro, puede
mover unos diez bytes: el escritorio se rasteriza con densidad 1,5 y las
barritas de porcentaje de los métodos chicos miden fracciones de píxel, así
que su antialias no siempre cae igual. La diferencia es de 2 sobre 255 en un
puñado de píxeles —invisible—, pero conviene saberlo antes de sospechar del
tubo. Si difiere cualquier otra cosa, algo quedó vivo de verdad: una animación
nueva, una fuente que no alcanzó a cargar o un dato que depende de la hora.

## Agregar o cambiar una pantalla

`pantallas.mjs` es la lista: `id`, `forma`, `ruta`, cómo saber que está lista
y cuánto desplazar. El `id` y la `forma` tienen que coincidir con
`maquetas.items[]` del contenido de la landing, de donde salen los nombres de
archivo que Astro espera.

Si una pantalla estrena una consulta sin datos de ejemplo, la corrida falla
nombrándola: una maqueta con un estado vacío es peor que un tubo que se queja.
