import React, { useEffect, useState } from 'react';
import { Filter, X, Search, Calendar, Settings } from 'lucide-react';
import { TransactionFilter } from '../types';

interface FilterBarProps {
  filters: TransactionFilter;
  categories: string[];
  onFilterChange: (filters: TransactionFilter) => void;
  onClear: () => void;
  onOpenCategoryManager: () => void;
}

const FilterBar: React.FC<FilterBarProps> = ({ filters, categories, onFilterChange, onClear, onOpenCategoryManager }) => {
  // Local state for immediate input feedback
  const [localSearch, setLocalSearch] = useState(filters.search);
  const [localMin, setLocalMin] = useState(filters.minAmount);
  const [localMax, setLocalMax] = useState(filters.maxAmount);

  // Sync local state if external filters change (e.g., Clear button)
  useEffect(() => {
    setLocalSearch(filters.search);
    setLocalMin(filters.minAmount);
    setLocalMax(filters.maxAmount);
  }, [filters.search, filters.minAmount, filters.maxAmount]);

  // Debounce effect
  useEffect(() => {
    const handler = setTimeout(() => {
      // Only call onFilterChange if values differ
      if (
        localSearch !== filters.search ||
        localMin !== filters.minAmount ||
        localMax !== filters.maxAmount
      ) {
        onFilterChange({
          ...filters,
          search: localSearch,
          minAmount: localMin,
          maxAmount: localMax
        });
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(handler);
  }, [localSearch, localMin, localMax, filters, onFilterChange]);

  // Direct handlers for Date and Category (no debounce needed usually, but safe to keep direct)
  const handleDateOrCatChange = (key: keyof TransactionFilter, value: string) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const hasActiveFilters = Object.values(filters).some(val => val !== '');

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center">
          <Filter className="w-4 h-4 mr-2 text-slate-500" />
          Filter Data
        </h3>
        {hasActiveFilters && (
          <button 
            onClick={onClear}
            className="text-xs text-rose-500 hover:text-rose-700 flex items-center font-medium"
          >
            <X className="w-3 h-3 mr-1" /> Clear Filters
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Search */}
        <div className="relative col-span-1 lg:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search description..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
          />
        </div>

        {/* Date Range */}
        <div className="flex space-x-2 lg:col-span-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <Calendar className="w-3 h-3" />
            </span>
            <input
              type="date"
              placeholder="Start Date"
              className="w-full pl-8 pr-2 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-600"
              value={filters.startDate}
              onChange={(e) => handleDateOrCatChange('startDate', e.target.value)}
            />
          </div>
          <div className="relative flex-1">
             <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <Calendar className="w-3 h-3" />
            </span>
            <input
              type="date"
              className="w-full pl-8 pr-2 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-600"
              value={filters.endDate}
              onChange={(e) => handleDateOrCatChange('endDate', e.target.value)}
            />
          </div>
        </div>

        {/* Category */}
        <div className="flex gap-2">
          <select
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            value={filters.category}
            onChange={(e) => handleDateOrCatChange('category', e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button 
            onClick={onOpenCategoryManager}
            className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-lg border border-slate-200 transition-colors"
            title="Manage Categories"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Amount Range */}
        <div className="flex space-x-2">
          <input
            type="number"
            placeholder="Min $"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={localMin}
            onChange={(e) => setLocalMin(e.target.value)}
          />
          <input
            type="number"
            placeholder="Max $"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={localMax}
            onChange={(e) => setLocalMax(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};

export default FilterBar;