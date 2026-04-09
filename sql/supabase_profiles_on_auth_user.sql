-- =============================================================================
-- دَورلي — إنشاء/تجهيز ملف في profiles تلقائياً مع كل مستخدم جديد في auth.users
-- ضعه في Supabase → SQL Editor → Run (مرة واحدة)
-- =============================================================================

-- عمود الصورة (إن لم يكن موجوداً)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- تأكد أن البريد اختياري إن لزم (OAuth قد يتأخر)
-- ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_avatar text;
BEGIN
  v_name := COALESCE(
    NULLIF(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(trim(new.raw_user_meta_data ->> 'name'), ''),
    NULLIF(
      trim(
        concat_ws(
          ' ',
          NULLIF(trim(new.raw_user_meta_data ->> 'given_name'), ''),
          NULLIF(trim(new.raw_user_meta_data ->> 'family_name'), '')
        )
      ),
      ''
    ),
    split_part(COALESCE(new.email, 'user@placeholder.local'), '@', 1)
  );

  -- جوجل: avatar_url أو picture نصي — فيسبوك: picture.data.url
  v_avatar := COALESCE(
    NULLIF(trim(new.raw_user_meta_data ->> 'avatar_url'), ''),
    NULLIF(trim(new.raw_user_meta_data ->> 'picture'), ''),
    NULLIF(trim(new.raw_user_meta_data #>> '{picture,data,url}'), '')
  );

  IF v_avatar IS NOT NULL AND v_avatar !~ '^https?://' THEN
    v_avatar := NULL;
  END IF;

  INSERT INTO public.profiles (id, name, email, phone, role, wallet_balance, avatar_url)
  VALUES (
    new.id,
    v_name,
    new.email,
    NULLIF(trim(new.raw_user_meta_data ->> 'phone'), ''),
    'broker',
    0,
    v_avatar
  )
  ON CONFLICT (id) DO UPDATE SET
    name = COALESCE(NULLIF(trim(EXCLUDED.name), ''), public.profiles.name),
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url);

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();
