export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4" dir="rtl">
      <div className="max-w-sm w-full bg-white border border-gray-200 rounded-2xl shadow-sm p-8 text-center">
        <div className="w-10 h-10 mx-auto mb-4 rounded-full border-4 border-green-200 border-t-green-700 animate-spin" />
        <p className="text-gray-700 font-semibold">جاري التحميل...</p>
      </div>
    </div>
  );
}
