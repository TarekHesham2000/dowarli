'use client';

import { Home, Building2, BarChart3, Users, Settings, LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';

export function Sidebar() {
  const pathname = usePathname();

  const menuItems = [
    { href: '/dashboard', icon: Home, label: 'Dashboard', active: pathname === '/dashboard' },
    { href: '/dashboard/properties', icon: Building2, label: 'Properties', active: pathname.includes('/properties') },
    { href: '/dashboard/analytics', icon: BarChart3, label: 'Analytics', active: pathname.includes('/analytics') },
    { href: '/dashboard/leads', icon: Users, label: 'Leads', active: pathname.includes('/leads') },
    { href: '/dashboard/settings', icon: Settings, label: 'Settings', active: pathname.includes('/settings') },
  ];

  return (
    <aside className="w-64 bg-primary text-primary-foreground h-screen fixed left-0 top-0 flex flex-col">
      {/* Logo Section */}
      <div className="p-6 border-b border-white border-opacity-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold">Dowrly</h1>
            <p className="text-xs text-white text-opacity-70">Dashboard</p>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                item.active
                  ? 'bg-white bg-opacity-20 text-white'
                  : 'text-white text-opacity-75 hover:bg-white hover:bg-opacity-10'
              }`}
            >
              <Icon size={20} />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout Section */}
      <div className="p-4 border-t border-white border-opacity-10">
        <button className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-white text-opacity-75 hover:bg-white hover:bg-opacity-10 transition-colors">
          <LogOut size={20} />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
}
