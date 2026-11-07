-- Una imagen por lectura. image/svg+xml solo lo usa el seed (contenido propio); la subida acepta PNG, JPEG y WebP.
CREATE TABLE reading_images (
  reading_id BIGINT PRIMARY KEY REFERENCES readings (id) ON DELETE CASCADE,
  mime_type  TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp', 'image/svg+xml')),
  data       BYTEA NOT NULL,
  alt_text   TEXT NOT NULL CHECK (length(btrim(alt_text)) > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
