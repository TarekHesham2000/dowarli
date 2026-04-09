'use client';

import { Building2, TrendingUp, Users } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { DataTable } from '@/components/dashboard/DataTable';
import { Button } from '@/components/dashboard/Button';

export default function DashboardPage() {
  const recentListings = [
    { id: '1', property: 'Luxury Apartment - Downtown', price: '$250,000', status: '#Active', agent: 'Ahmed Hassan' },
    { id: '2', property: 'Modern Villa - Giza', price: '$350,000', status: '#Active', agent: 'Fatima Mohamed' },
    { id: '3', property: 'Studio - Maadi', price: '$45,000', status: '#Pending', agent: 'Omar Ali' },
    { id: '4', property: 'Commercial Space - Heliopolis', price: '$150,000', status: '#Active', agent: 'Layla Hassan' },
    { id: '5', property: 'Penthouse - New Cairo', price: '$500,000', status: '#Inactive', agent: 'Kareem Ibrahim' },
  ];

  return (
    <DashboardLayout title="Welcome Back" subtitle="Here&apos;s your real estate overview">
      <div className="space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatCard
            title="Active Listings"
            value="24"
            subtitle="Properties currently on market"
            icon={Building2}
            trend={{ value: 12, isPositive: true }}
          />
          <StatCard
            title="Total Revenue"
            value="$125,450"
            subtitle="This month"
            icon={TrendingUp}
            trend={{ value: 8, isPositive: true }}
          />
          <StatCard
            title="Active Leads"
            value="18"
            subtitle="Waiting for response"
            icon={Users}
            trend={{ value: 3, isPositive: false }}
          />
        </div>

        {/* Recent Listings Table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground">Recent Listings</h2>
              <p className="text-sm text-muted mt-1">Manage your property portfolio</p>
            </div>
            <Button variant="primary">+ New Listing</Button>
          </div>

          <DataTable
            columns={[
              { key: 'property', label: 'Property', width: 'w-3/12' },
              { key: 'price', label: 'Price', width: 'w-2/12' },
              { key: 'status', label: 'Status', width: 'w-2/12' },
              { key: 'agent', label: 'Agent', width: 'w-3/12' },
            ]}
            rows={recentListings}
          />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button className="bg-white border-2 border-primary text-primary px-6 py-4 rounded-lg font-medium hover:bg-primary hover:text-white transition-colors">
            View Analytics
          </button>
          <button className="bg-primary text-white px-6 py-4 rounded-lg font-medium hover:bg-opacity-90 transition-colors">
            Schedule Viewing
          </button>
          <button className="bg-white border-2 border-primary text-primary px-6 py-4 rounded-lg font-medium hover:bg-primary hover:text-white transition-colors">
            Contact Support
          </button>
          <button className="bg-white border-2 border-primary text-primary px-6 py-4 rounded-lg font-medium hover:bg-primary hover:text-white transition-colors">
            Export Report
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
