'use client';

import { ChevronRight } from 'lucide-react';

interface Column {
  key: string;
  label: string;
  width?: string;
}

interface Row {
  [key: string]: any;
}

interface DataTableProps {
  columns: Column[];
  rows: Row[];
  title?: string;
  onRowClick?: (row: Row) => void;
}

export function DataTable({ columns, rows, title, onRowClick }: DataTableProps) {
  return (
    <div className="bg-white border border-border rounded-lg overflow-hidden">
      {title && (
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
        </div>
      )}
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-secondary">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-6 py-3 text-left text-sm font-semibold text-foreground ${column.width || ''}`}
                >
                  {column.label}
                </th>
              ))}
              <th className="px-6 py-3 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={idx}
                className="border-b border-border hover:bg-secondary transition-colors cursor-pointer"
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((column) => (
                  <td key={column.key} className={`px-6 py-4 text-sm text-foreground ${column.width || ''}`}>
                    {typeof row[column.key] === 'string' && row[column.key].startsWith('#') ? (
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                        row[column.key] === '#Active' ? 'bg-green-100 text-green-700' :
                        row[column.key] === '#Pending' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {row[column.key].replace('#', '')}
                      </span>
                    ) : (
                      row[column.key]
                    )}
                  </td>
                ))}
                <td className="px-6 py-4 text-right">
                  <ChevronRight size={18} className="text-muted" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
