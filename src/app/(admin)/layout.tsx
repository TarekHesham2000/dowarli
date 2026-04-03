import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminGroupLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  
  // التعديل هنا: أضفنا await لأن النسخ الحديثة بتطلب ده
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          // هنا cookieStore أصبح جاهزاً للاستخدام
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  // 1. التأكد من الـ Session
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  // 2. التأكد من الـ Role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  // 3. الحماية
  if (profile?.role !== "admin") {
    redirect("/dashboard"); 
  }

  return <>{children}</>;
}