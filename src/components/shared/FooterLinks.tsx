import Link from "next/link";

export default function FooterLinks({
  className = "",
}: Readonly<{ className?: string }>) {
  return (
    <div className={className}>
      <Link href="/privacy" className="hover:underline">
        سياسة الخصوصية
      </Link>
      <Link href="/terms" className="hover:underline">
        الشروط والأحكام
      </Link>
      <Link href="/about" className="hover:underline">
        من نحن
      </Link>
      <Link href="/contact" className="hover:underline">
        تواصل معنا
      </Link>
    </div>
  );
}
