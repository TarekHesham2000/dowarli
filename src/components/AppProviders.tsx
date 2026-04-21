"use client";

import type { ReactNode } from "react";
import { PwaInstallProvider } from "@/contexts/PwaInstallProvider";
import { PwaMobileInstallBanner } from "@/components/pwa/PwaMobileInstallBanner";
import { SupabaseAuthRecovery } from "@/components/SupabaseAuthRecovery";

export function AppProviders({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <PwaInstallProvider>
      <SupabaseAuthRecovery />
      <PwaMobileInstallBanner />
      {children}
    </PwaInstallProvider>
  );
}
