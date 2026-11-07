# Proposal

## Why

Estudiantes y adultos necesitan mejorar su comprensión lectora, en particular el vocabulario que todavía no dominan. Reading Champions ofrece lecturas cortas en las que se evalúan palabras objetivo con ayudas graduales que restan puntos, para medir cuánto apoyo necesita cada persona y qué tipo de ayuda le funciona mejor. El proyecto parte de cero: este cambio define el MVP completo.

## What Changes

- Nueva SPA en React + Vite para participantes y administradores.
- Nuevo servidor ligero en Bun con base de datos Postgres. El servidor es la única autoridad sobre puntos, tiempos y orden de las ayudas, y nunca envía al navegador la respuesta correcta ni ayudas que no se han pedido.
- Identificación de participantes con número de documento y nombre completo, sin contraseña (MVP). El documento es la llave única y se conserva el primer nombre registrado.
- Evaluación de lecturas (párrafos) con 1..N palabras objetivo de 100 puntos cada una. Solo se evalúa la primera aparición de cada palabra, sin distinguir mayúsculas. Las preguntas se presentan una a la vez, en orden de aparición, en formato de opción múltiple con una única respuesta correcta.
- Cuatro ayudas opcionales en orden fijo: Radicación (−15), Contexto (−15), Sinonimia (−30) y Léxico (−20), de modo que el valor mínimo de un acierto es 20. Una respuesta incorrecta vale 0, muestra el Léxico y resalta la opción correcta. Toda palabra respondida queda cerrada.
- Las lecturas se pueden repetir, pero solo el primer intento es oficial.
- Resumen al terminar todas las lecturas activas: calificación total, ayudas más usadas, efectividad por tipo de ayuda y tiempo promedio. En una repetición se muestra el resumen del último intento con un aviso de que la calificación oficial es la del primero.
- Panel de administración protegido con contraseña para crear lecturas, palabras objetivo, ayudas y opciones, y para activar o desactivar lecturas.
- Carga inicial (seed) con dos lecturas.

## Capabilities

### New Capabilities

- `participant-identity`: ingreso de participantes por número de documento y nombre, reglas de unicidad y reanudación.
- `reading-assessment`: flujo de evaluación de una lectura: presentación de preguntas, ayudas secuenciales, respuesta, puntuación autoritativa en el servidor, medición de tiempos e intentos oficiales y de práctica.
- `assessment-summary`: resumen final con calificación, uso de ayudas, efectividad por tipo y tiempos.
- `reading-admin`: autenticación del administrador y gestión del contenido (lecturas, palabras objetivo, ayudas, opciones, activación) con sus validaciones de publicación.

### Modified Capabilities

Ninguna (proyecto nuevo).

## Impact

- Código nuevo: `web/` (React + Vite) y `server/` (Bun + Hono), con esquema y migraciones de Postgres.
- Dependencias nuevas: Bun, Hono, un driver de Postgres, React, Vite y una librería de hashing de contraseñas (la incorporada en Bun).
- Infraestructura: una instancia de Postgres (local con Docker en desarrollo).
- Fuera de alcance: contraseña o login para participantes, selección libre de palabras por el usuario, rankings entre usuarios, generación de contenido con IA y más de un administrador con roles distintos.
