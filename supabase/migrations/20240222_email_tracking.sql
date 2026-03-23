-- Email Tracking Migration
-- email_logs에 Resend 추적 컬럼 추가 + email_events 테이블 생성
-- 적용: supabase db push 또는 Supabase Dashboard > SQL Editor에서 실행

-- 1. email_logs에 resend_email_id 및 이벤트 타임스탬프 컬럼 추가
ALTER TABLE email_logs
  ADD COLUMN IF NOT EXISTS resend_email_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS delivered_at  timestamptz,
  ADD COLUMN IF NOT EXISTS opened_at     timestamptz,
  ADD COLUMN IF NOT EXISTS clicked_at   timestamptz,
  ADD COLUMN IF NOT EXISTS bounced_at   timestamptz,
  ADD COLUMN IF NOT EXISTS complained_at timestamptz;

-- resend_email_id 인덱스 (webhook 수신 시 빠른 조회용)
CREATE INDEX IF NOT EXISTS idx_email_logs_resend_email_id
  ON email_logs(resend_email_id);

-- 2. email_events 테이블 생성 (이벤트 원본 로그)
CREATE TABLE IF NOT EXISTS email_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_log_id    uuid REFERENCES email_logs(id) ON DELETE SET NULL,
  resend_email_id text NOT NULL,
  event_type      text NOT NULL,  -- delivered, opened, clicked, bounced, complained, sent
  metadata        jsonb,          -- click / bounce 상세 정보
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_events_email_log_id
  ON email_events(email_log_id);

CREATE INDEX IF NOT EXISTS idx_email_events_resend_email_id
  ON email_events(resend_email_id);

CREATE INDEX IF NOT EXISTS idx_email_events_event_type
  ON email_events(event_type);
