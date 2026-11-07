CREATE TABLE participants (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  document_number TEXT NOT NULL UNIQUE CHECK (length(document_number) > 0),
  full_name       TEXT NOT NULL CHECK (length(full_name) > 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE admins (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE readings (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title      TEXT NOT NULL CHECK (length(title) > 0),
  content    TEXT NOT NULL CHECK (length(content) > 0),
  position   INTEGER NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE target_words (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reading_id   BIGINT NOT NULL REFERENCES readings (id) ON DELETE CASCADE,
  word         TEXT NOT NULL CHECK (length(word) > 0),
  start_offset INTEGER NOT NULL CHECK (start_offset >= 0),
  end_offset   INTEGER NOT NULL,
  CHECK (end_offset > start_offset)
);
CREATE UNIQUE INDEX target_words_reading_word_uq ON target_words (reading_id, lower(word));

-- level: 1 Radicacion, 2 Contexto, 3 Sinonimia, 4 Lexico
CREATE TABLE hints (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  target_word_id BIGINT NOT NULL REFERENCES target_words (id) ON DELETE CASCADE,
  level          SMALLINT NOT NULL CHECK (level BETWEEN 1 AND 4),
  content        TEXT NOT NULL CHECK (length(btrim(content)) > 0),
  UNIQUE (target_word_id, level)
);

CREATE TABLE answer_options (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  target_word_id BIGINT NOT NULL REFERENCES target_words (id) ON DELETE CASCADE,
  text           TEXT NOT NULL CHECK (length(btrim(text)) > 0),
  is_correct     BOOLEAN NOT NULL DEFAULT false,
  position       INTEGER NOT NULL DEFAULT 0
);
-- A lo sumo una opcion correcta por palabra (que haya al menos una lo valida la aplicacion)
CREATE UNIQUE INDEX answer_options_one_correct ON answer_options (target_word_id) WHERE is_correct;

CREATE TABLE reading_attempts (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  participant_id BIGINT NOT NULL REFERENCES participants (id) ON DELETE CASCADE,
  reading_id     BIGINT NOT NULL REFERENCES readings (id),
  round          INTEGER NOT NULL CHECK (round >= 1),
  attempt_number INTEGER NOT NULL CHECK (attempt_number >= 1),
  status         TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  score          INTEGER,
  max_score      INTEGER,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at   TIMESTAMPTZ,
  UNIQUE (participant_id, reading_id, attempt_number),
  UNIQUE (participant_id, reading_id, round)
);

CREATE TABLE word_responses (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reading_attempt_id BIGINT NOT NULL REFERENCES reading_attempts (id) ON DELETE CASCADE,
  target_word_id     BIGINT NOT NULL REFERENCES target_words (id),
  hint_level         SMALLINT NOT NULL DEFAULT 0 CHECK (hint_level BETWEEN 0 AND 4),
  presented_at       TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  answered_at        TIMESTAMPTZ,
  selected_option_id BIGINT REFERENCES answer_options (id),
  is_correct         BOOLEAN,
  points             INTEGER,
  UNIQUE (reading_attempt_id, target_word_id)
);

CREATE TABLE hint_requests (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  word_response_id BIGINT NOT NULL REFERENCES word_responses (id) ON DELETE CASCADE,
  level            SMALLINT NOT NULL CHECK (level BETWEEN 1 AND 4),
  delivered_at     TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (word_response_id, level)
);
