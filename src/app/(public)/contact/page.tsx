import type { Metadata } from "next";
import Link from "next/link";
import FooterLinks from "@/components/shared/FooterLinks";

export const metadata: Metadata = {
  title: "تواصل معنا - أجرلي",
  description: "تواصل مع فريق أجرلي للدعم والاستفسارات.",
};

export default function ContactPage() {
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
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mb-4">
            تواصل معنا
          </h1>
          <p className="text-gray-700 leading-8 mb-6">
            يسعدنا استقبال استفساراتكم وملاحظاتكم حول المنصة أو أي مشكلة تقنية.
          </p>

          <div className="space-y-3 text-gray-700">
            <p>
              <span className="font-bold text-gray-900">البريد الإلكتروني:</span>{" "}
              support@agrly.eg
            </p>
            <p>
              <span className="font-bold text-gray-900">الهاتف:</span> +20 10
              0000 0000
            </p>
            <p>
              <span className="font-bold text-gray-900">مواعيد الدعم:</span>{" "}
              يوميا من 10 صباحا حتى 8 مساء
            </p>
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
