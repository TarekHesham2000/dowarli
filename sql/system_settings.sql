-- دَورلي — إعدادات دفع ديناميكية (مفاتيح: wallet_phone, instapay_id)
-- نفّذ مرة واحدة في Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.system_settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.system_settings IS 'Key-value settings; payment fields read by /api/payment-settings, updated by admin API.';

INSERT INTO public.system_settings (key, value)
VALUES
  ('wallet_phone', ''),
  ('instapay_id', '')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- الوصول عبر مفاتيح الخدمة فقط (مسارات API تستخدم service role)
