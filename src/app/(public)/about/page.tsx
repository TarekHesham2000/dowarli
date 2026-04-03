import type { Metadata } from "next";
import Link from "next/link";
import FooterLinks from "@/components/shared/FooterLinks";

export const metadata: Metadata = {
  title: "من نحن - أجرلي",
  description:
    "تعرف على منصة أجرلي المتخصصة في إيجار سكن الطلاب والمغتربين في مصر.",
};

export default function AboutPage() {
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
            من نحن
          </h1>
          <p className="text-gray-700 leading-8 mb-4">
            أجرلي منصة مصرية متخصصة في تأجير العقارات المناسبة للطلاب
            والمغتربين، مع التركيز على السهولة، الثقة، وسرعة الوصول للسكن
            المناسب.
          </p>
          <p className="text-gray-700 leading-8 mb-4">
            نعمل على ربط الملاك والوسطاء بالمستأجرين عبر تجربة رقمية واضحة،
            تشمل نشر الإعلانات، التحقق منها، وإدارة الطلبات بشكل منظم.
          </p>
          <p className="text-gray-700 leading-8">
            هدفنا تقديم سوق إيجاري أكثر احترافية يخدم احتياجات السكن في المدن
            الجامعية ومناطق العمل داخل مصر.
          </p>
        </div>
      </main>
      <footer className="bg-green-900 text-green-100 py-6 px-4 text-center text-sm mt-10">
        <p>© 2025 أجرلي — منصة الإيجار العقاري المصرية</p>
        <FooterLinks className="flex justify-center gap-4 mt-2 text-xs opacity-70" />
      </footer>
    </div>
  );
}
