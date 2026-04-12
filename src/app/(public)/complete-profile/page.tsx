import { Suspense } from "react";
import CompleteProfileForm from "./CompleteProfileForm";

export default function CompleteProfilePage() {
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
      <CompleteProfileForm />
    </Suspense>
  );
}
