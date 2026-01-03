
import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, TransactionType, Category, EntityProfile } from '../types';
import { 
  Trash2, Calendar, Tag, ArrowUpRight, ArrowDownLeft, 
  Loader2, CheckSquare, ChevronUp, ChevronDown,
  ArrowUpDown, X, Building, Link2, Search, ChevronLeft, ChevronRight,
  UserPlus, CheckCircle2, Sparkles
} from 'lucide-react';
import SimilarTransactionsModal from './SimilarTransactionsModal';

interface TransactionTableProps {
  transactions: Transaction[];
  categories: Category[];
  profiles?: EntityProfile[];
  onUpdateTransaction: (updated: Transaction) => Promise<void> | void;
  onDeleteTransaction: (id: string) => void;
  onBulkUpdate?: (ids: string[], updates: Partial<Transaction>) => Promise<void>;
  onBulkUpload?: (transactions: Transaction[]) => Promise<void>;
  onCreateProfile?: (profile: EntityProfile) => Promise<EntityProfile | null>;
}

type SortKey = 'date' | 'description' | 'category' | 'amount';
type SortDirection = 'asc' | 'desc';

const TransactionTable: React.FC<TransactionTableProps> = ({ 
  transactions, 
  categories,
  profiles = [],
  onUpdateTransaction,
  onDeleteTransaction,
  onBulkUpdate,
  onCreateProfile
}) => {
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Creation Modal State
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileType, setNewProfileType] = useState<'VENDOR' | 'CLIENT'>('VENDOR');
  const [pendingTransactionId, setPendingTransactionId] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Similar modal state
  const [modalBaseTx, setModalBaseTx] = useState<Transaction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const openSimilarModal = (t: Transaction) => {
    setModalBaseTx(t);
    setIsModalOpen(true);
  };

  const handleModalApply = async (ids: string[], updates: Partial<Transaction>) => {
    if (onBulkUpdate) await onBulkUpdate(ids, updates);
  };

  const handleModalUpload = async (txs: Transaction[]) => {
    if (onBulkUpload) await onBulkUpload(txs);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [transactions.length, sortKey, sortDirection]);

  // Alphabetical Profiles
  const sortedProfiles = useMemo(() => {
    return [...profiles].sort((a, b) => a.name.localeCompare(b.name));
  }, [profiles]);

  const handleUpdate = async (t: Transaction, updates: Partial<Transaction>) => {
    const updated = { ...t, ...updates };
    setSavingIds(prev => new Set(prev).add(t.id));
    try {
      await onUpdateTransaction(updated);
    } finally {
      setTimeout(() => {
        setSavingIds(prev => {
          const next = new Set(prev);
          next.delete(t.id);
          return next;
        });
      }, 500);
    }
  };

  const handleEntityChange = (t: Transaction, value: string) => {
    if (value === 'NEW__') {
      setPendingTransactionId(t.id);
      setNewProfileName(t.entityName || t.description || ''); // Pre-fill
      setIsCreatingProfile(true);
    } else {
      const p = profiles.find(prof => prof.id === value);
      handleUpdate(t, { entityId: value || undefined, entityName: p?.name });
    }
  };

  const confirmCreateProfile = async () => {
    if (!newProfileName || !onCreateProfile) return;
    setIsSavingProfile(true);
    try {
      const newProfile: EntityProfile = {
        id: `prof-${Date.now()}`,
        name: newProfileName,
        type: newProfileType,
        description: 'Created from Ledger',
        tags: [],
        keywords: [newProfileName],
      };

      const created = await onCreateProfile(newProfile);
      
      if (created && pendingTransactionId) {
        const t = transactions.find(tr => tr.id === pendingTransactionId);
        if (t) {
          await handleUpdate(t, { entityId: created.id, entityName: created.name });
        }
      }
      setIsCreatingProfile(false);
      setNewProfileName('');
      setPendingTransactionId(null);
    } catch (e) {
      console.error(e);
      alert('Failed to create profile');
    } finally {
      setIsSavingProfile(false);
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

  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      let valA: any = a[sortKey];
      let valB: any = b[sortKey];
      if (sortKey === 'date') {
        return sortDirection === 'asc' 
          ? new Date(valA).getTime() - new Date(valB).getTime()
          : new Date(valB).getTime() - new Date(valA).getTime();
      }
      if (sortKey === 'amount') {
        return sortDirection === 'asc' ? (valA - valB) : (valB - valA);
      }
      const strA = String(valA || '').toLowerCase();
      const strB = String(valB || '').toLowerCase();
      return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [transactions, sortKey, sortDirection]);

  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedTransactions.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedTransactions, currentPage]);

  const totalPages = Math.ceil(sortedTransactions.length / itemsPerPage);

  const toggleSelectAll = () => {
    if (selectedIds.size === transactions.length && transactions.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions.map(t => t.id)));
    }
  };

  return (
    <div className="relative flex flex-col h-full min-h-[400px] space-y-4">
      {/* Creation Modal */}
      {isCreatingProfile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full animate-scale-up border border-slate-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600">
                <UserPlus size={20} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800 tracking-tight">New Identity</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quick Create</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Name</label>
                <input 
                  autoFocus
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:border-indigo-500 outline-none"
                  value={newProfileName}
                  onChange={e => setNewProfileName(e.target.value)}
                  placeholder="Entity Name"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Type</label>
                <select 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:border-indigo-500 outline-none"
                  value={newProfileType}
                  onChange={e => setNewProfileType(e.target.value as any)}
                >
                  <option value="VENDOR">Vendor (Outgoing)</option>
                  <option value="CLIENT">Client (Incoming)</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={confirmCreateProfile}
                  disabled={!newProfileName || isSavingProfile}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-500 disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {isSavingProfile ? <Loader2 className="animate-spin w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                  Create
                </button>
                <button 
                  onClick={() => setIsCreatingProfile(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batch Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 text-white px-6 py-4 rounded-[2rem] shadow-2xl flex items-center gap-4 animate-slide-up border border-white/10">
          <span className="text-xs font-black uppercase tracking-widest">{selectedIds.size} Selected</span>
          <select 
            onChange={(e) => handleBulkCategorize(e.target.value)}
            className="bg-slate-800 border-none rounded-xl px-4 py-2 text-xs font-black uppercase tracking-tight text-white focus:outline-none cursor-pointer"
            defaultValue=""
          >
            <option value="" disabled>Move to Account...</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={() => setSelectedIds(new Set())} className="p-2 text-slate-500 hover:text-white"><X size={18}/></button>
        </div>
      )}

      {/* Pagination Controls - Top */}
      <div className="flex items-center justify-between px-2">
         <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
           Showing {Math.min((currentPage - 1) * itemsPerPage + 1, sortedTransactions.length)} - {Math.min(currentPage * itemsPerPage, sortedTransactions.length)} of {sortedTransactions.length}
         </span>
         <div className="flex gap-2">
           <button 
             onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
             disabled={currentPage === 1}
             className="p-2 bg-white border border-slate-200 rounded-xl disabled:opacity-50 hover:bg-slate-50 transition-colors"
           >
             <ChevronLeft size={16} className="text-slate-600" />
           </button>
           <button 
             onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
             disabled={currentPage === totalPages}
             className="p-2 bg-white border border-slate-200 rounded-xl disabled:opacity-50 hover:bg-slate-50 transition-colors"
           >
             <ChevronRight size={16} className="text-slate-600" />
           </button>
         </div>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col flex-1">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 w-12">
                  <button onClick={toggleSelectAll} className={`p-1.5 rounded-lg border-2 transition-all ${selectedIds.size === transactions.length ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-transparent'}`}>
                    <CheckSquare size={14} />
                  </button>
                </th>
                <th onClick={() => setSortKey('date')} className="px-4 py-4 cursor-pointer hover:bg-slate-100 transition">
                  <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Date <ArrowUpDown size={10}/></div>
                </th>
                <th className="px-4 py-4 min-w-[200px]">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Description</div>
                </th>
                <th className="px-4 py-4 min-w-[150px]">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Linked Identity</div>
                </th>
                <th className="px-4 py-4 min-w-[150px]">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">GL Account</div>
                </th>
                <th onClick={() => setSortKey('amount')} className="px-6 py-4 text-right cursor-pointer hover:bg-slate-100 transition">
                  <div className="flex items-center justify-end gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Amount <ArrowUpDown size={10}/></div>
                </th>
                <th className="px-6 py-4 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginatedTransactions.map((t) => {
                const isSaving = savingIds.has(t.id);
                // Determine the best value for category select
                const currentCatId = t.categoryId || categories.find(c => c.name === t.category)?.id || '';

                return (
                  <tr key={t.id} className={`group hover:bg-slate-50/50 transition-all ${selectedIds.has(t.id) ? 'bg-indigo-50/30' : ''}`}>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => {
                          const next = new Set(selectedIds);
                          if (next.has(t.id)) next.delete(t.id); else next.add(t.id);
                          setSelectedIds(next);
                        }} 
                        className={`p-1.5 rounded-lg border-2 transition-all ${selectedIds.has(t.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-100 text-transparent hover:border-slate-300'}`}
                      >
                        <CheckSquare size={14} />
                      </button>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-xs font-bold text-slate-500 tabular-nums">{t.date}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-black text-slate-800 truncate">{t.description}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight truncate">{t.originalDescription}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="relative group/sel">
                        <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5 pointer-events-none" />
                        <select 
                          value={t.entityId || ''} 
                          onChange={(e) => handleEntityChange(t, e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border-2 border-transparent hover:border-indigo-200 rounded-xl text-[10px] font-black uppercase tracking-tight outline-none appearance-none transition-all cursor-pointer text-slate-900"
                        >
                          <option value="">-- Unlinked --</option>
                          <option value="NEW__" className="font-bold text-indigo-600">+ Create New Identity</option>
                          <optgroup label="Existing Profiles">
                            {sortedProfiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </optgroup>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 w-3 h-3 pointer-events-none" />
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="relative">
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5 pointer-events-none" />
                        <select 
                          value={currentCatId} 
                          onChange={(e) => {
                            const catId = e.target.value;
                            const cat = categories.find(c => c.id === catId);
                            if (cat) {
                                handleUpdate(t, { category: cat.name, categoryId: cat.id });
                            } else if (catId === 'Uncategorized') {
                                handleUpdate(t, { category: 'Uncategorized', categoryId: undefined });
                            }
                          }}
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border-2 border-transparent hover:border-indigo-200 rounded-xl text-[10px] font-black uppercase tracking-tight outline-none appearance-none transition-all cursor-pointer text-slate-900"
                        >
                          <option value="">Uncategorized</option>
                          <option value="Uncategorized">Uncategorized</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className={`text-xs font-black tabular-nums ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-slate-900'}`}>
                          {t.type === TransactionType.INCOME ? '+' : '-'}${t.amount.toFixed(2)}
                        </span>
                        {isSaving && <Loader2 className="w-2.5 h-2.5 animate-spin text-indigo-500 mt-1" />}
                      </div>
                    </td>
                    <td className="px-6 py-4 flex items-center gap-2">
                      <button onClick={() => openSimilarModal(t)} title="Find Similar" className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                        <Sparkles size={16} />
                      </button>
                      <button onClick={() => onDeleteTransaction(t.id)} className="p-2 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {transactions.length === 0 && (
            <div className="py-20 text-center">
              <Search className="w-12 h-12 text-slate-100 mx-auto mb-4" />
              <p className="text-slate-400 text-xs font-black uppercase tracking-widest">No matching records</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Similar Modal */}
      {isModalOpen && modalBaseTx && (
        <SimilarTransactionsModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          base={modalBaseTx}
          transactions={transactions}
          profiles={profiles}
          categories={categories}
          onApply={handleModalApply}
          onUpload={handleModalUpload}
        />
      )}

      {/* Pagination Controls - Bottom */}
      {totalPages > 1 && (
        <div className="flex justify-center pb-8">
            <div className="flex gap-2">
                <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl disabled:opacity-50 hover:bg-slate-50 transition-colors text-xs font-bold text-slate-600"
                >
                Previous
                </button>
                <div className="flex items-center px-4 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-800">
                    Page {currentPage} of {totalPages}
                </div>
                <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl disabled:opacity-50 hover:bg-slate-50 transition-colors text-xs font-bold text-slate-600"
                >
                Next
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default TransactionTable;
