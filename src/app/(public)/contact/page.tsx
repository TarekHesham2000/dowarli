import type { Metadata } from "next";
import InfoPageShell from "@/components/legal/InfoPageShell";
import ContactSupportForm from "@/components/legal/ContactSupportForm";

export const metadata: Metadata = {
  title: "تواصل معنا",
  description: "تواصل مع فريق دورلي للدعم الفني والاستفسارات العقارية.",
};

export default function ContactPage() {
  return (
    <InfoPageShell title="تواصل معنا" subtitle="نرد في أقرب وقت ممكن">
      <p>
        يمكنك مراسلتنا عبر النموذج أدناه (يفتح بريدك الإلكتروني)، أو عبر{" "}
        <strong>واتساب</strong> على الرقم{" "}
        <a href="https://wa.me/201098599892" className="font-bold text-[#00d38d] no-underline hover:underline">
          01098599892
        </a>
        .
      </p>
      <ContactSupportForm />
    </InfoPageShell>
  );
}
