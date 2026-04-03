"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  const isDevelopment = process.env.NODE_ENV !== "production";
  const debugMessage = error?.message?.trim();

  useEffect(() => {
    console.error("Unhandled route error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4" dir="rtl">
      <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl shadow-sm p-8 text-center">
        <p className="text-sm font-semibold text-red-600 mb-2">حدث خطأ</p>
        <h1 className="text-2xl font-black text-gray-900 mb-3">
          حصلت مشكلة غير متوقعة
        </h1>
        <p className="text-gray-600 leading-7 mb-6">
          حاول مرة أخرى. إذا استمرت المشكلة، ارجع للرئيسية أو تواصل مع الدعم.
        </p>
        {isDevelopment && debugMessage ? (
          <p className="text-xs text-left bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2 mb-6 break-words">
            {debugMessage}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center bg-green-700 hover:bg-green-800 text-white font-bold rounded-xl px-5 py-3 transition-colors"
          >
            إعادة المحاولة
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center border border-gray-300 text-gray-800 hover:bg-gray-100 font-bold rounded-xl px-5 py-3 transition-colors"
          >
            العودة للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}
