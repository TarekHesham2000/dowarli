import type { Metadata } from "next";
import Link from "next/link";
import FooterLinks from "@/components/shared/FooterLinks";

export const metadata: Metadata = {
  title: "الشروط والأحكام - أجرلي",
  description: "الشروط والأحكام المنظمة لاستخدام منصة أجرلي.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <nav className="bg-white border-b px-4 py-4 flex items-center justify-between">
        <Link href="/" className="font-bold text-green-800 text-lg">
          أجرلي
        </Link>
        <Link href="/" className="text-sm text-green-700 hover:underline">
          العودة للرئيسية
        </Link>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-10">
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2">
            الشروط والأحكام
          </h1>
          <p className="text-gray-500 text-sm mb-8">آخر تحديث: أبريل 2026</p>

          <div className="space-y-6 text-gray-700 leading-8">
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-2">
                1. قبول الشروط
              </h2>
              <p>
                باستخدامك منصة أجرلي، فأنت توافق على الالتزام بهذه الشروط
                والأحكام وجميع السياسات المرتبطة بها.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-2">
                2. مسؤولية الحساب
              </h2>
              <p>
                أنت مسؤول عن صحة بياناتك وسرية معلومات تسجيل الدخول، وعن أي نشاط
                يتم من خلال حسابك.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-2">
                3. نشر الإعلانات
              </h2>
              <p>
                يجب أن تكون بيانات العقار صحيحة وغير مضللة. يحق للإدارة مراجعة
                الإعلانات وقبولها أو رفضها وفق سياسات المنصة.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-2">
                4. استخدام المنصة
              </h2>
              <p>
                يُمنع استخدام المنصة لأي أنشطة غير قانونية أو مسيئة، ويحق لأجرلي
                تعليق أو إيقاف الحسابات المخالفة.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-2">
                5. التواصل
              </h2>
              <p>
                لأي استفسار بخصوص الشروط، يمكنك التواصل معنا عبر صفحة{" "}
                <Link href="/contact" className="text-green-700 hover:underline">
                  تواصل معنا
                </Link>
                .
              </p>
            </section>
          </div>
        </div>
      </main>
      <footer className="bg-green-900 text-green-100 py-6 px-4 text-center text-sm mt-10">
        <p>© 2025 أجرلي — منصة الإيجار العقاري المصرية</p>
        <FooterLinks className="flex justify-center gap-4 mt-2 text-xs opacity-70" />
      </footer>
    </div>
  );
}
