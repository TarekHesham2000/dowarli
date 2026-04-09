'use client';

import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function DashboardLayout({ children, title, subtitle }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen bg-white">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64">
        <Header title={title} subtitle={subtitle} />
        <main className="flex-1 overflow-auto p-8 bg-white">
          {children}
        </main>
      </div>
    </div>
  );
}
