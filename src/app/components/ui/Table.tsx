"use client";

import React from "react";

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T, index: number) => React.ReactNode;
  width?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  keyExtractor: (row: T, index: number) => string;
}

export default function Table<T>(props: TableProps<T>) {
  const {
    columns,
    data,
    onRowClick,
    isLoading = false,
    emptyMessage = "Tidak ada data",
    keyExtractor,
  } = props;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-700"></div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-lg font-medium">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-green-100 -mx-4 sm:mx-0">
      <div className="min-w-[800px] sm:min-w-full">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gradient-to-r from-green-700 to-green-600">
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className="px-4 sm:px-6 py-3 sm:py-4 text-xs font-bold text-white uppercase tracking-wider whitespace-nowrap"
                  style={col.width ? { width: col.width } : {}}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {data.map((row, rowIndex) => (
              <tr
                key={keyExtractor(row, rowIndex)}
                onClick={() => onRowClick?.(row)}
                className={`transition-colors ${onRowClick ? "cursor-pointer hover:bg-green-50" : "hover:bg-gray-50"}`}
              >
                {columns.map((col, colIndex) => (
                  <td key={colIndex} className="px-4 sm:px-6 py-3 sm:py-4 text-sm text-gray-700 whitespace-nowrap">
                    {col.render
                      ? col.render(row, rowIndex)
                      : String((row as any)[col.key] ?? "-")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}