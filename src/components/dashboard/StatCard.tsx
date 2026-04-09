'use client';

import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: { value: number; isPositive: boolean };
}

export function StatCard({ title, value, subtitle, icon: Icon, trend }: StatCardProps) {
  return (
    <div className="bg-white border border-border rounded-lg p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="text-sm text-muted font-medium mb-1">{title}</p>
          <h3 className="text-3xl font-bold text-foreground">{value}</h3>
          {subtitle && <p className="text-xs text-muted mt-1">{subtitle}</p>}
        </div>
        {Icon && (
          <div className="w-12 h-12 rounded-lg bg-primary bg-opacity-10 flex items-center justify-center ml-4">
            <Icon size={24} className="text-primary" />
          </div>
        )}
      </div>
      {trend && (
        <div className={`flex items-center gap-1 text-sm font-medium ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
          <span>{trend.isPositive ? '↑' : '↓'}</span>
          <span>{Math.abs(trend.value)}% from last month</span>
        </div>
      )}
    </div>
  );
}
