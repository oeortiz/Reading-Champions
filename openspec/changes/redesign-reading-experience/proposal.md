# Proposal

## Why

El MVP funciona, pero su interfaz es básica: la palabra que se está evaluando solo se distingue por un resaltado estático, las lecturas son bloques de texto sin apoyo visual y el diseño no sigue un sistema coherente. Este cambio rediseña la experiencia para que el participante tenga siempre presente sobre qué palabra responde, para que cada lectura tenga una imagen que la acompañe y para cambiar la lectura del volcán por una de mayor nivel de vocabulario.

## What Changes

- Rediseño visual completo de la SPA (ingreso, lectura, resumen y administración). Sigue las reglas de la habilidad *UI/UX Pro Max*: estilo "Accessible & Ethical" con tratamiento "E-Ink / Paper" para el texto de lectura, tokens semánticos, contraste mínimo, foco visible, objetivos táctiles de 44 px e íconos SVG.
- La palabra objetivo actual tiene una animación sutil y continua, con 3 variantes que se alternan entre palabras. Respeta `prefers-reduced-motion` y no mueve el resto del texto. La motion sigue las reglas de la habilidad de Emil Kowalski: solo `transform` y `opacity`, curvas definidas y retroalimentación de interacción menor a 300 ms.
- Cada lectura puede tener una imagen ilustrativa con texto alternativo. Va junto al texto en pantallas anchas y encima en pantallas angostas, sin tapar el contenido. Si no tiene imagen, la lectura se muestra sin hueco.
- El administrador puede subir, reemplazar y quitar la imagen de una lectura (PNG, JPEG o WebP, hasta 1 MB, con texto alternativo obligatorio), también en lecturas que ya tienen resultados.
- Las lecturas pueden tener varios párrafos, que se conservan al mostrarlas.
- La lectura "El volcán despierta" se reemplaza por "El espejo de la integridad", con las palabras objetivo acendrado, inmarcesible, ataraxia, inexorable y aquiescencia, cada una con sus 4 ayudas y sus opciones. En bases existentes, la lectura del volcán se elimina si no tiene intentos y se desactiva, conservando sus resultados, si los tiene.
- Las dos lecturas iniciales incluyen una ilustración propia en SVG.
- Logo propio en SVG: silueta de una persona sentada leyendo un libro, dibujada desde cero (la imagen de referencia es de stock con marca de agua y no se calca). Se usa en el ingreso, en los encabezados, en el panel de administración y como favicon.

## Capabilities

### New Capabilities

- `reading-presentation`: cómo se presenta una lectura al participante, incluyendo la animación de la palabra objetivo, la imagen, los párrafos y los requisitos visuales de accesibilidad.

### Modified Capabilities

- `reading-admin`: la gestión de lecturas acepta varios párrafos; se agrega la gestión de la imagen de la lectura; las lecturas iniciales cambian (se reemplaza la del volcán).

Requisito de orden: `reading-admin` existe todavía solo en el cambio `reading-champions-mvp`, que no está archivado. Ese cambio debe archivarse antes que este, para que exista el spec principal que estas deltas modifican.

## Impact

- `web/`: nuevos estilos y componentes de todas las pantallas, editor de imagen en administración y dependencias nuevas para las fuentes autoalojadas (Fontsource) y los íconos (Lucide).
- `server/`: migración `002` (tabla de imágenes), endpoints para subir, quitar y servir imágenes, campos de imagen en el estado de la evaluación, normalización de saltos de línea en el texto y seed con el contenido nuevo.
- Sin cambios en las reglas de puntaje, ayudas, intentos ni resumen.
- Fuera de alcance: ilustraciones generadas con IA, galería de imágenes, recorte de imágenes en el navegador y animaciones en las palabras que no son la actual.
