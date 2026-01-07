
import React, { useState, useMemo, useRef, useLayoutEffect, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Transaction, EntityProfile, Category, TransactionType } from '../types';
import { 
  Users, UserPlus, Search, 
  ChevronRight, ArrowLeft, Trash2, Building,
  Loader2, Edit2, Wand2, RefreshCw, X,
  CheckCircle2, Zap, ArrowRight, Tag,
  ShieldAlert, LayoutGrid, List, ChevronUp, ChevronDown, ExternalLink, Info,
  Sparkles, Globe, TrendingUp, TrendingDown, History, CreditCard, AlignLeft,
  AlertCircle, Unlink
} from 'lucide-react';
import SimilarTransactionsModal from './SimilarTransactionsModal';
import { autoFillProfileData } from '../services/geminiService';
import { bulkApplyProfileRule } from '../services/supabaseService';

interface EntityProfilesProps {
  transactions: Transaction[];
  profiles: EntityProfile[];
  categories: Category[];
  onAddProfile: (profile: EntityProfile) => Promise<EntityProfile | null>;
  onUpdateProfile: (profile: EntityProfile) => Promise<EntityProfile | null>;
  onDeleteProfile: (id: string) => Promise<void> | void;
  onUpdateTransaction: (transaction: Transaction) => Promise<void> | void;
  onBulkUpload?: (transactions: Transaction[]) => Promise<void>;
  onRefreshData?: () => void;
}

const EntityProfiles: React.FC<EntityProfilesProps> = ({ 
  transactions, 
  profiles, 
  categories,
  onAddProfile, 
  onUpdateProfile, 
  onDeleteProfile,
  onUpdateTransaction,
  onRefreshData,
  onBulkUpload
}) => {
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [view, setView] = useState<'DIRECTORY' | 'DETAIL' | 'EDITOR'>('DIRECTORY');
  const [editingProfile, setEditingProfile] = useState<EntityProfile | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [profileToDeleteId, setProfileToDeleteId] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  // Similar modal state
  const [modalBaseTx, setModalBaseTx] = useState<Transaction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Pagination State
  const [detailPage, setDetailPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  // Refs for scroll restoration
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const savedScrollPosition = useRef<number>(0);

  // Restore scroll when switching back to DIRECTORY
  useLayoutEffect(() => {
    if (view === 'DIRECTORY' && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = savedScrollPosition.current;
    }
  }, [view]);

  // Reset pagination when selection changes
  useEffect(() => {
    setDetailPage(1);
  }, [selectedEntityId]);

  const selectedEntity = useMemo(() => {
    if (selectedEntityId === 'UNASSIGNED') return { id: 'UNASSIGNED', name: 'Unassigned Transactions', type: 'SYSTEM' } as any;
    const targetId = selectedEntityId || editingProfile?.id;
    return profiles.find(p => p.id === targetId) || null;
  }, [profiles, selectedEntityId, editingProfile]);

  const profileToDelete = useMemo(() => {
    return profiles.find(p => p.id === profileToDeleteId) || null;
  }, [profiles, profileToDeleteId]);

  const linkedTransactions = useMemo(() => {
    if (selectedEntityId === 'UNASSIGNED') {
      return transactions.filter(t => !t.entityId);
    }
    if (!selectedEntityId) return [];
    return transactions.filter(t => t.entityId === selectedEntityId);
  }, [transactions, selectedEntityId]);

  // Pagination Logic
  const paginatedTransactions = useMemo(() => {
    const sorted = [...linkedTransactions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const startIndex = (detailPage - 1) * ITEMS_PER_PAGE;
    return sorted.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [linkedTransactions, detailPage]);

  const totalPages = Math.ceil(linkedTransactions.length / ITEMS_PER_PAGE);

  const unassignedCount = useMemo(() => transactions.filter(t => !t.entityId).length, [transactions]);
  const unassignedVolume = useMemo(() => transactions.filter(t => !t.entityId).reduce((sum, t) => sum + t.amount, 0), [transactions]);

  const handleConfirmDelete = async () => {
    if (!profileToDeleteId) return;
    setIsDeleting(true);
    try {
      await onDeleteProfile(profileToDeleteId);
      setToast({ message: "Identity purged from vault.", type: 'success' });
      setProfileToDeleteId(null);
      if (selectedEntityId === profileToDeleteId) {
        setSelectedEntityId(null);
        setView('DIRECTORY');
      }
    } catch (err) {
      setToast({ message: "Purge failed. Try again.", type: 'error' });
    } finally {
      setIsDeleting(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleAssignTransaction = async (t: Transaction, profileId: string) => {
    setAssigningId(t.id);
    try {
       const profile = profiles.find(p => p.id === profileId);
       const updated = { ...t, entityId: profileId, entityName: profile?.name };
       await onUpdateTransaction(updated);
       setToast({ message: "Transaction assigned.", type: 'success' });
    } catch (e) {
      console.error(e);
      setToast({ message: "Assignment failed.", type: 'error' });
    } finally {
      setAssigningId(null);
      setTimeout(() => setToast(null), 2000);
    }
  };

  const handleUnlinkTransaction = async (t: Transaction) => {
    setAssigningId(t.id);
    try {
      const updated = { ...t, entityId: undefined, entityName: undefined };
      await onUpdateTransaction(updated);
      setToast({ message: "Transaction unlinked.", type: 'success' });
    } catch (e) {
      setToast({ message: "Failed to unlink.", type: 'error' });
    } finally {
      setAssigningId(null);
      setTimeout(() => setToast(null), 2000);
    }
  };

  const groupedProfiles = useMemo(() => {
    const filtered = profiles
      .filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (p.keywords && p.keywords.some(k => k.toLowerCase().includes(searchTerm.toLowerCase())))
      )
      .sort((a, b) => a.name.localeCompare(b.name));

    const groups: Record<string, EntityProfile[]> = {};
    filtered.forEach(p => {
      const firstChar = p.name[0]?.toUpperCase() || '#';
      const letter = /^[A-Z]$/.test(firstChar) ? firstChar : '#';
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(p);
    });

    return Object.entries(groups).sort(([a], [b]) => {
      if (a === '#') return 1;
      if (b === '#') return -1;
      return a.localeCompare(b);
    });
  }, [profiles, searchTerm]);

  const handleOpenEditor = (profile?: EntityProfile) => {
    if (scrollContainerRef.current) {
      savedScrollPosition.current = scrollContainerRef.current.scrollTop;
    }
    setEditingProfile(profile || null);
    setView('EDITOR');
  };

  const handleOpenDetail = (id: string) => {
    if (scrollContainerRef.current) {
      savedScrollPosition.current = scrollContainerRef.current.scrollTop;
    }
    setSelectedEntityId(id);
    setView('DETAIL');
  };

  const handleSave = async (data: EntityProfile, runBulkApply: boolean = false) => {
    try {
      if (editingProfile) {
        await onUpdateProfile(data);
        setToast({ message: `Identity updated successfully.`, type: 'success' });
      } else {
        await onAddProfile(data);
        setToast({ message: `New identity registered.`, type: 'success' });
      }
      setView('DIRECTORY');
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error(err);
      setToast({ message: 'Operation failed. Check connection.', type: 'error' });
    } finally {
      setTimeout(() => setToast(null), 3000);
    }
  };

  if (view === 'EDITOR') {
    return (
      <div className="h-full overflow-y-auto no-scrollbar">
        <ProfileEditor 
          profile={editingProfile} 
          categories={categories}
          onSave={handleSave}
          onCancel={() => setView('DIRECTORY')}
        />
      </div>
    );
  }

  if (view === 'DETAIL' && selectedEntity) {
    const isUnassignedView = selectedEntity.id === 'UNASSIGNED';
    const totalVolume = isUnassignedView ? unassignedVolume : linkedTransactions.reduce((sum, t) => sum + t.amount, 0);
    
    return (
      <div className="h-full overflow-y-auto no-scrollbar">
        <div className="flex flex-col animate-fade-in space-y-8 pb-32">
          <div className="flex items-center justify-between">
            <button onClick={() => setView('DIRECTORY')} className="text-slate-500 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 group">
              <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Directory
            </button>
            {!isUnassignedView && (
              <div className="flex gap-2">
                <button 
                  onClick={() => handleOpenEditor(selectedEntity)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition flex items-center gap-2"
                >
                  <Edit2 size={14} /> Edit
                </button>
                <button 
                  onClick={() => setProfileToDeleteId(selectedEntity.id)}
                  className="px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition flex items-center gap-2"
                >
                  <Trash2 size={14} /> Purge
                </button>
              </div>
            )}
          </div>

          <div className={`bg-white rounded-[2.5rem] border-2 ${isUnassignedView ? 'border-amber-100' : 'border-slate-100'} p-8 shadow-sm`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
              <div className="flex items-center gap-6">
                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center text-3xl shadow-inner ${isUnassignedView ? 'bg-amber-100 text-amber-600' : (selectedEntity.type === 'VENDOR' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600')}`}>
                  {isUnassignedView ? <AlertCircle size={40} /> : <Building size={40} />}
                </div>
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{selectedEntity.name}</h2>
                  <div className="flex items-center gap-3 mt-1">
                    {!isUnassignedView ? (
                      <>
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                          {selectedEntity.type}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          {selectedEntity.allowedCategoryIds && selectedEntity.allowedCategoryIds.length > 0
                            ? selectedEntity.allowedCategoryIds.map(id => categories.find(c => c.id === id)?.name).join(', ')
                            : 'General Account'}
                        </span>
                      </>
                    ) : (
                      <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                        Action Required
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Volume</p>
                  <p className="text-xl font-black text-slate-900">${totalVolume.toLocaleString()}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Entries</p>
                  <p className="text-xl font-black text-slate-900">{linkedTransactions.length}</p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2">
                  <History size={16} className="text-indigo-500" /> {isUnassignedView ? 'Pending Assignment' : 'Linked Ledger Entries'}
                </h3>
                {totalPages > 1 && (
                    <span className="text-[9px] font-black uppercase text-slate-400">Page {detailPage} of {totalPages}</span>
                )}
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                      <th className="pb-4">Date</th>
                      <th className="pb-4">Ledger Description</th>
                      <th className="pb-4">GL Account</th>
                      <th className="pb-4 text-right">Amount</th>
                      <th className="pb-4 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {paginatedTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-20 text-center">
                          <CreditCard className="w-12 h-12 text-slate-100 mx-auto mb-4" />
                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No matching transactions found</p>
                        </td>
                      </tr>
                    ) : (
                        paginatedTransactions.map(t => {
                          const currentCatId = t.categoryId || categories.find(c => c.name === t.category)?.id || '';
                          const availableCategories = selectedEntity.allowedCategoryIds 
                            ? categories.filter(c => selectedEntity.allowedCategoryIds.includes(c.id))
                            : categories;
                          
                          // Ensure current category is available
                          if (currentCatId && !availableCategories.some(c => c.id === currentCatId)) {
                            const currentCategoryInGlobal = categories.find(c => c.id === currentCatId);
                            if (currentCategoryInGlobal) availableCategories.push(currentCategoryInGlobal);
                          }

                          return (
                            <tr key={t.id} className="group hover:bg-slate-50 transition-colors">
                              <td className="py-4 text-xs font-bold text-slate-500 tabular-nums w-24">{t.date}</td>
                              <td className="py-4">
                                <p className="text-xs font-black text-slate-800 truncate">{t.description}</p>
                                <p className="text-[9px] text-slate-400 font-medium uppercase truncate">{t.originalDescription}</p>
                              </td>
                              <td className="py-4 pr-4">
                                <div className="relative">
                                  <select 
                                    className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-tight outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 cursor-pointer"
                                    value={currentCatId}
                                    onChange={(e) => {
                                      const cat = categories.find(c => c.id === e.target.value);
                                      if (cat) onUpdateTransaction({ ...t, category: cat.name, categoryId: cat.id });
                                    }}
                                  >
                                    <option value="">Uncategorized</option>
                                    {availableCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                  </select>
                                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3 pointer-events-none" />
                                </div>
                              </td>
                              <td className={`py-4 text-right text-xs font-black tabular-nums ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-slate-900'}`}>
                                {t.type === TransactionType.INCOME ? '+' : '-'}${t.amount.toFixed(2)}
                              </td>
                          <td className="py-4 pl-2 text-right">
                            {!isUnassignedView && (
                              <button 
                                onClick={() => handleUnlinkTransaction(t)}
                                title="Unlink from Identity"
                                className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                              >
                                <Unlink size={14} />
                              </button>
                            )}
                            {isUnassignedView && t.entityId && (
                                <button 
                                onClick={() => handleUnlinkTransaction(t)}
                                title="Clear Assignment"
                                className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                              >
                                <X size={14} />
                              </button>
                            )}
                            <button onClick={() => { setModalBaseTx(t); setIsModalOpen(true); }} title="Find Similar" className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all ml-2">
                              <Sparkles size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              {isModalOpen && modalBaseTx && (
                <SimilarTransactionsModal
                  isOpen={isModalOpen}
                  onClose={() => setIsModalOpen(false)}
                  base={modalBaseTx}
                  transactions={linkedTransactions}
                  profiles={profiles}
                  categories={categories}
                  onApply={async (ids, updates) => {
                    // apply updates by calling onUpdateTransaction for each selected id
                    for (const id of ids) {
                      const t = transactions.find(tx => tx.id === id);
                      if (t) await onUpdateTransaction({ ...t, ...updates });
                    }
                  }}
                  onUpload={async (txs) => {
                    if (onBulkUpload) await onBulkUpload(txs);
                  }}
                />
            )}

            {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                      <button 
                          onClick={() => setDetailPage(p => Math.max(1, p - 1))}
                          disabled={detailPage === 1}
                          className="px-4 py-2 bg-slate-50 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 disabled:opacity-50 transition-colors"
                      >
                          Previous
                      </button>
                      <span className="text-[10px] font-black uppercase text-slate-400">
                          Viewing {((detailPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(detailPage * ITEMS_PER_PAGE, linkedTransactions.length)}
                      </span>
                      <button 
                          onClick={() => setDetailPage(p => Math.min(totalPages, p + 1))}
                          disabled={detailPage === totalPages}
                          className="px-4 py-2 bg-slate-50 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 disabled:opacity-50 transition-colors"
                      >
                          Next
                      </button>
                  </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative animate-fade-in overflow-hidden">
      {/* Portal for Delete Confirmation */}
      {profileToDeleteId && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 font-sans">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm animate-fade-in" onClick={() => !isDeleting && setProfileToDeleteId(null)}></div>
          <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up border border-slate-100 p-10 text-center">
            <div className="bg-rose-50 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-8 text-rose-600 shadow-inner">
              <ShieldAlert size={48} />
            </div>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Purge Identity?</h3>
            <p className="text-slate-500 text-sm font-medium leading-relaxed mb-10 px-4">
              Removing <span className="font-black text-slate-900">"{profileToDelete?.name}"</span> will permanently disconnect all linked ledger entries.
            </p>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={handleConfirmDelete} 
                disabled={isDeleting} 
                className="w-full py-5 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-rose-900/20 hover:bg-rose-700 transition flex items-center justify-center disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Confirm Purge
              </button>
              <button 
                onClick={() => setProfileToDeleteId(null)} 
                disabled={isDeleting} 
                className="w-full py-5 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Directory View */}
      <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-sm pb-4 space-y-4 shrink-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Identities</h2>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">{profiles.length} Verified Vault Entries</p>
          </div>
          <button onClick={() => handleOpenEditor()} className="w-full sm:w-auto bg-slate-900 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl hover:bg-slate-800 transition-all active:scale-95">
            <UserPlus size={16} /> New Identity
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
          <input 
            type="text" 
            placeholder="Search directory..." 
            className="w-full pl-11 pr-4 py-4 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 transition-all shadow-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto pr-2 space-y-10 pb-32 no-scrollbar"
      >
        {/* Unassigned Transactions Card */}
        {unassignedCount > 0 && !searchTerm && (
            <div 
                onClick={() => handleOpenDetail('UNASSIGNED')}
                className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-[2rem] border-2 border-amber-100 hover:border-amber-300 transition-all flex flex-col justify-between group cursor-pointer shadow-sm hover:shadow-md mb-6"
            >
                <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-2xl bg-white text-amber-500 shadow-sm">
                    <AlertCircle size={24} />
                </div>
                <div className="flex items-center gap-1">
                    <button className="p-3 text-amber-400 hover:text-amber-600 bg-white/50 rounded-2xl transition-all">
                        <ChevronRight size={18} />
                    </button>
                </div>
                </div>

                <div className="min-w-0">
                <h4 className="text-sm font-black text-slate-800 truncate leading-tight">Unassigned Transactions</h4>
                <div className="flex items-center justify-between mt-3">
                    <span className="text-[9px] font-black uppercase text-amber-600 bg-white/60 px-2 py-1 rounded-md border border-amber-100/50">
                    Action Required
                    </span>
                    <div className="flex items-center gap-1.5">
                    <History size={12} className="text-amber-400" />
                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-tighter">
                        {unassignedCount} Records (${unassignedVolume.toLocaleString()})
                    </span>
                    </div>
                </div>
                </div>
            </div>
        )}

        {groupedProfiles.length === 0 && unassignedCount === 0 ? (
          <div className="py-24 text-center">
            <Search className="w-16 h-16 text-slate-100 mx-auto mb-4" />
            <p className="text-slate-400 text-xs font-black uppercase tracking-widest">No identities found</p>
          </div>
        ) : (
          groupedProfiles.map(([letter, items]) => (
            <section key={letter}>
              <div className="flex items-center gap-4 mb-6">
                <span className="text-lg font-black text-indigo-600 bg-indigo-50 w-10 h-10 rounded-xl flex items-center justify-center">{letter}</span>
                <div className="h-px bg-slate-100 flex-1"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map(p => {
                  const pCount = transactions.filter(t => t.entityId === p.id).length;
                  return (
                    <div 
                      key={p.id} 
                      onClick={() => handleOpenDetail(p.id)}
                      className="bg-white p-6 rounded-[2rem] border-2 border-slate-100 hover:border-indigo-200 transition-all flex flex-col justify-between group cursor-pointer shadow-sm hover:shadow-md"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className={`p-3 rounded-2xl ${p.type === 'VENDOR' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600 shadow-inner'}`}>
                          <Building size={24} />
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleOpenEditor(p); }} 
                            className="p-3 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all active:scale-90"
                          >
                            <Edit2 size={18} />
                          </button>
                        </div>
                      </div>

                      <div className="min-w-0">
                        <h4 className="text-sm font-black text-slate-800 truncate leading-tight">{p.name}</h4>
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-[9px] font-black uppercase text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                            {p.allowedCategoryIds && p.allowedCategoryIds.length > 0 ? `${p.allowedCategoryIds.length} Accounts` : 'General'}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <History size={12} className="text-indigo-400" />
                            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-tighter">
                              {pCount} Linked Entries
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-8 py-5 bg-slate-900 text-white rounded-[2rem] shadow-2xl animate-slide-up border border-white/10">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-xs font-black uppercase tracking-widest">{toast.message}</span>
        </div>
      )}
    </div>
  );
};

/* --- Profile Editor (Remodeled) --- */
const ProfileEditor: React.FC<{ 
  profile: EntityProfile | null; 
  categories: Category[];
  onSave: (data: EntityProfile, applyRules: boolean) => Promise<void>; 
  onCancel: () => void;
}> = ({ profile, categories, onSave, onCancel }) => {
  const [name, setName] = useState(profile?.name || '');
  const [type, setType] = useState<'VENDOR' | 'CLIENT'>(profile?.type || 'VENDOR');
  const [keywordsStr, setKeywordsStr] = useState(profile?.keywords?.join(', ') || profile?.name || '');
  const [description, setDescription] = useState(profile?.description || '');
  const [allowedCategoryIds, setAllowedCategoryIds] = useState<string[]>(profile?.allowedCategoryIds || []);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const toggleCategory = (id: string) => {
    setAllowedCategoryIds(prev => 
      prev.includes(id) ? prev.filter(catId => catId !== id) : [...prev, id]
    );
  };

  const handleMagicFill = async () => {
    if (!name) return;
    setIsGenerating(true);
    try {
      const data = await autoFillProfileData(name);
      setType(data.type);
      setKeywordsStr(data.keywords.join(', '));
      const cat = categories.find(c => c.name === data.defaultCategory);
      if (cat) setAllowedCategoryIds([cat.id]);
      if (data.description) setDescription(data.description);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

    const handleSaveClick = async () => {
      setIsSaving(true);
      try {
        // Process keywords: split, trim, filter empty, and sort by length DESC
        const processedKeywords = keywordsStr
          .split(',')
          .map(k => k.trim())
          .filter(k => k.length > 0)
          .sort((a, b) => b.length - a.length);
  
        await onSave({ 
          id: profile?.id || `prof-${Date.now()}`, 
          name, type, 
          description, 
          tags: [], 
          keywords: processedKeywords,
          allowedCategoryIds: allowedCategoryIds
        }, true);    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in pb-32">
      {/* Header with Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={onCancel} className="text-slate-500 font-bold text-xs uppercase tracking-widest flex items-center gap-2 group hover:text-slate-800 transition-colors">
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back to Directory
        </button>
        <button onClick={handleMagicFill} disabled={!name || isGenerating} className="bg-white border border-slate-200 text-indigo-600 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-50 hover:border-indigo-200 transition-all active:scale-95 disabled:opacity-50 shadow-sm">
          {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} 
          Auto-Fill Details
        </button>
      </div>

      <div className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-xl border border-slate-100 relative overflow-hidden">
        
        <div className="space-y-8">
            <div className="text-center">
                <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-2xl mb-4 ${type === 'VENDOR' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                    <Building size={32} />
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight mb-1">
                    {profile ? 'Edit Identity' : 'New Identity'}
                </h3>
                <p className="text-slate-400 text-xs font-medium">Configure how Cipher recognizes this entity.</p>
            </div>

          <div className="space-y-5">
            {/* Name Input */}
            <div className="space-y-2">
               <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Entity Name</label>
               <input 
                type="text" 
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-base font-bold text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 placeholder:text-slate-400 transition-all" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                placeholder="e.g. Starbucks Coffee" 
              />
            </div>

            {/* Type & Category Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Relationship Type</label>
                <div className="relative">
                    <select 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 uppercase tracking-wide appearance-none outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer"
                    value={type}
                    onChange={e => setType(e.target.value as any)}
                    >
                    <option value="VENDOR">Vendor (Outgoing)</option>
                    <option value="CLIENT">Client (Incoming)</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Allowed Ledger Accounts</label>
                <div className="relative">
                    <select 
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 uppercase tracking-wide appearance-none outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer"
                      value=""
                      onChange={e => toggleCategory(e.target.value)}
                    >
                      <option value="">-- Add Account --</option>
                      {categories.filter(c => !allowedCategoryIds.includes(c.id)).map(c => 
                        <option key={c.id} value={c.id}>{c.name}</option>
                      )}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  {allowedCategoryIds.map(id => {
                    const cat = categories.find(c => c.id === id);
                    if (!cat) return null;
                    return (
                      <div key={id} className="bg-indigo-50 text-indigo-700 rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-tight flex items-center gap-2">
                        {cat.name}
                        <button onClick={() => toggleCategory(id)} className="text-indigo-400 hover:text-indigo-700">
                          <X size={12} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
            
            {/* Description/Notes Input */}
            <div className="space-y-2">
               <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Notes / Description</label>
               <textarea 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 placeholder:text-slate-400 transition-all resize-none h-24"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Internal notes about this relationship..."
               />
            </div>

            {/* Keyword Match */}
            <div className="space-y-2 pt-2">
               <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 flex items-center gap-2">
                   <Tag size={12} /> Auto-Tag Keywords (Comma Separated)
               </label>
               <div className="relative">
                <textarea 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 placeholder:text-slate-400 transition-all resize-none h-24" 
                  value={keywordsStr} 
                  onChange={e => setKeywordsStr(e.target.value)} 
                  placeholder="e.g. Amazon, AMZN, Amzn Mktp..." 
                />
              </div>
              <p className="text-[10px] text-slate-400 font-medium ml-1">
                  Transactions containing <span className="font-bold text-slate-600">ANY</span> of these will link to this identity. Longest matches are prioritized.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-100">
            <button 
            onClick={handleSaveClick}
            disabled={!name || isSaving}
            className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-30 flex items-center justify-center gap-2"
            >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {isSaving ? 'Saving...' : (profile ? 'Save Changes' : 'Create Identity')}
            </button>
        </div>
      </div>
    </div>
  );
};

export default EntityProfiles;
