# Tasks

## 1. Base visual

- [x] 1.1 Agregar `@fontsource-variable/literata`, `@fontsource-variable/atkinson-hyperlegible-next` y `lucide-react` a `web/` (instalando con el servicio `deps`); verificar que `bun run build` termina y que el bundle no hace peticiones a CDNs externos
- [x] 1.2 Crear `web/src/styles/tokens.css` (tokens claro y oscuro del design, escala de espaciado, radios, curvas `--ease-out`/`--ease-in-out`) y `base.css` (tipografías, foco de 3 px, controles de 44 px como mínimo, botón con `scale(0.97)` al presionar, hover detrás de `(hover: hover) and (pointer: fine)`); verificar que ningún componente usa colores en hexadecimal (`grep` sobre `web/src/pages`) y que la build pasa
- [x] 1.3 Dibujar el logo original (`web/src/assets/logo.svg` con `currentColor` y `web/public/favicon.svg`), crear el componente `Logo` y enlazar el favicon en `index.html`; verificar con capturas del navegador a 16, 28 y 48 px en tema claro y oscuro que se lee como una persona leyendo y que no es un calco de la referencia
- [x] 1.4 Crear los componentes base `Button`, `Field` (etiqueta visible y error bajo el campo), `Card`, `Chip` y `ProgressBar` (con atributos ARIA); verificar con la build y con una revisión en el navegador de la pantalla de ingreso

## 2. Párrafos

- [x] 2.1 Normalizar el texto en `createReading`/`updateReading` (saltos `\r\n`, espacios al final de línea, 3 o más saltos → 2, recorte) antes de NFC; verificar con pruebas que un texto de tres párrafos se guarda con `\n\n` y que los offsets de una palabra del segundo párrafo apuntan a ella
- [x] 2.2 Crear el componente `ReadingText` que divide el texto en `<p>` por `\n\n` e inserta el `<mark>` en el párrafo que contiene `[start, end)`; verificar en el navegador con una lectura de tres párrafos que la palabra del segundo párrafo se resalta en su lugar
- [x] 2.3 Cambiar la etiqueta del texto en administración a "Texto (separa los párrafos con una línea en blanco)"; verificar en el navegador

## 3. Imágenes de lectura (servidor)

- [x] 3.1 Escribir `migrations/002_reading_images.sql` (tabla, FK con cascada, `CHECK` de `mime_type`, `alt_text` no vacío); verificar con una prueba que la migración se aplica sobre una base con `001` y que borrar una lectura borra su imagen
- [x] 3.2 Implementar la detección de tipo por bytes mágicos (PNG, JPEG, WebP); verificar con pruebas unitarias los tres formatos válidos y el rechazo de SVG, GIF y un archivo de texto renombrado a `.png`
- [x] 3.3 Implementar `PUT /api/admin/readings/:id/image` (multipart, ≤ 1 MB, texto alternativo obligatorio, solo texto alternativo si no se envía archivo) y `DELETE`; verificar con pruebas de integración la subida válida, formato no permitido, más de 1 MB, sin texto alternativo, reemplazo en lectura activa con intentos, quitar y el rechazo sin sesión de admin
- [x] 3.4 Implementar `GET /api/readings/:id/image` con las cabeceras del design y agregar `image: { url, alt } | null` a `GET /api/assessment/current` y al detalle de admin; verificar con pruebas las cabeceras (`nosniff`, CSP, `immutable`), que la URL cambia al reemplazar la imagen y el 404 sin imagen
- [x] 3.5 Verificar con una prueba que una lectura completa sin imagen se puede activar

## 4. Contenido inicial

- [x] 4.1 Dibujar `server/seed/images/espejo-integridad.svg` y `biblioteca-barrio.svg` (paleta de los tokens, sin texto incrustado, `viewBox` 4:3) y verificar que se ven bien en tema claro y oscuro
- [x] 4.2 Reemplazar en `seed/readings.ts` la lectura del volcán por "El espejo de la integridad" (texto en tres párrafos, cinco palabras con las ayudas y opciones del design, imagen y texto alternativo) y agregar imagen a "La biblioteca del barrio"; verificar con la prueba del seed que ambas lecturas quedan activas, completas y con imagen
- [x] 4.3 Implementar `RETIRED_TITLES` en el seed (eliminar sin intentos o desactivar con intentos) y agregar la imagen a las lecturas iniciales existentes que no la tengan; verificar con pruebas los tres escenarios de "Lecturas iniciales" de la spec y que ejecutar el seed dos veces no cambia nada

## 5. Pantallas del participante

- [x] 5.1 Rediseñar la pantalla de ingreso con los componentes base; verificar en el navegador la validación bajo cada campo y el ingreso
- [x] 5.2 Rediseñar la pantalla de lectura: encabezado con progreso, tarjeta de papel con `ReadingText`, imagen flotante (768 px o más) o encima (menos de 768 px) con `aspect-ratio` reservado, pregunta con chip de valor, ayudas con ícono y opciones de 48 px; verificar en el navegador a 375, 768, 1024 y 1440 px que la imagen no se superpone al texto y que no hay desplazamiento horizontal
- [x] 5.3 Implementar las tres variantes de animación de la palabra objetivo (`data-variant` por `(n − 1) mod 3`, `data-state`, solo `transform`/`opacity`, movimiento reducido); verificar en el navegador que las palabras 1, 2 y 3 tienen `animation-name` distintos, que la palabra 4 repite el de la 1, que la animación se detiene al responder, que con `reducedMotion: 'reduce'` no hay animación y que la posición de las demás palabras no cambia durante la animación
- [x] 5.4 Rediseñar la retroalimentación (ícono y texto, opción correcta y elegida etiquetadas, entrada de 220 ms con `@starting-style`); verificar en el navegador un acierto y un fallo, y que los estados se distinguen también sin color (etiquetas presentes)
- [x] 5.5 Rediseñar el resumen (calificación, chips de ayudas, tabla de efectividad con barras y porcentaje en texto, aviso de repetición); verificar en el navegador con un participante que repitió

## 6. Administración

- [x] 6.1 Aplicar el nuevo sistema visual al login, al listado y al editor; verificar en el navegador el ingreso, el listado y la edición de una lectura
- [x] 6.2 Agregar la sección "Imagen" al editor (vista previa, texto alternativo obligatorio, subir, reemplazar y quitar, con los errores del servidor); verificar en el navegador subir un PNG, el rechazo de un SVG y quitar la imagen

## 7. Verificación integral

- [x] 7.1 Actualizar el recorrido de punta a punta en el navegador para las lecturas nuevas (participante, resumen, repetición, administración e imagen) y ejecutarlo contra desarrollo y contra la imagen de producción
- [x] 7.2 Ejecutar la suite completa del servidor y el typecheck de servidor y web; verificar que todo pasa
- [x] 7.3 Verificar con un script los contrastes de todos los pares de texto de los tokens (claro y oscuro, ≥ 4.5:1) y con el navegador que el foco es visible en cada control de la pantalla de lectura y que los controles miden al menos 44 × 44 px
- [x] 7.4 Actualizar el README (nueva lectura inicial, imágenes, efecto del seed sobre la lectura del volcán); verificar que los comandos documentados siguen funcionando

## Workflow follow-up

- Archivar `reading-champions-mvp` antes que este cambio (requisito para las deltas MODIFIED de `reading-admin`).
- Archivar este cambio con `/opsx:archive` cuando la implementación esté revisada.
