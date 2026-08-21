-- Телефон автора и согласия на обработку ПД / рассылку.
--
-- Телефон нужен, чтобы связаться с автором и подтвердить публикацию.
-- Согласия храним вместе с моментом проставления: без этого нечем подтвердить,
-- что человек их давал, если он потом отзовёт публикацию.
--
-- Накатывать: psql -d travel_db -f scripts/migrate-stories-contacts.sql

ALTER TABLE stories ADD COLUMN IF NOT EXISTS raw_phone            TEXT;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS consent_personal_at  TIMESTAMPTZ;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS consent_mailing_at   TIMESTAMPTZ;

COMMENT ON COLUMN stories.raw_phone           IS 'Телефон автора для подтверждения публикации';
COMMENT ON COLUMN stories.consent_personal_at IS 'Когда дано согласие на обработку персональных данных (обязательное)';
COMMENT ON COLUMN stories.consent_mailing_at  IS 'Когда дано согласие на рассылку (необязательное)';
