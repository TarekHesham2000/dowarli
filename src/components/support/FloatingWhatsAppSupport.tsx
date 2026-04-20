"use client";

import { usePathname } from "next/navigation";
import {
  FLOATING_WHATSAPP_FAB_BOTTOM,
  Z_INDEX_FLOATING_WHATSAPP,
} from "@/lib/floatingFabLayout";

const WA_URL =
  "https://wa.me/201098599892?text=" +
  encodeURIComponent("أهلاً دورلي، محتاج مساعدة بخصوص ");

/** Routes that render their own branded contact button — hide the platform
 *  support floater there to avoid two stacked WhatsApp bubbles. */
function shouldHideOnRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname.startsWith("/agency/");
}

export default function FloatingWhatsAppSupport() {
  const pathname = usePathname();
  if (shouldHideOnRoute(pathname)) return null;

  return (
    <a
      href={WA_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="chat-invite-pulse fixed flex h-14 w-14 items-center justify-center rounded-full shadow-md md:h-[3.25rem] md:w-[3.25rem]"
      style={{
        bottom: FLOATING_WHATSAPP_FAB_BOTTOM,
        left: "max(1rem, env(safe-area-inset-left, 0px))",
        right: "auto",
        zIndex: Z_INDEX_FLOATING_WHATSAPP,
        background: "#25D366",
        boxShadow: "0 4px 20px rgba(37, 211, 102, 0.35)",
      }}
      aria-label="تواصل مع الدعم عبر واتساب"
      title="دعم واتساب"
    >
      <svg viewBox="0 0 24 24" width={28} height={28} fill="white" aria-hidden>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
        <path d="M12.04 2.5c-5.392 0-9.78 4.388-9.78 9.78 0 1.72.45 3.36 1.31 4.81L2.5 21.5l4.55-1.19a9.73 9.73 0 005 1.37h.01c5.39 0 9.78-4.39 9.78-9.78 0-2.61-1.02-5.07-2.87-6.92a9.72 9.72 0 00-6.92-2.87zm0 1.75c4.43 0 8.03 3.6 8.03 8.03 0 1.43-.38 2.8-1.1 4.01l-.2.35.95 3.48-3.57-.94-.34.18a8.26 8.26 0 01-3.77.92h-.01c-4.43 0-8.03-3.6-8.03-8.03 0-2.15.84-4.17 2.36-5.69a7.98 7.98 0 015.69-2.36z" />
      </svg>
    </a>
  );
}
