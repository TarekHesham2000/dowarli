-- =============================================================================
-- دَورلي — إنشاء/تجهيز ملف في profiles تلقائياً مع كل مستخدم جديد في auth.users
-- ضعه في Supabase → SQL Editor → Run (مرة واحدة)
-- =============================================================================

-- عمود الصورة (إن لم يكن موجوداً)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- التسجيل بالهاتف فقط يترك new.email فارغاً؛ إما تخفيف NOT NULL على email أو الاعتماد على user_metadata.email
ALTER TABLE public.profiles
  ALTER COLUMN email DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_avatar text;
  v_email text;
  v_phone text;
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

  -- بريد من auth أو metadata؛ وإلا بريد داخلي من رقم الهاتف (نفس صيغة الواجهة: phone.{أرقام}@internal.dowarli.local)
  v_email := COALESCE(
    NULLIF(trim(new.email), ''),
    NULLIF(lower(trim(new.raw_user_meta_data ->> 'email')), ''),
    CASE
      WHEN new.phone IS NOT NULL AND btrim(new.phone) <> '' THEN
        'phone.' || regexp_replace(new.phone, '[^0-9]', '', 'g') || '@internal.dowarli.local'
      ELSE NULL
    END
  );

  -- نفس تنسيق النموذج (محلي 01…) لتفادي تعارض UNIQUE مع upsert من الواجهة
  v_phone := NULLIF(trim(new.raw_user_meta_data ->> 'phone'), '');

  -- جوجل: avatar_url أو picture نصي — فيسبوك: picture.data.url
  v_avatar := COALESCE(
    NULLIF(trim(new.raw_user_meta_data ->> 'avatar_url'), ''),
    NULLIF(trim(new.raw_user_meta_data ->> 'picture'), ''),
    NULLIF(trim(new.raw_user_meta_data #>> '{picture,data,url}'), '')
  );

  IF v_avatar IS NOT NULL AND v_avatar !~ '^https?://' THEN
    v_avatar := NULL;
  END IF;

  INSERT INTO public.profiles (id, name, email, phone, role, wallet_balance, avatar_url, points)
  VALUES (
    new.id,
    v_name,
    v_email,
    v_phone,
    'broker',
    0,
    v_avatar,
    100
  )
  ON CONFLICT (id) DO UPDATE SET
    name = COALESCE(NULLIF(trim(EXCLUDED.name), ''), public.profiles.name),
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url);

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- على Postgres قديم جداً استبدل EXECUTE FUNCTION بـ EXECUTE PROCEDURE
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
