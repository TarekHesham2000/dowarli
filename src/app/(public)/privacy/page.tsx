import type { Metadata } from "next";
import Link from "next/link";
import InfoPageShell from "@/components/legal/InfoPageShell";

export const metadata: Metadata = {
  title: "سياسة الخصوصية",
  description: "سياسة الخصوصية وحماية البيانات لمنصة دورلي العقارية.",
};

export default function PrivacyPage() {
  return (
    <InfoPageShell title="سياسة الخصوصية" subtitle="آخر تحديث: أبريل 2026">
      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900">١. المقدمة</h2>
        <p>
          توضح هذه السياسة كيف تجمع منصة <strong>دورلي</strong> وتستخدم وتخزن معلومات المستخدمين
          والزائرين عند استخدام الموقع أو التطبيق أو المساعد الذكي. باستخدامك للخدمة فإنك توافق
          على ممارسات موضحة هنا ضمن حدود القانون المعمول به.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900">٢. البيانات التي نجمعها</h2>
        <ul className="list-inside list-disc space-y-1 text-slate-700">
          <li>بيانات الحساب: الاسم، رقم الهاتف، البريد الإلكتروني عند التسجيل أو تسجيل الدخول.</li>
          <li>بيانات الإعلانات: وصف العقار، الصور، السعر، العنوان، نوع الوحدة، وحالة التوافر.</li>
          <li>بيانات التواصل: الأسماء وأرقام الهواتف المُدخلة عند طلب التواصل مع المعلن.</li>
          <li>بيانات المحفظة والنقاط: طلبات الشحن، المبالغ، حالة المعاملات، ومرفقات الإثبات عند تقديمها.</li>
          <li>بيانات تقنية: عنوان IP تقريبي، نوع المتصفح، وسجلات أخطاء عامة لتحسين الأداء والأمان.</li>
          <li>استفسارات المساعد الذكي: النصوص التي تكتبها للبوت لأغراض الرد والاقتراح فقط.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900">٣. أساس الاستخدام</h2>
        <p>نستخدم البيانات لتشغيل المنصة، عرض الإعلانات، مراجعة المحتوى، منع الإساءة، معالجة المدفوعات والنقاط، والتواصل معك بخصوص حسابك أو طلبات الدعم.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900">٤. المشاركة مع أطراف ثالثة</h2>
        <p>
          لا نبيع بياناتك الشخصية. قد نعتمد على مزودي بنية تحتية (مثل استضافة قاعدة البيانات والمصادقة)
          يعملون كمعالجين بموجب عقود، وقد نفصح عن بيانات إذا طُلب ذلك قضائياً.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900">٥. ملفات تعريف الارتباط والتخزين المحلي</h2>
        <p>قد نستخدم تقنيات ضرورية لجلسة الدخول وتفضيلات الواجهة. يمكنك ضبط متصفحك لتقليل التتبع وفق إمكانياته.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900">٦. الاحتفاظ والأمان</h2>
        <p>نطبق إجراءات أمنية معقولة (مثل الاتصال المشفّر) ونحتفظ بالبيانات للمدة اللازمة لتقديم الخدمة والالتزامات القانونية.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900">٧. حقوقك</h2>
        <p>يمكنك طلب تصحيح أو حذف بياناتك أو سحب موافقات معينة حيث يسمح القانون، عبر صفحة التواصل.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900">٨. التواصل</h2>
        <p>
          لأسئلة الخصوصية:{" "}
          <Link href="/contact" className="font-bold text-[#00d38d] hover:underline">
            تواصل معنا
          </Link>
          .
        </p>
      </section>
    </InfoPageShell>
  );
}
