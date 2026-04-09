'use client';

import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { DataTable } from '@/components/dashboard/DataTable';
import { Button } from '@/components/dashboard/Button';
import { Filter } from 'lucide-react';

export default function PropertiesPage() {
  const properties = [
    { id: '1', name: 'Downtown Luxury Apartment', type: 'Apartment', beds: '3', price: '$250,000', status: '#Active', listed: '2024-03-15' },
    { id: '2', name: 'Giza Modern Villa', type: 'Villa', beds: '5', price: '$350,000', status: '#Active', listed: '2024-03-10' },
    { id: '3', name: 'Maadi Studio', type: 'Studio', beds: '1', price: '$45,000', status: '#Pending', listed: '2024-03-05' },
    { id: '4', name: 'Heliopolis Commercial', type: 'Commercial', beds: 'N/A', price: '$150,000', status: '#Active', listed: '2024-02-28' },
    { id: '5', name: 'New Cairo Penthouse', type: 'Penthouse', beds: '4', price: '$500,000', status: '#Inactive', listed: '2024-02-20' },
    { id: '6', name: 'Sheikh Zayed Townhouse', type: 'Townhouse', beds: '4', price: '$280,000', status: '#Active', listed: '2024-03-01' },
    { id: '7', name: 'Nasr City Apartment', type: 'Apartment', beds: '2', price: '$95,000', status: '#Active', listed: '2024-02-15' },
  ];

  return (
    <DashboardLayout 
      title="Properties" 
      subtitle="Manage and monitor all your property listings"
    >
      <div className="space-y-6">
        {/* Header with Actions */}
        <div className="flex items-center justify-between flex-col sm:flex-row gap-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">Property Portfolio</h2>
            <p className="text-sm text-muted mt-1">You have {properties.length} properties listed</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="md">
              <Filter size={18} className="inline mr-2" />
              Filter
            </Button>
            <Button variant="primary" size="md">+ Add Property</Button>
          </div>
        </div>

        {/* Properties Table */}
        <DataTable
          columns={[
            { key: 'name', label: 'Property Name', width: 'w-3/12' },
            { key: 'type', label: 'Type', width: 'w-2/12' },
            { key: 'beds', label: 'Beds', width: 'w-1/12' },
            { key: 'price', label: 'Price', width: 'w-2/12' },
            { key: 'status', label: 'Status', width: 'w-2/12' },
            { key: 'listed', label: 'Listed', width: 'w-2/12' },
          ]}
          rows={properties}
        />
      </div>
    </DashboardLayout>
  );
}
