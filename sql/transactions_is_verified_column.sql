-- Optional: mirror verified payments on transactions (used by admin approval UI)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;

UPDATE public.transactions
SET is_verified = true
WHERE status = 'verified' AND is_verified IS NOT TRUE;

COMMENT ON COLUMN public.transactions.is_verified IS 'True when admin has verified the payment (kept in sync with status = verified)';
