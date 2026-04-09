import { Suspense } from "react";
import OwnerBrokerAuth from "@/components/owner/OwnerBrokerAuth";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            background: "#030712",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#64748b",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          جاري التحميل…
        </div>
      }
    >
      <OwnerBrokerAuth mode="login" />
    </Suspense>
  );
}
