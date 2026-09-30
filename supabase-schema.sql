-- Запустить в Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS form_submissions (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  name        TEXT NOT NULL,
  company     TEXT,
  phone       TEXT NOT NULL,
  email       TEXT NOT NULL,
  calculation_json JSONB
);

-- Запрещаем публичный доступ (только service_role key может писать)
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
