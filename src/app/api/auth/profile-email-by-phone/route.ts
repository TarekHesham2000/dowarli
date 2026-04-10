import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

const E164_EG = /^\+20(10|11|12|15)\d{8}$/;

/**
 * يبحث في public.profiles عن البريد المرتبط بنفس رقم الموبايل (محلي أو E.164).
 * يُستخدم لتسجيل الدخول بالبريد+كلمة المرور للمستخدمين الذين سجّلوا بالبريد لكنهم يكتبون الموبايل في حقل الدخول.
 * يعتمد على SUPABASE_SERVICE_ROLE_KEY (لا يكشف صفوفاً لمن ليس لديهم ملف بهذا الرقم).
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { phoneE164?: string };
    const phoneE164 = typeof body.phoneE164 === "string" ? body.phoneE164.trim() : "";
    if (!E164_EG.test(phoneE164)) {
      return NextResponse.json({ email: null as string | null });
    }

    const local11 = `0${phoneE164.slice(3)}`;
    const noPlus = phoneE164.slice(1);
    const variants = [...new Set([local11, phoneE164, noPlus])];

    const admin = getSupabaseServerClient();
    const { data, error } = await admin.from("profiles").select("email").in("phone", variants);

    if (error) {
      console.error("[profile-email-by-phone]", error.message);
      return NextResponse.json({ email: null as string | null });
    }

    const rows = data ?? [];
    if (rows.length !== 1) {
      return NextResponse.json({ email: null as string | null });
    }

    const raw = rows[0].email;
    const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";
    if (!email) {
      return NextResponse.json({ email: null as string | null });
    }

    return NextResponse.json({ email });
  } catch (e) {
    console.error("[profile-email-by-phone]", e);
    return NextResponse.json({ email: null as string | null });
  }
}
