-- Lead Generation Agent Database Schema

-- leads 테이블
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  phone text,
  email text,
  website text,
  address text,
  category text,
  region text,
  review_count int DEFAULT 0,
  review_summary text,
  score int DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  status text DEFAULT 'new' CHECK (status IN ('new', 'filtered', 'contacted', 'meeting', 'negotiation', 'closed_won', 'closed_lost')),
  source text DEFAULT 'google_maps',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- email_templates 테이블
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  target_category text,
  created_at timestamptz DEFAULT now()
);

-- email_logs 테이블
CREATE TABLE IF NOT EXISTS email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  template_id uuid REFERENCES email_templates(id) ON DELETE SET NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at timestamptz
);

-- collection_jobs 테이블
CREATE TABLE IF NOT EXISTS collection_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text NOT NULL,
  region text NOT NULL,
  count int NOT NULL DEFAULT 0,
  status text DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  result_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_category ON leads(category);
CREATE INDEX IF NOT EXISTS idx_leads_region ON leads(region);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_lead_id ON email_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_collection_jobs_status ON collection_jobs(status);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
