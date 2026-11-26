-- ============================================================================
-- PhiTech Store Copilot — External Trainer Drafts & Security Audit Queue
-- جدول مسودات التدريب من الإيجنت الخارجي + سجل التنبيهات الأمنية ومحاولات التصعيد.
-- RLS مفعّل بدون أي صلاحيات قراءة/كتابة عامة (Service Role فقط عبر الباك اند).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.store_copilot_training_proposals (
  id serial PRIMARY KEY,
  agent_name text NOT NULL DEFAULT 'external-trainer',
  proposal_type text NOT NULL
    CHECK (proposal_type IN ('synonym', 'knowledge', 'training_config', 'blocked_attempt')),
  title text NOT NULL,
  reason text NOT NULL DEFAULT '',
  requested_scope text NOT NULL DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk_level text NOT NULL DEFAULT 'safe'
    CHECK (risk_level IN ('safe', 'warning', 'critical')),
  security_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'blocked')),
  review_note text NOT NULL DEFAULT '',
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_copilot_proposals_status
  ON public.store_copilot_training_proposals (status, risk_level, created_at DESC);

ALTER TABLE public.store_copilot_training_proposals ENABLE ROW LEVEL SECURITY;
