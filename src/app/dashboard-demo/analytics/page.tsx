'use client';

import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { TrendingUp, Eye, Click } from 'lucide-react';

export default function AnalyticsPage() {
  return (
    <DashboardLayout 
      title="Analytics" 
      subtitle="Detailed performance metrics and insights"
    >
      <div className="space-y-8">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatCard
            title="Total Views"
            value="4,821"
            subtitle="Property page views"
            icon={Eye}
            trend={{ value: 18, isPositive: true }}
          />
          <StatCard
            title="Avg Click-Through Rate"
            value="3.2%"
            subtitle="Per listing"
            icon={Click}
            trend={{ value: 5, isPositive: true }}
          />
          <StatCard
            title="Conversion Rate"
            value="2.8%"
            subtitle="Views to inquiries"
            icon={TrendingUp}
            trend={{ value: 2, isPositive: true }}
          />
        </div>

        {/* Performance Summary */}
        <div className="bg-white border border-border rounded-lg p-8">
          <h2 className="text-xl font-bold text-foreground mb-6">Performance Summary</h2>
          
          <div className="space-y-6">
            {/* Chart Placeholder */}
            <div className="h-64 bg-secondary rounded-lg flex items-center justify-center border-2 border-dashed border-border">
              <div className="text-center">
                <p className="text-muted font-medium mb-2">Analytics Chart Area</p>
                <p className="text-sm text-muted">Charts and graphs display here with full data visualization</p>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-secondary rounded-lg">
                <p className="text-sm text-muted font-medium">Total Leads</p>
                <p className="text-2xl font-bold text-foreground mt-2">142</p>
              </div>
              <div className="text-center p-4 bg-secondary rounded-lg">
                <p className="text-sm text-muted font-medium">Avg Response Time</p>
                <p className="text-2xl font-bold text-foreground mt-2">2.4h</p>
              </div>
              <div className="text-center p-4 bg-secondary rounded-lg">
                <p className="text-sm text-muted font-medium">Closed Deals</p>
                <p className="text-2xl font-bold text-foreground mt-2">12</p>
              </div>
              <div className="text-center p-4 bg-secondary rounded-lg">
                <p className="text-sm text-muted font-medium">Success Rate</p>
                <p className="text-2xl font-bold text-foreground mt-2">8.5%</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
