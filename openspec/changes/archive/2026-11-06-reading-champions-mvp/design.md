# Design

## Context

El repositorio no tiene código: este cambio crea la aplicación completa (ver proposal.md, "Why"). Las reglas de comportamiento están en las specs de `participant-identity`, `reading-assessment`, `assessment-summary` y `reading-admin`; este documento explica cómo implementarlas.

La restricción que guía todo el diseño es que **el navegador no es confiable**. Puntos, tiempos, orden de ayudas y respuestas correctas viven solo en el servidor.

## Goals / Non-Goals

**Goals:**
- Un servidor que sea la única autoridad, con una API pequeña y orientada a acciones (presentar, pedir ayuda, responder) en lugar de un CRUD genérico de intentos.
- Un modelo de datos que permita auditar cada acción del participante y recalcular cualquier estadística a partir de ella.
- Lógica de puntuación y de estadísticas en funciones puras, fáciles de probar sin base de datos.

**Non-Goals:**
- HTTPS o escalado horizontal (el MVP corre en un solo proceso). El despliegue se limita a la imagen Docker y al `docker-compose.yml` (decisión 12).
- Internacionalización: la interfaz está solo en español.
- Recuperación de cuentas o gestión de varios administradores desde la interfaz.

## Decisions

### 1. Estructura: dos paquetes en un mismo repositorio

```
Reading_Champions/
  server/            Bun + Hono, API JSON, migraciones, seed
    src/
      domain/        reglas puras: scoring, stats, word-locator
      db/            conexion, migraciones SQL, consultas
      routes/        participant, assessment, admin
      auth/          sesiones de participante y de admin
    migrations/      001_init.sql, ...
    seed/            dos lecturas iniciales + admin
  web/               React + Vite (SPA)
    src/
      pages/         Ingreso, Lectura, Resumen, Admin/*
      api/           cliente fetch tipado
  Dockerfile         imagen multi-etapa (dev y produccion)
  docker-compose.yml Postgres + servicios de desarrollo y de produccion
```

Se usan workspaces de Bun para compartir tipos de la API (`shared/` o tipos exportados desde `server`). Se descartó Next.js porque traería un segundo servidor que competiría con Bun.

### 2. Servidor: Bun + Hono + postgres.js con SQL explícito

Hono es pequeño, corre de forma nativa en Bun y su middleware cubre cookies y validación. Las consultas usan `postgres` (postgres.js) con SQL escrito a mano y migraciones en archivos `.sql` numerados, aplicadas por un script propio que registra lo aplicado en una tabla `schema_migrations`. Se descartó un ORM (Drizzle/Prisma) porque el esquema es pequeño y las consultas críticas, como la actualización condicional de ayudas o la agregación del resumen, se leen mejor en SQL. Elysia es una alternativa válida; se prefirió Hono por madurez y portabilidad.

### 3. Modelo de datos

```
participants                        admins
  id PK                               id PK
  document_number UNIQUE              username UNIQUE
  full_name     (primer registro)     password_hash
  created_at                          created_at

readings
  id PK, title, content, position, is_active (default false), created_at

target_words
  id PK, reading_id FK, word, start_offset, end_offset
  UNIQUE(reading_id, lower(word))

hints
  id PK, target_word_id FK, level SMALLINT (1..4), content
  UNIQUE(target_word_id, level)

answer_options
  id PK, target_word_id FK, text, is_correct, position
  indice UNIQUE parcial (target_word_id) WHERE is_correct

reading_attempts
  id PK, participant_id FK, reading_id FK
  round               (ronda del participante: 1, 2, ... al repetir)
  attempt_number      (por lectura; 1 = oficial)
  status              in_progress | completed
  score, max_score, started_at, completed_at
  UNIQUE(participant_id, reading_id, attempt_number)

word_responses                      (una fila por palabra presentada)
  id PK, reading_attempt_id FK, target_word_id FK
  hint_level   SMALLINT 0..4        (nivel alcanzado; solo ayudas pedidas)
  presented_at, answered_at
  selected_option_id FK NULL, is_correct NULL, points NULL
  UNIQUE(reading_attempt_id, target_word_id)

hint_requests                       (auditoria y tiempos)
  id PK, word_response_id FK, level, delivered_at
  UNIQUE(word_response_id, level)
```

- `is_official` no se guarda: se deriva de `attempt_number = 1`, así no puede quedar inconsistente.
- La penalización no va en `hints`. Por la spec es una regla fija del juego (15/15/30/20) y vive en `domain/scoring.ts`. Guardarla por fila permitiría valores distintos entre palabras, algo que la spec no contempla.
- Los offsets de `target_words` se calculan en el servidor al guardar, nunca los envía el admin.
- El Léxico que se muestra tras un fallo no crea un `hint_request`. Así el conteo de ayudas lo excluye sin lógica especial.

### 4. Ubicación de la palabra objetivo

`locateTargetWord(content, word)` busca la primera coincidencia de palabra completa sin distinguir mayúsculas, usando una regex Unicode con lookarounds de letra: `(?<!\p{L})palabra(?!\p{L})` con las banderas `iu`. `\b` no sirve porque en JavaScript no reconoce letras acentuadas: "camión" partiría en "cami" + "ón". La palabra se escapa antes de construir la regex. El texto se normaliza a NFC al guardar para que las tildes compuestas coincidan.

### 5. Máquina de estados por palabra y concurrencia

```
 presentada(hint_level=0) --ayuda--> 1 --> 2 --> 3 --> 4
        |                            |     |     |     |
        +----------- responder ------+-----+-----+-----+--> cerrada
```

Pedir ayuda es una actualización condicional en una transacción:

```sql
UPDATE word_responses SET hint_level = hint_level + 1
 WHERE id = $1 AND answered_at IS NULL AND hint_level < 4
RETURNING hint_level;
```

seguida del `INSERT` en `hint_requests`. Responder usa `WHERE answered_at IS NULL`. Así un doble clic o dos pestañas no pueden duplicar una ayuda ni responder dos veces: la segunda solicitud no afecta filas y recibe 409.

La palabra "actual" es la `word_response` sin responder del intento. Si no existe, se crea para la siguiente `target_word` por `start_offset`, y `presented_at` se fija en ese momento. Presentar es idempotente: si la palabra ya fue presentada, se reutiliza su `presented_at`, de modo que recargar la página no reinicia el tiempo.

### 6. Puntuación: funciones puras

```ts
PENALTIES = { 1: 15, 2: 15, 3: 30, 4: 20 }
pointsFor(hintLevel, isCorrect) = isCorrect ? 100 - sum(PENALTIES[1..hintLevel]) : 0
```

El cliente solo envía `selected_option_id`. El esquema de validación de la ruta es estricto, así que cualquier campo extra (`score`, `hintLevel`) se descarta.

### 7. API

```
POST /api/participants/session        { documentNumber, fullName } -> estado actual
GET  /api/assessment/current          lectura actual + palabra actual + ayudas reveladas
POST /api/assessment/hint             -> { level, type, content }
POST /api/assessment/answer           { optionId } -> { isCorrect, points,
                                         correctOptionId, lexico? , next }
GET  /api/assessment/summary          resumen (solo si todo lo activo esta completo)

POST /api/admin/session               { username, password }
CRUD /api/admin/readings[/:id]        + /target-words, /hints, /options
POST /api/admin/readings/:id/activate | /deactivate
```

Las rutas de evaluación no reciben un id de palabra: operan siempre sobre la palabra actual del participante. Así se elimina por diseño el caso "saltar pregunta" de la spec. El servidor nunca serializa `is_correct` ni ayudas por encima de `hint_level`. `correctOptionId` y el Léxico solo se devuelven en la respuesta de `answer`.

### 8. Sesiones

- **Participante:** cookie `HttpOnly`, `SameSite=Lax`, firmada con HMAC (secreto en variable de entorno) y con el `participant_id`. No hay contraseña, así que la cookie solo evita que el cliente se haga pasar por otro id; el documento sigue siendo la única credencial.
- **Admin:** cookie separada con `role=admin`, contraseña verificada con `Bun.password.verify` (argon2id). El primer admin se crea con el seed a partir de `ADMIN_USERNAME` y `ADMIN_PASSWORD`.
- Middleware `requireParticipant` y `requireAdmin` por grupo de rutas.

### 9. Ciclo de intentos y repeticiones

Al iniciar sesión, el servidor determina la "ronda" del participante:

1. Si hay un intento `in_progress`, se retoma.
2. Si no, se busca la primera lectura activa (por `position`) sin intento completado en la ronda actual.
3. Si todas las lecturas activas tienen intento completado, se muestra el resumen. Desde ahí el participante puede "Repetir", lo que crea intentos con `attempt_number = max + 1` empezando por la primera lectura activa.

Ronda actual = para cada lectura activa, el intento más reciente. El resumen oficial usa `attempt_number = 1` de cada lectura activa. El resumen de repetición usa el intento más reciente de cada una e incluye el oficial para el aviso.

### 10. Estadísticas del resumen

`domain/stats.ts` recibe la lista de `word_responses` con sus `hint_requests` y calcula:
- Total: suma de `points` y de `max_score`.
- Uso por tipo: número de `hint_requests` por nivel, ordenado de mayor a menor.
- Efectividad por tipo: agrupa por `hint_level > 0` (la última ayuda pedida es igual al nivel alcanzado, porque el orden es fijo) y calcula aciertos sobre total.
- Tiempo por tipo: promedio de `answered_at - delivered_at(hint_level)` del grupo.

Los tipos sin respuestas atribuidas devuelven `null`, no 0, y la interfaz los muestra como "—".

### 11. Frontend

SPA con React Router (rutas `/`, `/lectura`, `/resumen`, `/admin/*`) y TanStack Query para el estado del servidor. El estado del juego no se guarda en el cliente: cada acción devuelve el nuevo estado y la interfaz lo dibuja. La lectura muestra el párrafo completo y resalta la palabra actual usando `start_offset`/`end_offset`. Debajo van las ayudas reveladas en orden, el botón "Pedir ayuda" con el costo de la siguiente y las opciones.

## Risks / Trade-offs

- [Sin contraseña, cualquiera que conozca un documento puede presentar por esa persona] → Aceptado para el MVP según lo decidido. La cookie firmada evita suplantar ids, y el diseño de sesión permite añadir contraseña u OTP después sin cambiar el modelo de intentos.
- [El tiempo incluye la latencia de red y las pausas fuera de la pestaña] → Aceptado. Solo se compara dentro del mismo participante y es suficiente para el MVP.
- [Cambiar las penalizaciones requiere desplegar código] → Coherente con la spec, que las fija. Si se vuelven configurables, se pasan a una tabla de configuración.
- [Desactivar una lectura altera qué incluye el resumen] → El resumen se calcula siempre sobre las lecturas activas en ese momento; los intentos de las inactivas se conservan pero no se muestran.
- [Lookbehind Unicode en regex] → Bun (JavaScriptCore) lo soporta. Se cubre con pruebas de palabras acentuadas y con ñ.

## Migration Plan

Proyecto nuevo, sin migración de datos. Todo corre en Docker (decisión 12): en desarrollo, `docker compose --profile dev up`; en despliegue, `docker compose --profile prod up -d --build`, que aplica las migraciones al arrancar, y `docker compose --profile prod run --rm app bun run seed` para la carga inicial. El rollback consiste en volver a la imagen anterior y, si hace falta, recrear la base de datos.

### 12. Todo en Docker

No se instala nada en el host: Bun, las dependencias y Postgres viven en contenedores (en esta máquina, Docker corre bajo WSL). Un solo `Dockerfile` multi-etapa sirve para desarrollo (`dev`: Bun con el código montado) y para producción (`prod`: construye la SPA y el servidor de Hono la sirve junto con la API, en un único contenedor). `docker-compose.yml` usa perfiles: `db` siempre; `deps`, `server` y `web` (Vite) con `--profile dev`; `app` con `--profile prod`. `node_modules` vive en volúmenes de Docker para no mezclar binarios de Windows y Linux. Las pruebas crean una base temporal por suite en el mismo Postgres.

### 13. Ajustes surgidos en la implementación

- `reading_attempts.round` agrupa las lecturas de una ronda. Sin él, al repetir la primera lectura la ronda parecería completa (las demás lecturas aún tienen su intento anterior completado) y el resumen aparecería antes de tiempo. `attempt_number` sigue contando por lectura, así que una lectura activada después recibe igualmente su intento oficial (1).
- `POST /api/assessment/hint` recibe `{ level }`, el nivel que el cliente espera revelar. Si ya está revelado, devuelve la misma ayuda sin avanzar; si es el siguiente, avanza; en otro caso, 409. Así un doble clic o dos pestañas solo avanzan un nivel. El puntaje sigue calculándose con el registro del servidor.
- Las acciones de evaluación de un participante se serializan con un advisory lock de Postgres por participante, dentro de la transacción.

## Open Questions

- Textos definitivos de las dos lecturas iniciales y de sus ayudas: el seed usa contenido de ejemplo que el administrador puede reemplazar desde el panel antes de activar.
