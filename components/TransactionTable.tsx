
import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType, Category } from '../types';
import { 
  Trash2, Calendar, Tag, ArrowUpRight, ArrowDownLeft, 
  Loader2, CloudCheck, Briefcase, ChevronUp, ChevronDown,
  ArrowUpDown, CheckSquare, Square, Zap, Wand2, PlusCircle,
  AlertCircle, X, ChevronRight
} from 'lucide-react';

interface TransactionTableProps {
  transactions: Transaction[];
  categories: Category[];
  onUpdateTransaction: (updated: Transaction) => Promise<void> | void;
  onDeleteTransaction: (id: string) => void;
  onBulkUpdate?: (ids: string[], updates: Partial<Transaction>) => Promise<void>;
  onBulkDelete?: (ids: string[]) => Promise<void>;
  onCreateRule?: (keyword: string, categoryId: string) => void;
}

type SortKey = 'date' | 'description' | 'category' | 'amount' | 'entityName';
type SortDirection = 'asc' | 'desc';

const TransactionTable: React.FC<TransactionTableProps> = ({ 
  transactions, 
  categories,
  onUpdateTransaction,
  onDeleteTransaction,
  onBulkUpdate,
  onBulkDelete,
  onCreateRule
}) => {
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleUpdate = async (t: Transaction, updates: Partial<Transaction>) => {
    const updated = { ...t, ...updates };
    setSavingIds(prev => new Set(prev).add(t.id));
    try {
      await onUpdateTransaction(updated);
      setTimeout(() => {
        setSavingIds(prev => {
          const next = new Set(prev);
          next.delete(t.id);
          return next;
        });
      }, 800);
    } catch (err) {
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(t.id);
        return next;
      });
    }
  };

  const handleBulkCategorize = async (categoryId: string) => {
    if (!onBulkUpdate || selectedIds.size === 0) return;
    const cat = categories.find(c => c.id === categoryId);
    if (!cat) return;

    const ids = Array.from(selectedIds);
    setSavingIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      return next;
    });

    try {
      await onBulkUpdate(ids, { categoryId: cat.id, category: cat.name });
      setSelectedIds(new Set());
    } finally {
      setSavingIds(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
    }
  };

  const findSimilar = (description: string) => {
    const keyword = description.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    if (keyword.length < 3) return;

    const similar = transactions.filter(t => 
      t.description.toLowerCase().includes(keyword) && 
      (t.category === 'Uncategorized' || !t.categoryId)
    );
    setSelectedIds(new Set(similar.map(s => s.id)));
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === transactions.length && transactions.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions.map(t => t.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      let valA: any = a[sortKey];
      let valB: any = b[sortKey];
      if (sortKey === 'date') {
        return sortDirection === 'asc' 
          ? new Date(valA || 0).getTime() - new Date(valB || 0).getTime()
          : new Date(valB || 0).getTime() - new Date(valA || 0).getTime();
      }
      if (sortKey === 'amount') {
        return sortDirection === 'asc' ? (valA - valB) : (valB - valA);
      }
      const strA = String(valA || '').toLowerCase();
      const strB = String(valB || '').toLowerCase();
      return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [transactions, sortKey, sortDirection]);

  const SortIndicator = ({ column }: { column: SortKey }) => {
    const isActive = sortKey === column;
    return (
      <div className={`ml-1 transition-all ${isActive ? 'text-indigo-600' : 'text-slate-300 opacity-0 group-hover:opacity-100'}`}>
        {!isActive ? <ArrowUpDown className="w-3 h-3" /> : sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </div>
    );
  };

  return (
    <div className="relative flex flex-col h-full min-h-[400px]">
      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 z-[60] bg-slate-900 text-white px-5 py-4 md:px-8 md:py-5 rounded-[2rem] shadow-2xl flex flex-col md:flex-row items-center gap-4 md:gap-8 animate-slide-up border border-white/10 backdrop-blur-xl">
          <div className="flex items-center justify-between w-full md:w-auto md:pr-6 md:border-r md:border-white/10">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2 rounded-xl">
                <CheckSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Selection</span>
                <span className="text-sm font-black text-indigo-400">{selectedIds.size} Items</span>
              </div>
            </div>
            <button onClick={() => setSelectedIds(new Set())} className="md:hidden p-2 text-slate-500">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <select 
              onChange={(e) => handleBulkCategorize(e.target.value)}
              className="flex-1 md:flex-none bg-white/10 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-tight text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none min-w-[140px]"
              defaultValue=""
            >
              <option value="" disabled className="bg-slate-800">Batch Categorize...</option>
              {categories.map(c => <option key={c.id} value={c.id} className="bg-slate-800">{c.name}</option>)}
            </select>
            
            <button 
              onClick={() => {
                if(confirm(`Purge ${selectedIds.size} records?`)) {
                   const ids = Array.from(selectedIds);
                   if (onBulkDelete) {
                     onBulkDelete(ids);
                   } else {
                     ids.forEach(id => onDeleteTransaction(id));
                   }
                   setSelectedIds(new Set());
                }
              }}
              className="p-3 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl transition-all"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>

          <button onClick={() => setSelectedIds(new Set())} className="hidden md:flex p-2 text-slate-500 hover:text-white transition-colors bg-white/5 rounded-full">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col flex-1">
        <div className="px-5 py-4 md:px-8 md:py-6 border-b border-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/20">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <button 
              onClick={toggleSelectAll}
              className={`p-2 rounded-xl transition-all ${selectedIds.size === transactions.length && transactions.length > 0 ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-300'}`}
            >
              <CheckSquare className="w-5 h-5" />
            </button>
            <div>
              <h3 className="text-lg md:text-xl font-black text-slate-800 tracking-tight">Ledger Records</h3>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">{transactions.length} total entries</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-4">
             <div className="flex items-center gap-2 text-[10px] font-black text-amber-600 bg-amber-50 px-4 py-2 rounded-2xl border border-amber-100">
               <AlertCircle className="w-4 h-4" />
               {transactions.filter(t => t.category === 'Uncategorized' || !t.categoryId).length} UNMAPPED
             </div>
             <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 bg-white px-4 py-2 rounded-2xl border border-slate-100">
               <CloudCheck className="w-4 h-4 text-emerald-500" />
               SYNCED
             </div>
          </div>
        </div>
        
        <div className="md:hidden overflow-auto flex-1 divide-y divide-slate-100">
           {sortedTransactions.map((t) => {
             const isSelected = selectedIds.has(t.id);
             const isUncategorized = t.category === 'Uncategorized' || !t.categoryId;
             const isSaving = savingIds.has(t.id);
             
             return (
               <div key={t.id} className={`p-5 transition-all relative ${isSelected ? 'bg-indigo-50/50' : ''}`}>
                 <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0 pr-4" onClick={() => toggleSelect(t.id)}>
                      <p className={`text-xs font-black uppercase tracking-widest mb-1 ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {t.date} • {t.type}
                      </p>
                      <h4 className="text-sm font-bold text-slate-800 break-words leading-tight mb-1">{t.description}</h4>
                      {t.entityName && <span className="text-[9px] font-black text-indigo-400 uppercase tracking-tighter">@{t.entityName}</span>}
                    </div>
                    <div className="text-right shrink-0" onClick={() => toggleSelect(t.id)}>
                      <p className={`text-lg font-black tabular-nums ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-slate-900'}`}>
                        ${t.amount.toFixed(2)}
                      </p>
                    </div>
                 </div>

                 <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                       <select 
                          value={t.categoryId || (categories.find(c => c.name === t.category)?.id) || ''} 
                          onChange={(e) => {
                            const selectedId = e.target.value;
                            const cat = categories.find(c => c.id === selectedId);
                            if (cat) handleUpdate(t, { categoryId: cat.id, category: cat.name });
                          }} 
                          className={`w-full bg-white border ${isUncategorized ? 'border-amber-200 text-amber-700 bg-amber-50/30' : 'border-slate-200 text-slate-600'} rounded-xl px-3 py-2 text-xs font-bold appearance-none transition-all`}
                        >
                          <option value="" disabled>Choose Account...</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 pointer-events-none" />
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isSaving ? (
                        <Loader2 className="w-5 h-5 animate-spin text-indigo-500 mx-2" />
                      ) : (
                        <button 
                          onClick={() => { if(confirm('Delete?')) onDeleteTransaction(t.id) }} 
                          className="p-2.5 bg-slate-50 text-slate-400 rounded-xl border border-slate-100"
                        >
                          <Trash2 className="w-4 h-4 hover:text-rose-500 transition-colors" />
                        </button>
                      )}
                    </div>
                 </div>
               </div>
             );
           })}
        </div>
        
        <div className="hidden md:block overflow-auto flex-1 px-4">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-slate-400 font-medium sticky top-0 z-10 bg-white/80 backdrop-blur-md">
              <tr>
                <th className="w-16 px-4 py-6"></th>
                <th onClick={() => handleSort('date')} className="px-4 py-6 cursor-pointer group hover:text-indigo-600 transition-colors">
                  <div className="flex items-center text-[10px] font-black uppercase tracking-widest">Date <SortIndicator column="date" /></div>
                </th>
                <th onClick={() => handleSort('description')} className="px-4 py-6 cursor-pointer group hover:text-indigo-600 transition-colors">
                  <div className="flex items-center text-[10px] font-black uppercase tracking-widest">Description <SortIndicator column="description" /></div>
                </th>
                <th onClick={() => handleSort('category')} className="px-4 py-6 cursor-pointer group hover:text-indigo-600 transition-colors">
                  <div className="flex items-center text-[10px] font-black uppercase tracking-widest text-right justify-end">Account Category <SortIndicator column="category" /></div>
                </th>
                <th onClick={() => handleSort('amount')} className="px-4 py-6 text-right cursor-pointer group hover:text-indigo-600 transition-colors">
                  <div className="flex items-center justify-end text-[10px] font-black uppercase tracking-widest">Amount <SortIndicator column="amount" /></div>
                </th>
                <th className="px-6 py-6 text-center w-32 text-[10px] font-black uppercase tracking-widest">AI Tools</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sortedTransactions.map((t) => {
                const isSelected = selectedIds.has(t.id);
                const isUncategorized = t.category === 'Uncategorized' || !t.categoryId;
                
                return (
                  <tr key={t.id} className={`transition-all group ${isSelected ? 'bg-indigo-50/50' : 'hover:bg-slate-50/50'}`}>
                    <td className="px-4 py-4 text-center">
                      <button 
                        onClick={() => toggleSelect(t.id)} 
                        className={`transition-all p-2 rounded-xl border ${isSelected ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-transparent border-slate-100 text-slate-200 group-hover:border-slate-200'}`}
                      >
                        {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-4 py-4 text-slate-400 font-mono text-[11px] whitespace-nowrap">{t.date}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col min-w-0">
                        <span className="text-slate-800 font-bold text-sm truncate group-hover:text-indigo-900 transition-colors" title={t.description}>{t.description}</span>
                        {t.entityName && (
                          <span className="text-[9px] font-black text-indigo-400 uppercase tracking-tighter flex items-center gap-1 mt-1">
                            <Briefcase className="w-2.5 h-2.5" /> {String(t.entityName)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2 group/cat">
                        <select 
                          value={t.categoryId || (categories.find(c => c.name === t.category)?.id) || ''} 
                          onChange={(e) => {
                            const selectedId = e.target.value;
                            const cat = categories.find(c => c.id === selectedId);
                            if (cat) handleUpdate(t, { categoryId: cat.id, category: cat.name });
                          }} 
                          className={`bg-white border ${isUncategorized ? 'border-amber-200 text-amber-700 bg-amber-50/20' : 'border-slate-100 text-slate-600'} rounded-2xl px-4 py-2 text-xs font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 cursor-pointer min-w-[180px] shadow-sm transition-all hover:border-indigo-200`}
                        >
                          <option value="" disabled>Select Account...</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className={`px-4 py-4 text-right font-black text-sm tabular-nums ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-slate-900'}`}>
                       {t.type === TransactionType.INCOME ? '+' : '-'}${Number(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {savingIds.has(t.id) ? (
                          <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                        ) : (
                          <>
                            <button 
                              onClick={() => onCreateRule && onCreateRule(t.description, t.categoryId || '')}
                              className="p-2.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl opacity-0 group-hover:opacity-100 transition-all bg-white border border-slate-50 shadow-sm"
                              title="Promote to Rule"
                            >
                              <Zap className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => { if(confirm('Delete?')) onDeleteTransaction(t.id) }} 
                              className="p-2.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-2xl opacity-0 group-hover:opacity-100 transition-all bg-white border border-slate-50 shadow-sm"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TransactionTable;
