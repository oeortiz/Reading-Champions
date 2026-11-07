# Tasks

## 1. Estructura y entorno

- [x] 1.1 Crear el workspace de Bun con los paquetes `server/` y `web/`, y un `package.json` raíz con scripts `dev`, `test`, `migrate` y `seed`; verificar que `bun install` termina sin errores
- [x] 1.2 Agregar `Dockerfile` multi-etapa (dev/prod), `docker-compose.yml` con perfiles (Postgres siempre; `deps`/`server`/`web` en dev; `app` en prod) y `.env.example` (`DATABASE_URL`, `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`); verificar que `docker compose up -d db` deja Postgres aceptando conexiones
- [x] 1.3 Inicializar `server/` con Hono, postgres.js y un endpoint `GET /api/health` que consulte la base; verificar que responde `200` con `bun run dev`
- [x] 1.4 Inicializar `web/` con Vite + React + TypeScript, React Router y TanStack Query, con proxy `/api` hacia el servidor; verificar que la página carga y muestra el resultado de `/api/health`

## 2. Base de datos

- [x] 2.1 Escribir el runner de migraciones (tabla `schema_migrations`, aplica `.sql` en orden, en transacción); verificar con una prueba que aplicar dos veces no repite migraciones
- [x] 2.2 Escribir `001_init.sql` con todas las tablas, `UNIQUE`, el índice parcial de opción correcta y los `CHECK` (`level` 1..4, `hint_level` 0..4) del design; verificar con pruebas que la base rechaza dos opciones correctas, un nivel 5 y un documento duplicado
- [x] 2.3 Crear un helper de pruebas que levante una base limpia por suite; verificar que las pruebas de 2.1 y 2.2 corren con `bun test` de forma aislada

## 3. Reglas de dominio puras

- [x] 3.1 Implementar `domain/scoring.ts` (`PENALTIES`, `pointsFor`); verificar con pruebas los valores 100/85/70/40/20 al acertar y 0 al fallar en cualquier nivel
- [x] 3.2 Implementar `domain/word-locator.ts` (primera coincidencia de palabra completa, sin mayúsculas, Unicode, NFC); verificar con pruebas "Banco"/"banco", "desbancar", "camión", "niño", palabras con caracteres especiales de regex y palabra ausente
- [x] 3.3 Implementar `domain/stats.ts` (total, uso por tipo ordenado, efectividad con fallos en el denominador, tiempo promedio desde la entrega de la última ayuda, `null` para tipos sin datos); verificar con pruebas cada escenario de la spec `assessment-summary`, incluido "Léxico por fallo excluido"

## 4. Identidad del participante

- [x] 4.1 Implementar cookies firmadas (HMAC) y los middleware `requireParticipant` / `requireAdmin`; verificar con pruebas que una cookie alterada o ausente devuelve `401`
- [x] 4.2 Implementar `POST /api/participants/session` (validación con recorte de espacios, alta por documento, conservar el primer nombre); verificar con pruebas de integración los escenarios de la spec `participant-identity`

## 5. Administración de contenido

- [x] 5.1 Implementar `POST /api/admin/session` con `Bun.password` y un mensaje de error genérico; verificar con pruebas el ingreso válido, el inválido y el rechazo con cookie de participante
- [x] 5.2 Implementar el CRUD de lecturas (se crean inactivas, con `position`); verificar con pruebas de integración la creación, la edición y el listado
- [x] 5.3 Implementar el alta y la edición de palabras objetivo con cálculo de offsets mediante `word-locator`, rechazando palabras ausentes y duplicadas; verificar con pruebas ambos rechazos y los offsets guardados
- [x] 5.4 Implementar la gestión de las cuatro ayudas y de 2 a 6 opciones con exactamente una correcta; verificar con pruebas el rechazo sin correcta, con dos correctas y con menos de 2 o más de 6
- [x] 5.5 Implementar activar y desactivar con validación de completitud que indique la palabra incompleta; verificar con pruebas la activación rechazada y la desactivación que conserva los intentos
- [x] 5.6 Bloquear la edición de texto, palabras y opciones en lecturas con intentos registrados; verificar con una prueba que devuelve el error que indica que ya hay resultados
- [x] 5.7 Crear el seed con un admin (desde variables de entorno) y dos lecturas activas y completas; verificar con una prueba que, tras `bun run seed` sobre una base vacía, existen dos lecturas activas que pasan la validación de 5.5

## 6. Flujo de evaluación (servidor)

- [x] 6.1 Implementar la resolución de ronda y lectura actual (retomar `in_progress`, siguiente lectura activa por `position`, `attempt_number` creciente al repetir); verificar con pruebas la secuencia lectura 1 → lectura 2 → resumen → repetir
- [x] 6.2 Implementar `GET /api/assessment/current` con presentación idempotente de la palabra actual (`presented_at` fijo) y serialización segura (sin `is_correct` ni ayudas no pedidas); verificar con pruebas que recargar no cambia `presented_at` y que la respuesta no contiene esos campos
- [x] 6.3 Implementar `POST /api/assessment/hint` con actualización condicional e inserción en `hint_requests`; verificar con pruebas el orden Radicación → Contexto → Sinonimia → Léxico, el `409` tras el Léxico y que dos solicitudes concurrentes solo avanzan un nivel
- [x] 6.4 Implementar `POST /api/assessment/answer` (validación estricta de solo `optionId`, puntaje con `scoring`, cierre de la palabra, devolución de `correctOptionId` y del Léxico al fallar sin registrarlo como ayuda, cierre del intento con `score`/`max_score` al terminar); verificar con pruebas los escenarios de la spec `reading-assessment`, incluidos el campo `score` enviado por el cliente y el segundo intento de respuesta
- [x] 6.5 Implementar `GET /api/assessment/summary` (oficial = `attempt_number` 1; en repetición, último intento más el aviso con la calificación oficial; `409` si quedan lecturas activas pendientes); verificar con pruebas de integración el resumen oficial y el de repetición con 340 frente a 410

## 7. Interfaz del participante

- [x] 7.1 Construir la pantalla de ingreso (documento y nombre con validación) que redirige según el estado devuelto; verificar a mano que un documento nuevo inicia la lectura 1 y uno con todo completado va al resumen
- [x] 7.2 Construir la pantalla de lectura: párrafo con la palabra actual resaltada por offsets, ayudas reveladas en orden, botón "Pedir ayuda" con el costo de la siguiente y opciones de respuesta; verificar a mano que solo se resalta la primera aparición y que el botón desaparece tras el Léxico
- [x] 7.3 Mostrar la retroalimentación de la respuesta (puntos; al fallar, Léxico y opción correcta resaltada) y el avance a la siguiente palabra o lectura; verificar a mano un acierto y un fallo
- [x] 7.4 Construir la pantalla de resumen (calificación, ayudas más usadas, tabla de efectividad y tiempos con "—" para tipos sin datos, aviso en repeticiones y botón "Repetir"); verificar a mano con un participante que repitió

## 8. Interfaz de administración

- [x] 8.1 Construir el login de admin y el listado de lecturas con su estado y su orden; verificar a mano el ingreso y que las credenciales inválidas muestran el error genérico
- [x] 8.2 Construir el editor de lectura (texto, palabras objetivo, cuatro ayudas y opciones con la correcta marcada) que muestre los errores de validación del servidor; verificar a mano los rechazos de palabra ausente y de opción correcta faltante
- [x] 8.3 Agregar los controles de activar y desactivar, con el mensaje de palabra incompleta y el bloqueo de edición en lecturas con intentos; verificar a mano ambos casos

## 9. Integración final

- [x] 9.1 Recorrido de punta a punta sobre una base recién sembrada: un participante completa las dos lecturas con una mezcla de aciertos, fallos y ayudas, y el resumen coincide con el cálculo manual; luego repite y aparece el aviso con la calificación oficial
- [x] 9.2 Revisión de seguridad de la API: con DevTools, confirmar que ninguna respuesta de la evaluación expone `is_correct` ni ayudas no pedidas antes de responder, y que las rutas de admin rechazan a los participantes
- [x] 9.3 Escribir `README.md` con los requisitos previos y los comandos de arranque (`docker compose`, `migrate`, `seed`, `dev`, `test`); verificar siguiendo el README desde un clon limpio

## Workflow follow-up

- Archivar el cambio con `/opsx:archive` cuando la implementación esté revisada.
