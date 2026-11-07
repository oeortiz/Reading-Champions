# Design

## Context

El MVP (`reading-champions-mvp`) tiene una SPA en React + Vite con un único `styles.css` de tokens básicos, sin fuentes propias ni íconos. La pantalla de lectura dibuja el párrafo como una sola cadena y resalta la palabra actual con un `<mark>` usando `start`/`end`. El servidor guarda el texto tal cual (solo normaliza a NFC) y el seed agrega las lecturas faltantes buscándolas por título. Todo corre en Docker. Motivación: ver proposal.md.

Este diseño se basa en dos habilidades externas, leídas desde sus repositorios:
- **UI/UX Pro Max** (nextlevelbuilder): flujo producto → estilo → paleta → tipografía, y reglas priorizadas (accesibilidad y táctil críticas, contraste de 4.5:1, foco visible, 44 × 44 px, íconos SVG en lugar de emoji, etiquetas visibles, sin depender solo del color, prueba a 375/768/1024/1440 px). Su script `search.py` no está instalado en este entorno, así que se aplicaron sus reglas y sus filas de estilos a mano.
- **Skills de Emil Kowalski** (`emil-design-eng`, `animate`, `animation-performance`): curvas `ease-out` `cubic-bezier(0.23, 1, 0.32, 1)` e `ease-in-out` `cubic-bezier(0.77, 0, 0.175, 1)`, UI por debajo de 300 ms, nunca `ease-in` ni `transition: all`, solo `transform`/`opacity`, `:active` con `scale(0.97)`, hover detrás de `(hover: hover) and (pointer: fine)`, movimiento reducido "menos y más suave" y no cero, y `linear` para movimiento constante.

## Goals / Non-Goals

**Goals:**
- Un sistema visual coherente, basado en tokens, para todas las pantallas y en ambos temas.
- Una animación continua y sutil de la palabra objetivo que no afecte la lectura ni el diseño del texto.
- Imágenes por lectura servidas por la misma app, sin almacenamiento externo, compatibles con el despliegue en un solo contenedor.

**Non-Goals:**
- Librería de animación en JS: todo se hace con CSS.
- Selector de tema en la interfaz: se sigue la preferencia del sistema.
- Optimización o redimensionado de imágenes en el servidor: se limita el tamaño de subida.

## Decisions

### 1. Dirección visual

De las filas de estilo de UI/UX Pro Max se toma **Accessible & Ethical** (recomendada para educación) como base de toda la app, y **E-Ink / Paper** ("reading and writing apps") para la tarjeta de lectura: fondo papel, tinta casi negra y fuente serif para el texto largo. Se descartan Claymorphism (orientado a niños, y aquí hay adultos), Glassmorphism y Neumorphism (bajo contraste) y Kinetic Typography (desaconsejada en textos largos).

**Tipografía** (autoalojada con Fontsource, sin CDN, para que la imagen Docker sea autosuficiente):
- Lectura: **Literata** (variable), serif diseñada para lectura en pantalla. 18 px en escritorio, 17 px en móvil, interlineado 1.75 y medida máxima de 68 ch.
- Interfaz: **Atkinson Hyperlegible Next** (variable), diseñada para máxima legibilidad. Base de 16 px.

**Tokens** (CSS custom properties en `web/src/styles/tokens.css`; los componentes no usan colores en hexadecimal):

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--bg` | `#F4F1E8` | `#121210` | fondo de página |
| `--paper` | `#FFFDF7` | `#1C1B17` | tarjeta de lectura |
| `--surface` | `#FFFFFF` | `#22211D` | tarjetas de interfaz |
| `--ink` | `#1B1A17` | `#ECE8DD` | texto |
| `--ink-muted` | `#55524A` | `#B0AA9C` | texto secundario (≥ 4.5:1 sobre `--bg`) |
| `--border` | `#DAD5C8` | `#3A3832` | bordes |
| `--accent` | `#2F43B0` | `#A3B0F7` | acciones primarias y foco |
| `--on-accent` | `#FFFFFF` | `#0F1226` | texto sobre `--accent` |
| `--target-bg` | `#F7E3A3` | `#5C4A14` | fondo de la palabra objetivo |
| `--target-line` | `#B4560F` | `#F2B36B` | subrayado y halo de la palabra objetivo |
| `--ok` / `--ok-bg` | `#1D6B44` / `#E2F2E8` | `#7FD6A6` / `#163A28` | correcto |
| `--bad` / `--bad-bg` | `#A3271F` / `#FBE7E4` | `#F4A79F` / `#45201C` | incorrecto |

Los valores se verifican con un script de contraste (tarea 7.3); cualquier par de texto por debajo de 4.5:1 se ajusta antes de cerrar. Espaciado en una escala de 4 px; radios de 10 px (tarjetas) y 8 px (controles); controles de 44 px de alto como mínimo; foco con `outline: 3px solid var(--accent)` y `outline-offset: 2px`.

**Íconos:** `lucide-react` (SVG) para ayuda (`Lightbulb`), correcto (`CircleCheck`), incorrecto (`CircleX`), avanzar (`ArrowRight`), repetir (`RotateCcw`), imagen (`ImagePlus`), quitar (`Trash2`) y salir (`LogOut`). Los íconos que no tienen texto llevan `aria-label`.

### 2. Pantallas

```
Lectura (>= 768 px)                          Lectura (< 768 px)
+---------------------------------------+    +---------------------+
| Ana Perez        Lectura 1/2  [====-] |    | Ana   1/2   [===-]  |
+---------------------------------------+    +---------------------+
| El espejo de la integridad            |    | [   imagen 16:9   ] |
| Un caracter [acendrado] es  +-------+ |    | El espejo de la ... |
| la posesion mas valiosa que | img   | |    | Un caracter         |
| puede construir un ser ...  | 4:3   | |    | [acendrado] es ...  |
| ...                         +-------+ |    | ...                 |
| (texto rodea la imagen)               |    +---------------------+
+---------------------------------------+    | Que significa ...?  |
| Que significa <<acendrado>>?  85 pts  |    | ayudas / opciones   |
| (ayudas reveladas)                    |    +---------------------+
| [Lightbulb Pedir ayuda: Contexto -15] |
| ( ) opcion 1   ( ) opcion 2 ...       |
| [Responder ->]                        |
+---------------------------------------+
```

- **Encabezado:** nombre, "Lectura n de N" y una barra de progreso de palabras (con `role="progressbar"` y valores ARIA).
- **Tarjeta de lectura:** con imagen y en pantallas de 768 px o más, la imagen flota a la derecha (`float: right`, ancho `clamp(180px, 34%, 260px)`, `aspect-ratio: 4 / 3`, `object-fit: cover`) y el texto la rodea. En pantallas angostas va como bloque encima del título (`aspect-ratio: 16 / 9`, `max-height: 200px`). El `aspect-ratio` reserva el espacio antes de que cargue (CLS < 0.1). Sin imagen no se dibuja ningún contenedor.
- **Pregunta:** la palabra se repite en el título de la pregunta con color de acento y sin animación (una sola cosa en movimiento a la vez). El valor actual va como chip ("Vale 85 pts"). Las opciones son botones de radio de ancho completo, de 48 px de alto como mínimo.
- **Retroalimentación:** el panel muestra un ícono más un texto ("Correcto · +70 pts" / "Incorrecto · 0 pts"). En las opciones, la correcta lleva `CircleCheck` y la etiqueta "Respuesta correcta", y la elegida si falló lleva `CircleX` y la etiqueta "Tu respuesta". El estado no depende solo del color.
- **Ingreso:** tarjeta centrada con una marca tipográfica, etiquetas visibles y errores debajo de cada campo.
- **Resumen:** calificación grande, chips de las ayudas más usadas y una tabla de efectividad con una barra horizontal por tipo junto al porcentaje en texto. Los valores nulos se muestran como "—".
- **Administración:** misma base de tokens y una sección "Imagen" en el editor (vista previa, texto alternativo, subir, reemplazar y quitar).

### 3. Animación de la palabra objetivo

Propósito (filtro de Emil): **indicar el estado**, es decir, cuál es la palabra que se está preguntando. Es la única animación continua de la app. Se usan solo `transform` y `opacity`, aplicados a pseudo-elementos o a la propia palabra como `inline-block`, para que el texto que la rodea nunca se reacomode.

El `<mark>` recibe `data-variant="a|b|c"` según `(número de palabra − 1) mod 3`, y `data-state="active|answered"`.

| Variante | Nombre | Mecánica | Tiempo |
|---|---|---|---|
| A | Halo que respira | `::before` detrás de la palabra (fondo `--target-bg`, `inset: -2px -4px`, radio 6 px). Anima `transform: scale(0.94 → 1.06)` y `opacity: 0.65 → 1`, `alternate`. | 2400 ms, `cubic-bezier(0.77, 0, 0.175, 1)`, infinito |
| B | Subrayado que se dibuja | Fondo estático `--target-bg`. Un `::after` de 2 px (`--target-line`) en la base hace `scaleX(0.1 → 1)` con origen a la izquierda y luego `scaleX(1 → 0.1)` con origen a la derecha. Nunca llega a 0. | 2800 ms, `cubic-bezier(0.77, 0, 0.175, 1)`, infinito |
| C | Flotación | Fondo estático `--target-bg`. La palabra (`display: inline-block`) anima `translateY(0 → -3px)`, `alternate`, con una sombra `::after` cuya `opacity` baja de 0.5 a 0.2. | 2200 ms, `cubic-bezier(0.77, 0, 0.175, 1)`, infinito |

- `data-state="answered"` pone `animation: none` y deja un estilo estático (fondo más un subrayado de 2 px).
- Con `@media (prefers-reduced-motion: reduce)`, todas las variantes quedan con `animation: none`, fondo `--target-bg`, subrayado de 2 px y `font-weight: 600`. No hay desplazamiento ni escala.
- Sin `will-change`: son tres propiedades compuestas sobre un solo elemento. Solo se agregaría si las pruebas en móvil mostraran caídas de cuadros.
- Amplitudes pequeñas (3 px, ±6 %), para que sea sutil y no distraiga de la lectura.

### 4. Motion del resto de la interfaz

| Elemento | Animación | Duración y curva |
|---|---|---|
| Botones | `:active { transform: scale(0.97) }`; hover solo con `(hover: hover) and (pointer: fine)` | 160 ms `ease-out` |
| Opciones (seleccionar) | color de fondo y de borde | 150 ms `ease` |
| Ayuda revelada y panel de retroalimentación | entrada con `opacity: 0` y `translateY(6px)` → reposo, con `@starting-style` | 220 ms `cubic-bezier(0.23, 1, 0.32, 1)` |
| Barras de efectividad (resumen) | `scaleX(0.9 → 1)` y `opacity` con origen a la izquierda, escalonado de 50 ms | 280 ms `cubic-bezier(0.23, 1, 0.32, 1)` |
| Barra de progreso | `transform: scaleX(...)` al avanzar | 240 ms `cubic-bezier(0.23, 1, 0.32, 1)` |

No se animan los cambios de página ni las acciones de teclado. Con movimiento reducido se conservan los cambios de opacidad y color y se eliminan los desplazamientos. Nunca se usa `transition: all`.

### 5. Imágenes de lectura

- **Almacenamiento:** migración `002_reading_images.sql` con la tabla `reading_images (reading_id PK/FK ON DELETE CASCADE, mime_type, data BYTEA, alt_text NOT NULL, updated_at)`. Guardarlas en Postgres mantiene el despliegue en un solo contenedor más la base, sin volumen extra y con backups juntos. A 1 MB por imagen y una imagen por lectura, el volumen es despreciable. Se descartó un volumen de archivos (otro punto que respaldar) y un almacenamiento de objetos (otro servicio).
- **Subida:** `PUT /api/admin/readings/:id/image` en `multipart/form-data` (`file`, `altText`). Si no se envía archivo y la lectura ya tiene imagen, solo se actualiza el texto alternativo. Se valida el tamaño (≤ 1 MB, con `bodyLimit` en la ruta) y el tipo por **bytes mágicos**, no por la extensión ni por el `Content-Type` del cliente: PNG `89 50 4E 47 0D 0A 1A 0A`, JPEG `FF D8 FF`, WebP `RIFF????WEBP`. SVG y GIF se rechazan.
- **Quitar:** `DELETE /api/admin/readings/:id/image`. Ninguna de las dos rutas pasa por el bloqueo de contenido evaluado.
- **Servir:** `GET /api/readings/:id/image`, público, porque las imágenes no son secretas y así el `<img>` funciona sin depender de la cookie. Cabeceras: `Content-Type` guardado, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox` y `Cache-Control: public, max-age=31536000, immutable`. La URL incluye `?v=<updated_at en ms>`, así que reemplazar la imagen cambia la URL y el caché nunca muestra la anterior.
- **Exposición:** `GET /api/assessment/current` agrega `reading.image: { url, alt } | null`, y el detalle de admin agrega `image: { url, alt } | null`.
- **Seed:** las ilustraciones SVG de las lecturas iniciales (`server/seed/images/*.svg`, hechas a mano para este proyecto) se insertan directamente con `image/svg+xml`. Son contenido de confianza que no pasa por la ruta de subida. El `CHECK` de `mime_type` admite los tres formatos de subida más `image/svg+xml`.

### 6. Varios párrafos

- **Servidor:** antes de NFC, `createReading`/`updateReading` normalizan el texto: `\r\n` → `\n`, quitan espacios al final de cada línea, reducen 3 o más saltos a 2 y recortan los extremos. Los offsets se calculan sobre el texto normalizado, como ya ocurre. Las lecturas existentes (un solo párrafo, sin saltos) no cambian.
- **Web:** el texto se divide en párrafos por `\n\n`, conservando el offset de inicio de cada uno, y cada párrafo se dibuja como `<p>`. El `<mark>` se inserta en el párrafo que contiene `[start, end)`. Un salto simple dentro de un párrafo se muestra con `white-space: pre-line`.
- **Admin:** la etiqueta del campo pasa a "Texto (separa los párrafos con una línea en blanco)".

### 7. Reemplazo de la lectura del volcán

El seed mantiene una lista de títulos retirados (`RETIRED_TITLES = ["El volcán despierta"]`). Al ejecutarse, por cada título retirado: si la lectura no tiene intentos, se elimina (en cascada con sus palabras, ayudas, opciones e imagen); si tiene intentos, se desactiva y sus resultados se conservan. Después crea las lecturas faltantes como hasta ahora: "El espejo de la integridad" en posición 1 y "La biblioteca del barrio" en posición 2. Se hace en el seed y no en una migración porque es contenido, no esquema, y el seed ya es idempotente. Así funciona igual en desarrollo y en producción.

### 8. Contenido de "El espejo de la integridad"

El texto, en tres párrafos, es el indicado en la solicitud. Las ayudas y las opciones (la primera es la correcta; el seed las muestra en otro orden):

| Palabra | Radicación | Contexto | Sinonimia | Léxico | Opciones |
|---|---|---|---|---|---|
| acendrado | Del verbo *acendrar*, del latín *incendere* («encender»): purificar los metales con fuego. La terminación -ado indica el resultado: «que ya fue purificado». | El texto lo explica enseguida: «una cualidad ética pura y sin manchas que no se vende por dinero». | Parecido a: puro, intachable, depurado, impecable. | Puro y sin mancha ni defecto; dicho del carácter: limpio, sin tacha. | Puro y sin mancha · Rígido y difícil de tratar · Antiguo y heredado · Débil y fácil de convencer |
| inmarcesible | *in-* (negación) + latín *marcescere* («marchitarse») + *-ible* («que puede»): «que no puede marchitarse». | Es una integridad que se conserva «incluso cuando nadie observa»: ¿se debilita con el tiempo o permanece? | Parecido a: imperecedero, inmarchitable, perdurable. | Que no puede marchitarse; que no se debilita ni se pierde con el tiempo. | Que no se marchita ni se pierde · Que se nota a simple vista · Que cambia según la situación · Que es difícil de explicar |
| ataraxia | Del griego *a-* («sin») + *tarachē* («agitación, perturbación»): «estado sin perturbación». | El texto aclara que «no debe confundirse con la indiferencia» y que permite mantenerse fiel «frente a las adversidades». | Parecido a: serenidad, imperturbabilidad, calma interior. | Tranquilidad y serenidad del ánimo que no se altera ante las dificultades. | Serenidad que no se altera · Falta de interés por los demás · Tristeza profunda · Miedo a equivocarse |
| inexorable | *in-* (negación) + latín *exorare* («convencer con ruegos») + *-able*: «que no se deja convencer con ruegos». | La corrupción «parece avanzar de manera inexorable»: ¿avanza con pausas o sin que nada la detenga? | Parecido a: implacable, imparable, inevitable. | Que no se puede evitar ni detener; que no cede ante ruegos. | Que no se puede detener · Que avanza muy despacio · Que es fácil de evitar · Que ocurre por casualidad |
| aquiescencia | Del latín *acquiescere*: *ad-* («hacia») + *quiescere* («descansar, quedarse tranquilo»): «quedarse conforme con algo». | La fortaleza está en «no conceder» esto a lo que contradice nuestros valores: ¿qué es lo que no debemos dar? | Parecido a: consentimiento, aprobación, conformidad. | Consentimiento o aprobación que se da a algo. | Consentimiento o aprobación · Rechazo firme · Duda o indecisión · Crítica pública |

Las cinco palabras aparecen una sola vez en el texto, así que la regla de la primera aparición no genera ambigüedad. Ilustraciones: un espejo ovalado con marco y un reflejo de luz ("Un espejo antiguo que refleja una luz serena") y una estantería con libros ("Estantería con libros de colores en una biblioteca de barrio").

### 9. Logo

- **Concepto** (de la imagen de referencia del usuario): una persona sentada de perfil, con las rodillas flexionadas, sosteniendo un libro abierto frente a la cara, en silueta de un solo color.
- **Origen:** la referencia es una foto de stock con marca de agua (Dreamstime), así que no se vectoriza ni se calca. Se dibuja una silueta nueva a mano en SVG, con su propia pose (ángulo de piernas, brazos y libro) y formas geométricas simplificadas, para que el logo sea original y libre de licencias.
- **Archivos:** `web/src/assets/logo.svg` (símbolo, `viewBox` cuadrado, un solo `path` con `fill="currentColor"` para heredar `--accent` y adaptarse al tema oscuro) y `web/public/favicon.svg` (el mismo símbolo con color fijo `#2F43B0`, legible a 16 px).
- **Uso:** el símbolo más el nombre "Reading Champions" en Atkinson Hyperlegible en la pantalla de ingreso (48 px de alto), en el encabezado de lectura y resumen (28 px) y en el panel de administración. Como es decorativo junto al nombre, lleva `aria-hidden="true"`; solo, lleva `role="img"` y `aria-label="Reading Champions"`.
- **Legibilidad:** se comprueba a 16, 28 y 48 px y en ambos temas. A 16 px la silueta debe seguir leyéndose como "persona leyendo", así que se evitan detalles finos como dedos o pliegues.

### 10. Ajuste posterior: cuaderno minimalista (aplicado a pedido del usuario)

Revisión con la habilidad *frontend-design*, que señala el fondo crema con acento terracota/ámbar como la paleta propia de Anthropic. Este ajuste reemplaza la tabla de tokens de la decisión 1 (los valores vigentes están en `web/src/styles/tokens.css`):
- **Paleta fría de cuaderno:** escritorio gris azulado, hoja blanca, tinta negro-azulada, acento azul bolígrafo. Se eliminan los cremas, ámbares, naranjas y marrones de la interfaz y de las ilustraciones del seed (incluido `#5c4a14`). El resaltado de la palabra objetivo pasa a azul lavanda y los avisos a un gris neutro.
- **Hoja de cuaderno:** la tarjeta de lectura tiene renglones azules cada 32 px (`--line`) y un margen rosa. Título, párrafos y espacios entre párrafos usan ese alto de renglón para que cada línea caiga sobre su pauta; en móvil la imagen ocupa 6 renglones exactos.
- **Minimalismo:** sin sombras en las tarjetas, radios menores y sin flechas decorativas en los botones. Las tipografías no cambian.
- **Botón de ayuda:** más grande (52 px), con borde punteado y un bombillo con animación continua (balanceo con pausa y halo, 2.4 s). Se desactiva con movimiento reducido. El logo crece (40 px en encabezados, 80 px en el ingreso).
- **Ayudas sin identificar:** el botón dice "Pedir ayuda N" y la ayuda revelada "Ayuda N". La API del participante ya no envía el nombre ni el costo de la ayuda, y la retroalimentación tras un fallo dice "Significado:" en lugar de "Léxico:". El resumen final y el panel de administración siguen mostrando los tipos (el resumen lo exige la spec `assessment-summary`).
- **Seed:** actualiza sus propias ilustraciones SVG si cambiaron. Una imagen subida por el administrador nunca se reemplaza, porque la subida no acepta SVG.

## Risks / Trade-offs

- [El movimiento continuo puede distraer de la lectura] → Amplitudes pequeñas, una sola palabra animada a la vez, el título de la pregunta sin animación y respeto de `prefers-reduced-motion`.
- [Desactivar la lectura del volcán en una base con resultados cambia la ronda de quienes ya terminaron: la nueva lectura activa les queda pendiente] → Es el comportamiento definido por la spec de rondas (las lecturas activas en ese momento); sus resultados del volcán se conservan. Queda anotado en el README.
- [Imágenes en Postgres crecen la base y los backups] → Límite de 1 MB y una imagen por lectura. Si en el futuro hay muchas lecturas, se migran a almacenamiento de objetos sin cambiar la API.
- [`@starting-style` no existe en navegadores antiguos] → Mejora progresiva: sin soporte, el elemento aparece sin animación.
- [Fuentes autoalojadas aumentan el bundle] → Se usan las variantes variables con subconjunto latino (unos 100 KB en total, en caché tras la primera visita).

## Migration Plan

1. Archivar `reading-champions-mvp` para que exista el spec principal de `reading-admin` (requisito para archivar este cambio).
2. Desplegar: la migración `002` se aplica al arrancar el contenedor.
3. Ejecutar `bun run seed`: retira o desactiva "El volcán despierta" y agrega "El espejo de la integridad" con imagen. Agrega la imagen a "La biblioteca del barrio" si no la tiene.
4. Rollback: volver a la imagen anterior. La tabla `reading_images` no afecta al código anterior. La lectura nueva se puede desactivar desde el panel y la del volcán reactivar, si se conservó.
