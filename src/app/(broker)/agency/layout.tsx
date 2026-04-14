import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseGlobalClientOptions } from "@/lib/supabaseCacheBust";
import DashboardHeader from "../dashboard/DashboardHeader";

export const metadata: Metadata = {
  title: "لوحة الوكالة",
  robots: { index: false, follow: false },
};

export default async function AgencyDashboardLayout({
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
            /* ignore */
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

  return (
    <div
      className="min-h-screen bg-[#f9fdfc]"
      style={{
        fontFamily: "var(--font-cairo), var(--font-geist-sans), Cairo, system-ui, sans-serif",
        direction: "rtl",
      }}
    >
      <DashboardHeader />
      {children}
    </div>
  );
}
