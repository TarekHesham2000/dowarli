import { redirect } from "next/navigation";

/** لوحة الوسيط الرئيسية انتقلت إلى `/dashboard`. */
export default function BrokerLegacyRedirect() {
  redirect("/dashboard");
}
