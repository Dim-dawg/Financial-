
import React, { useEffect, useState, useMemo } from 'react';
import { Filter, X, Search, Calendar, Settings, ChevronDown, Loader2, RefreshCw, Terminal, Cloud } from 'lucide-react';
import { TransactionFilter, Category } from '../types';

interface FilterBarProps {
  filters: TransactionFilter;
  categories: Category[];
  onFilterChange: (filters: TransactionFilter) => void;
  onClear: () => void;
  onOpenCategoryManager: () => void;
  totalCount: number;
  filteredCount: number;
  isLoading?: boolean;
}

const FilterBar: React.FC<FilterBarProps> = ({ 
  filters, 
  categories, 
  onFilterChange, 
  onClear, 
  onOpenCategoryManager,
  totalCount,
  filteredCount,
  isLoading = false
}) => {
  const [localSearch, setLocalSearch] = useState(filters.search);
  const [localMin, setLocalMin] = useState(filters.minAmount);
  const [localMax, setLocalMax] = useState(filters.maxAmount);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setLocalSearch(filters.search);
    setLocalMin(filters.minAmount);
    setLocalMax(filters.maxAmount);
  }, [filters.search, filters.minAmount, filters.maxAmount]);

  const handleImmediate = (key: keyof TransactionFilter, value: string) => {
    onFilterChange({ 
      ...filters, 
      [key]: value,
      search: localSearch,
      minAmount: localMin,
      maxAmount: localMax
    });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (
        localSearch !== filters.search ||
        localMin !== filters.minAmount ||
        localMax !== filters.maxAmount
      ) {
        onFilterChange({ ...filters, search: localSearch, minAmount: localMin, maxAmount: localMax });
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [localSearch, localMin, localMax, filters, onFilterChange]);

  const hasActiveFilters = Object.values(filters).some(v => v !== '');
  const inputBase = "w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-50 placeholder:text-slate-400";

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden mb-6 relative">
      {/* Query Status Bar - Compact for Mobile */}
      <div className="bg-slate-900 px-4 py-2 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-2 overflow-hidden">
          <Terminal className="w-3 h-3 text-indigo-400 shrink-0" />
          <span className="text-[9px] font-mono text-indigo-300/60 truncate uppercase tracking-wide">
            {isLoading ? 'SYNCING...' : 'LIVE_LEDGER_QUERY'}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[8px] font-black text-white/40 uppercase tracking-widest hidden sm:block">Supabase</span>
          <div className={`w-1.5 h-1.5 rounded-full ${isLoading ? 'bg-indigo-400 animate-pulse' : 'bg-emerald-500'}`} />
        </div>
      </div>

      <div className="p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Filter className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Filters</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase">
                <span className="text-indigo-600">{filteredCount}</span> Results
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button onClick={onClear} className="p-2 text-slate-400 hover:text-rose-500 transition-all">
                <X className="w-4 h-4" />
              </button>
            )}
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="md:hidden p-2 text-slate-400 hover:text-indigo-600"
            >
              <ChevronDown className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        <div className={`${isExpanded ? 'block' : 'hidden'} md:block space-y-4`}>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <input type="text" placeholder="Search description..." className={`${inputBase} pl-9`} value={localSearch} onChange={(e) => setLocalSearch(e.target.value)} disabled={isLoading} />
              </div>
            </div>

            <div className="md:col-span-5">
              <div className="flex items-center gap-2">
                <input type="date" className={inputBase} value={filters.startDate} onChange={(e) => handleImmediate('startDate', e.target.value)} disabled={isLoading} />
                <span className="text-slate-300 font-black text-[9px]">TO</span>
                <input type="date" className={inputBase} value={filters.endDate} onChange={(e) => handleImmediate('endDate', e.target.value)} disabled={isLoading} />
              </div>
            </div>

            <div className="md:col-span-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <select className={`${inputBase} appearance-none pr-10 cursor-pointer`} value={filters.category} onChange={(e) => handleImmediate('category', e.target.value)} disabled={isLoading}>
                    <option value="">All Accounts</option>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
                </div>
                <button onClick={onOpenCategoryManager} className="p-2.5 bg-slate-50 border border-slate-200 text-slate-400 hover:text-indigo-600 rounded-xl transition-colors shrink-0">
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
