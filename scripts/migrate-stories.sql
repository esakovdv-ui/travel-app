-- Миграция: таблицы tags и stories

-- ТЕГИ
CREATE TABLE IF NOT EXISTS tags (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  slug        TEXT UNIQUE NOT NULL,
  label       TEXT NOT NULL,
  position    INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ИСТОРИИ
CREATE TABLE IF NOT EXISTS stories (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  submitted_at     TIMESTAMPTZ DEFAULT now(),
  status           TEXT DEFAULT 'new' CHECK (status IN ('new', 'published', 'rejected')),
  published_at     TIMESTAMPTZ,
  rejected_at      TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Данные от клиента (raw)
  raw_author_name  TEXT NOT NULL,
  raw_object       TEXT NOT NULL,
  raw_period       TEXT,
  raw_manager      TEXT,
  raw_text         TEXT NOT NULL,
  photos           TEXT[] DEFAULT '{}',

  -- Данные для публикации (заполняет Анна)
  pub_title        TEXT,
  pub_quote        TEXT,
  pub_tag_id       TEXT REFERENCES tags(id),
  pub_object_url   TEXT
);

-- ИНДЕКСЫ
CREATE INDEX IF NOT EXISTS stories_status_idx ON stories(status);
CREATE INDEX IF NOT EXISTS stories_submitted_at_idx ON stories(submitted_at DESC);
CREATE INDEX IF NOT EXISTS stories_pub_tag_id_idx ON stories(pub_tag_id);

-- НАЧАЛЬНЫЕ ТЕГИ (seed)
INSERT INTO tags (slug, label, position) VALUES
  ('family',    'Семейный отдых',     1),
  ('beach',     'Пляж и море',        2),
  ('mountains', 'Горы и природа',     3),
  ('wellness',  'Wellness и лечение', 4),
  ('active',    'Активный отдых',     5),
  ('camp',      'Детский лагерь',     6),
  ('city',      'Город и культура',   7),
  ('weekend',   'Выходного дня',      8)
ON CONFLICT (slug) DO NOTHING;
