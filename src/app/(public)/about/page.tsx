import type { Metadata } from "next";
import InfoPageShell from "@/components/legal/InfoPageShell";

export const metadata: Metadata = {
  title: "من نحن",
  description:
    "دورلي — مساعدك الذكي للبحث عن سكن وشقق وإعلانات عقارية في مصر مدعوم بالذكاء الاصطناعي.",
};

export default function AboutPage() {
  return (
    <InfoPageShell title="من نحن" subtitle="دورلي — Dowarly">
      <p>
        <strong>دورلي</strong> منصة مصرية تجمع بين البحث العقاري والمساعدة الذكية: نساعدك على صياغة
        بحثك بالعربية، فهم عروض السكن والإيجار والبيع، والتواصل مع الملاك والوسطاء بثقة.
      </p>
      <p>
        نعتمد على نماذج لغوية وذكاء اصطناعي لتوجيهك نحو إعلانات مناسبة لمنطقتك وميزانيتك ونوع
        الوحدة، مع الحفاظ على تجربة بسيطة ومناسبة للجوال.
      </p>
      <p>
        هدفنا أن يكون <strong>البحث عن سكن أو إعلان عقار</strong> أسرع وأوضح، مع مراجعة إدارية
        للإعلانات وسياسات واضحة للخصوصية والاستخدام.
      </p>
    </InfoPageShell>
  );
}
