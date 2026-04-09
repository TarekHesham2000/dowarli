'use client';

import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { DataTable } from '@/components/dashboard/DataTable';
import { Button } from '@/components/dashboard/Button';
import { Mail } from 'lucide-react';

export default function LeadsPage() {
  const leads = [
    { id: '1', name: 'Sarah Johnson', email: 'sarah@email.com', property: 'Downtown Apartment', status: '#Active', date: '2024-03-15' },
    { id: '2', name: 'Michael Chen', email: 'michael@email.com', property: 'Giza Villa', status: '#Active', date: '2024-03-14' },
    { id: '3', name: 'Emma Williams', email: 'emma@email.com', property: 'Maadi Studio', status: '#Pending', date: '2024-03-13' },
    { id: '4', name: 'James Brown', email: 'james@email.com', property: 'New Cairo Penthouse', status: '#Active', date: '2024-03-12' },
    { id: '5', name: 'Lisa Anderson', email: 'lisa@email.com', property: 'Sheikh Zayed Townhouse', status: '#Inactive', date: '2024-03-11' },
  ];

  return (
    <DashboardLayout 
      title="Leads" 
      subtitle="Track and manage your property inquiries"
    >
      <div className="space-y-6">
        {/* Header with Actions */}
        <div className="flex items-center justify-between flex-col sm:flex-row gap-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">Active Leads</h2>
            <p className="text-sm text-muted mt-1">{leads.length} inquiries in progress</p>
          </div>
          <Button variant="primary" size="md">
            <Mail size={18} className="inline mr-2" />
            Send Campaign
          </Button>
        </div>

        {/* Leads Table */}
        <DataTable
          columns={[
            { key: 'name', label: 'Lead Name', width: 'w-2/12' },
            { key: 'email', label: 'Email', width: 'w-3/12' },
            { key: 'property', label: 'Property Interest', width: 'w-3/12' },
            { key: 'status', label: 'Status', width: 'w-2/12' },
            { key: 'date', label: 'Date', width: 'w-2/12' },
          ]}
          rows={leads}
        />
      </div>
    </DashboardLayout>
  );
}
