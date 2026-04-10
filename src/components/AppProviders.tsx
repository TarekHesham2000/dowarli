"use client";

import type { ReactNode } from "react";
import { PwaInstallProvider } from "@/contexts/PwaInstallProvider";
import { PwaMobileInstallBanner } from "@/components/pwa/PwaMobileInstallBanner";

export function AppProviders({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <PwaInstallProvider>
      <PwaMobileInstallBanner />
      {children}
    </PwaInstallProvider>
  );
}
