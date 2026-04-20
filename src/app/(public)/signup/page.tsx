import { Suspense } from "react";
import OwnerBrokerAuth from "@/components/owner/OwnerBrokerAuth";

/**
 * Dedicated URL for Google OAuth signup failures (`?error=database_error`, etc.).
 * Email/password registration remains at `/register`.
 */
export default function SignupPage() {
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
      <OwnerBrokerAuth mode="register" />
    </Suspense>
  );
}
