import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4" dir="rtl">
      <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl shadow-sm p-8 text-center">
        <p className="text-sm font-semibold text-green-700 mb-2">404</p>
        <h1 className="text-2xl font-black text-gray-900 mb-3">الصفحة غير موجودة</h1>
        <p className="text-gray-600 leading-7 mb-6">
          الرابط الذي تحاول الوصول إليه غير متاح حاليا، أو ربما تم نقله.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center bg-green-700 hover:bg-green-800 text-white font-bold rounded-xl px-5 py-3 transition-colors"
        >
          العودة للرئيسية
        </Link>
      </div>
    </div>
  );
}
