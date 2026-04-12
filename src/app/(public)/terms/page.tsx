import type { Metadata } from "next";
import Link from "next/link";
import InfoPageShell from "@/components/legal/InfoPageShell";

export const metadata: Metadata = {
  title: "الشروط والأحكام",
  description: "شروط استخدام منصة دورلي ونشر الإعلانات ونظام النقاط.",
};

export default function TermsPage() {
  return (
    <InfoPageShell title="الشروط والأحكام" subtitle="آخر تحديث: أبريل 2026">
      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900">١. القبول</h2>
        <p>باستخدامك لموقع أو تطبيق <strong>دورلي</strong> فإنك تقر بأنك قرأت هذه الشروط وتوافق عليها. إن لم توافق، يُرجى عدم استخدام الخدمة.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900">٢. الحساب والمسؤولية</h2>
        <p>أنت مسؤول عن صحة بيانات التسجيل وعن أي نشاط يتم عبر حسابك. يجب عدم مشاركة بيانات الدخول مع الغير.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900">٣. نشر الإعلانات</h2>
        <ul className="list-inside list-disc space-y-1">
          <li>يلتزم المعلن بأن تكون المعلومات (السعر، العنوان، الصور، التوافر) صادقة ومحدّثة قدر الإمكان.</li>
          <li>يحق للإدارة مراجعة الإعلان، تأخير النشر، الرفض، أو إيقاف إعلان يخالف السياسات دون إلزام بتعويض.</li>
          <li>يُمنع نشر محتوى مخالف للقانون المصري أو مسيء أو مضلل أو مكرر بقصد الإزعاج.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900">٤. نظام النقاط والمحفظة</h2>
        <ul className="list-inside list-disc space-y-1">
          <li>قد تُخصم نقاط عند نشر أو تفعيل إعلان وفق نوع الإعلان (إيجار/بيع) وسياسات المنصة الظاهرة في الواجهة.</li>
          <li>طلبات شحن النقاط تخضع للمراجعة اليدوية؛ يجب إرسال إثبات السداد الصحيح.</li>
          <li>النقاط غير قابلة للتحويل كعملة نقدية إلا إذا نصت السياسة لاحقاً على خلاف ذلك.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900">٥. المساعد الذكي</h2>
        <p>إجابات المساعد الآلي استرشادية ولا تغني عن التحقق من تفاصيل الإعلان والتواصل مع المعلن. دورلي غير مسؤولة عن قرارات تتخذ اعتماداً على المخرجات الآلية وحدها.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900">٦. إيقاف الخدمة</h2>
        <p>يجوز تعليق أو إنهاء حساب يخالف الشروط أو يسيء استخدام المنصة، مع الاحتفاظ بالحق في اتخاذ الإجراءات القانونية عند اللزوم.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900">٧. التواصل</h2>
        <p>
          للاستفسارات:{" "}
          <Link href="/contact" className="font-bold text-[#00d38d] hover:underline">
            تواصل معنا
          </Link>
          .
        </p>
      </section>
    </InfoPageShell>
  );
}
