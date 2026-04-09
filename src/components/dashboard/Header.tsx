'use client';

import { Bell, Search, User } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  return (
    <header className="bg-white border-b border-border h-20 flex items-center justify-between px-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
      </div>
      
      <div className="flex items-center gap-6">
        {/* Search */}
        <div className="hidden md:flex items-center gap-2 bg-secondary px-4 py-2 rounded-lg border border-border">
          <Search size={18} className="text-muted" />
          <input
            type="text"
            placeholder="Search..."
            className="bg-transparent border-none outline-none text-sm w-48 placeholder-muted"
          />
        </div>

        {/* Notification Bell */}
        <button className="relative p-2 rounded-lg hover:bg-secondary transition-colors">
          <Bell size={20} className="text-muted" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full"></span>
        </button>

        {/* User Profile */}
        <button className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary transition-colors">
          <div className="w-8 h-8 rounded-full bg-primary bg-opacity-20 flex items-center justify-center">
            <User size={16} className="text-primary" />
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-sm font-medium text-foreground">Ahmed</p>
            <p className="text-xs text-muted">Broker</p>
          </div>
        </button>
      </div>
    </header>
  );
}
