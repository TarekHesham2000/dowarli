import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSupabaseGlobalClientOptions } from "@/lib/supabaseCacheBust";
import { isAdminProfile } from "@/lib/isAdmin";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminGroupLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...getSupabaseGlobalClientOptions(),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* set من Server Component قد يفشل — الـ middleware يحدّث الجلسة عادة */
          }
        },
      },
    },
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[admin layout] profiles query:", profileError.message);
    redirect("/login");
  }

  if (!isAdminProfile(profile)) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
