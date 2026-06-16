-- Миграция: дедупликация при импорте историй из выгрузок опросов (NPS)

ALTER TABLE stories ADD COLUMN IF NOT EXISTS source_order_id TEXT;

-- Частичный уникальный индекс: не даёт повторно импортировать одну и ту же заявку,
-- но не мешает историям, поданным вручную через форму (у них source_order_id = NULL)
CREATE UNIQUE INDEX IF NOT EXISTS stories_source_order_id_idx
  ON stories (source_order_id)
  WHERE source_order_id IS NOT NULL;
