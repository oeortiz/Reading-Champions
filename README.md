# Reading Champions

Aplicación para mejorar la comprensión lectora: el participante lee párrafos cortos y responde, en opción múltiple, el significado de palabras objetivo. Puede pedir ayudas en orden fijo (Radicación −15, Contexto −15, Sinonimia −30, Léxico −20) y al terminar ve su calificación, las ayudas que más usó y cuáles le resultaron más efectivas. El servidor calcula todos los puntos y tiempos; el navegador nunca recibe la respuesta correcta antes de responder.

- `web/`: SPA en React + Vite.
- `server/`: API en Bun + Hono sobre Postgres (migraciones en `server/migrations`, carga inicial en `server/seed`).
- Todo corre en Docker: no hace falta instalar Bun, Node ni Postgres en la máquina.

## Requisitos previos

- Docker con Docker Compose v2 (en Windows, Docker dentro de WSL 2 o Docker Desktop).
- En Windows, ejecuta los comandos desde una terminal de WSL ubicada en la carpeta del proyecto.

## Configuración

```sh
cp .env.example .env
```

Cambia como mínimo `SESSION_SECRET` (una cadena larga y aleatoria) y `ADMIN_PASSWORD` antes de desplegar. Si la app se sirve por HTTPS, pon `COOKIE_SECURE=true`.

## Despliegue (producción)

Un solo contenedor sirve la API y la SPA compilada, junto a Postgres:

```sh
docker compose --profile prod up -d --build          # construye, aplica migraciones y arranca
docker compose --profile prod run --rm app bun run seed   # crea el admin y las 2 lecturas iniciales
```

La app queda en `http://localhost:3000` (cambia el puerto con `APP_PORT` en `.env`). El panel de administración está en `/admin`, con el usuario y la contraseña de `ADMIN_USERNAME` y `ADMIN_PASSWORD`.

Las lecturas iniciales son "El espejo de la integridad" y "La biblioteca del barrio", cada una con su ilustración (`server/seed/images/`). El seed se puede repetir: actualiza la contraseña del admin, agrega las lecturas iniciales que falten y la imagen a las que no la tengan.

**Lectura retirada:** "El volcán despierta" ya no es una lectura inicial. Al ejecutar el seed sobre una base que la tenga, se **elimina** si nadie la ha hecho, o se **desactiva** conservando sus resultados si tiene intentos. En ese segundo caso, quienes ya habían terminado las lecturas verán pendiente "El espejo de la integridad", porque el resumen se calcula sobre las lecturas activas.

Las migraciones se aplican solas cada vez que arranca el contenedor; para aplicarlas a mano: `docker compose --profile prod run --rm app bun run migrate`.

Para actualizar tras un cambio de código: `docker compose --profile prod up -d --build`. Los datos viven en el volumen `pgdata`.

## Desarrollo

```sh
docker compose --profile dev up -d            # Postgres, API (:3000) y Vite (:5173)
docker compose exec server bun run seed       # admin y lecturas iniciales
```

Abre `http://localhost:5173`. Vite reenvía `/api` al servidor.

- **Migraciones:** `docker compose exec server bun run migrate` (también se aplican al arrancar `server`).
- **Pruebas:** `docker compose exec server bun run test`. Cada suite crea y borra su propia base temporal en el mismo Postgres.
- **Typecheck del servidor:** `docker compose exec server sh -c "cd server && bunx tsc --noEmit"`.
- **Build de la SPA:** `docker compose exec web sh -c "cd web && bun run build"`.
- **Dependencias nuevas:** edita el `package.json` correspondiente y ejecuta `docker compose --profile dev run --rm deps`. `node_modules` vive en volúmenes de Docker, no en tu disco.

> **Windows y recarga automática:** si el proyecto está en `C:\` (`/mnt/c` dentro de WSL), los cambios de archivos no llegan como eventos a los contenedores. Vite usa polling y recarga igual, pero el servidor no: reinícialo con `docker compose restart server` después de cambiar código del servidor, o clona el proyecto dentro del sistema de archivos de WSL (por ejemplo `~/proyectos`) para que `bun --watch` funcione.

## Reglas principales

- Cada palabra objetivo vale 100 puntos. Con ayudas, un acierto vale 85, 70, 40 o 20; una respuesta incorrecta vale 0 y muestra el Léxico y la opción correcta.
- Solo se evalúa la primera aparición de cada palabra objetivo en el texto, sin distinguir mayúsculas.
- El participante se identifica con su número de documento y su nombre; se conserva el primer nombre registrado para cada documento.
- Puede repetir las lecturas, pero la calificación oficial es siempre la del primer intento.
- La palabra que se está preguntando tiene una animación sutil y continua (3 variantes que se alternan); con "reducir movimiento" activado en el sistema queda estática y subrayada.
- El texto de una lectura puede tener varios párrafos: sepáralos con una línea en blanco.

## Imágenes de las lecturas

Desde el editor de cada lectura en `/admin` se puede subir, reemplazar o quitar su imagen: PNG, JPEG o WebP de hasta 1 MB, con texto alternativo obligatorio. Se puede cambiar aunque la lectura esté activa o tenga resultados, y no es requisito para activarla. Las imágenes se guardan en Postgres (tabla `reading_images`), así que viajan con los backups de la base y no necesitan un volumen aparte.

La especificación completa está en `openspec/specs/`.
