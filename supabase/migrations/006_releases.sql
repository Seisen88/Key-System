-- App releases table — written by GitHub Actions on each new build
CREATE TABLE IF NOT EXISTS releases (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  version       text        NOT NULL UNIQUE,
  download_url  text        NOT NULL,
  file_name     text        NOT NULL DEFAULT '',
  release_notes text        NOT NULL DEFAULT '',
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read releases"
  ON releases FOR SELECT USING (true);

-- Allow service role to insert/update (GitHub Actions uses service key)
CREATE POLICY "service insert releases"
  ON releases FOR INSERT
  WITH CHECK (true);

CREATE POLICY "service update releases"
  ON releases FOR UPDATE
  USING (true);
