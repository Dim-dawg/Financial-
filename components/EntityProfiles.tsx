
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Transaction, EntityProfile, Category, TransactionType } from '../types';
import { 
  Users, UserPlus, Search, 
  ChevronRight, ArrowLeft, Trash2, Briefcase,
  Loader2, Edit2, Wand2, RefreshCw, X, AlertCircle,
  CheckCircle2, Zap, Settings2, ArrowRight, Tag,
  Building, MapPin, Globe, CreditCard, ShieldAlert,
  LayoutGrid, List, Navigation, ChevronUp, FileText,
  TrendingUp, TrendingDown, DollarSign, PieChart, BarChart3,
  ShieldCheck, Sparkles
} from 'lucide-react';
import { autoFillProfileData, generateFinancialNarrative } from '../services/geminiService';
import { bulkApplyProfileRule } from '../services/supabaseService';

interface EntityProfilesProps {
  transactions: Transaction[];
  profiles: EntityProfile[];
  categories: Category[];
  onAddProfile: (profile: EntityProfile) => Promise<EntityProfile | null>;
  onUpdateProfile: (profile: EntityProfile) => Promise<EntityProfile | null>;
  onDeleteProfile: (id: string) => Promise<void> | void;
  onRefreshData?: () => void;
}

const EntityProfiles: React.FC<EntityProfilesProps> = ({ 
  transactions, 
  profiles, 
  categories,
  onAddProfile, 
  onUpdateProfile, 
  onDeleteProfile,
  onRefreshData
}) => {
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [view, setView] = useState<'GRID' | 'EDITOR'>('GRID');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [editingProfile, setEditingProfile] = useState<EntityProfile | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const selectedEntity = useMemo(() => {
    if (!selectedEntityId) return null;
    if (selectedEntityId === 'unlinked') {
      return {
        id: 'unlinked',
        name: 'Unlinked Records',
        type: 'VENDOR',
        description: 'Ledger entries not yet associated with a business identity.',
        tags: ['PENDING', 'MANUAL'],
        keywordMatch: '',
        defaultCategoryId: '',
        defaultCategory: 'Uncategorized'
      } as EntityProfile;
    }
    return profiles.find(p => p.id === selectedEntityId) || null;
  }, [profiles, selectedEntityId]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const groupedProfiles = useMemo(() => {
    const filtered = profiles
      .filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.keywordMatch.toLowerCase().includes(searchTerm.toLowerCase())
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

  // Restore scroll position when returning to the directory view
  useEffect(() => {
    if (!selectedEntityId && view === 'GRID' && scrollContainerRef.current) {
      const restore = () => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollPositionRef.current;
        }
      };
      const raf = requestAnimationFrame(restore);
      const timeout = setTimeout(restore, 10);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timeout);
      };
    }
  }, [selectedEntityId, view, groupedProfiles]);

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

  const scrollToLetter = (letter: string) => {
    const element = sectionRefs.current[letter];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    scrollPositionRef.current = e.currentTarget.scrollTop;
  };

  const handleSelectEntity = (id: string | null) => {
    if (scrollContainerRef.current) {
      scrollPositionRef.current = scrollContainerRef.current.scrollTop;
    }
    setSelectedEntityId(id);
  };

  const handleOpenEditor = (profile?: EntityProfile) => {
    setEditingProfile(profile || null);
    setView('EDITOR');
  };

  const handleBack = () => {
    if (view === 'EDITOR') setView('GRID');
    else handleSelectEntity(null);
  };

  const handleSave = async (data: EntityProfile, runBulkApply: boolean = false) => {
    try {
      let result: EntityProfile | null = null;
      if (editingProfile) {
        result = await onUpdateProfile(data);
        if (runBulkApply && data.id && data.defaultCategoryId) {
          await bulkApplyProfileRule(data.keywordMatch, data.id, data.defaultCategoryId);
        }
        setToast({ message: `Profile "${data.name}" updated.`, type: 'success' });
      } else {
        result = await onAddProfile(data);
        setToast({ message: `New profile "${data.name}" created.`, type: 'success' });
      }
      
      if (result) {
        handleSelectEntity(result.id);
      }
      setView('GRID'); 
      if (onRefreshData) onRefreshData();
    } catch (err) {
      setToast({ message: 'Failed to save profile.', type: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!selectedEntityId || selectedEntityId === 'unlinked') return;
    setIsDeleting(true);
    try {
      const idToDelete = selectedEntityId;
      const name = selectedEntity?.name || 'Entity';
      await onDeleteProfile(idToDelete);
      handleSelectEntity(null);
      setShowDeleteConfirm(false);
      setToast({ message: `"${name}" removed from vault.`, type: 'success' });
    } catch (err) {
      setToast({ message: 'Error deleting entity.', type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  if (view === 'EDITOR') {
    return (
      <ProfileEditor 
        profile={editingProfile} 
        categories={categories}
        onSave={handleSave}
        onCancel={() => setView('GRID')}
      />
    );
  }

  if (selectedEntity) {
    return (
      <>
        <ProfileDetailView 
          entity={selectedEntity} 
          transactions={transactions} 
          categories={categories}
          onBack={handleBack}
          onEdit={() => handleOpenEditor(selectedEntity!)}
          onDelete={() => setShowDeleteConfirm(true)}
          isDeleting={isDeleting}
        />
        
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-slate-900/60 z-[200] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-scale-up border border-slate-100 p-8 text-center">
              <div className="bg-rose-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 text-rose-500">
                <ShieldAlert className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Confirm Identity Purge</h3>
              <p className="text-slate-600 text-sm font-medium leading-relaxed mb-8">
                Are you sure you want to delete <span className="font-bold text-slate-900">"{selectedEntity.name}"</span>? 
                This will unlink all associated ledger records permanently.
              </p>
              
              <div className="flex flex-col gap-3">
                <button onClick={handleDelete} disabled={isDeleting} className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-rose-700 transition flex items-center justify-center">
                  {isDeleting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  Confirm Purge
                </button>
                <button onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting} className="w-full py-4 bg-slate-100 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="h-full flex flex-col relative animate-fade-in overflow-hidden">
      <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-sm pb-4 space-y-4 shrink-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Business Directory</h2>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">{profiles.length} Active Identities</p>
          </div>
          <button onClick={() => handleOpenEditor()} className="w-full sm:w-auto bg-slate-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl hover:bg-slate-800 transition-all active:scale-95">
            <UserPlus className="w-4 h-4" /> New Identity
          </button>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Filter names..." 
              className="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-slate-200 rounded-2xl text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 transition-all shadow-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex bg-white border-2 border-slate-200 rounded-2xl p-1 shadow-sm">
            <button 
              onClick={() => setViewMode('list')}
              className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <List size={20} />
            </button>
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-2.5 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <LayoutGrid size={20} />
            </button>
          </div>
        </div>
        
        {transactions.some(t => !t.entityId) && (
          <button 
            onClick={() => handleSelectEntity('unlinked')}
            className="w-full bg-indigo-600 text-white p-3 rounded-2xl flex items-center justify-between group hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-200"
          >
            <div className="flex items-center gap-3">
              <Zap className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Unlinked Records Found</span>
            </div>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        )}
      </div>

      <div className="flex-1 flex gap-2 overflow-hidden">
        <div 
          ref={scrollContainerRef} 
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto pr-8 space-y-10 scroll-smooth pb-32 no-scrollbar"
        >
          {groupedProfiles.length === 0 ? (
            <div className="text-center py-24 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 mx-2">
               <Search className="w-16 h-16 text-slate-200 mx-auto mb-4" />
               <h3 className="font-black text-slate-800 mb-1">No Identities Found</h3>
               <p className="text-slate-500 text-sm font-medium">Try a different search term.</p>
            </div>
          ) : (
            groupedProfiles.map(([letter, items]) => (
              <section 
                key={letter} 
                ref={el => sectionRefs.current[letter] = el}
                className="relative"
              >
                <div className="sticky top-0 z-20 bg-slate-50/90 backdrop-blur-sm py-2 flex items-center gap-4 mb-4">
                  <div className="bg-slate-900 text-white w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shadow-md">{letter}</div>
                  <div className="h-px bg-slate-200 flex-1"></div>
                </div>

                <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-2'}>
                  {items.map(p => (
                    viewMode === 'grid' ? (
                      <ProfileCard 
                        key={p.id} 
                        profile={p} 
                        onClick={() => handleSelectEntity(p.id)} 
                        onEdit={(e) => { e.stopPropagation(); handleOpenEditor(p); }}
                        categoryName={categories.find(c => c.id === p.defaultCategoryId)?.name || 'General'}
                      />
                    ) : (
                      <ProfileRow 
                        key={p.id} 
                        profile={p} 
                        onClick={() => handleSelectEntity(p.id)} 
                        onEdit={(e) => { e.stopPropagation(); handleOpenEditor(p); }}
                        categoryName={categories.find(c => c.id === p.defaultCategoryId)?.name || 'General'}
                      />
                    )
                  ))}
                </div>
              </section>
            ))
          )}
        </div>

        <div className="w-8 flex flex-col items-center justify-center py-4 bg-white/50 backdrop-blur-sm border border-slate-200 rounded-full fixed right-2 top-1/2 -translate-y-1/2 z-40 lg:right-6">
          <button 
            onClick={() => scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
            className="text-indigo-600 mb-2 hover:scale-125 transition-transform"
          >
            <ChevronUp size={12} strokeWidth={3} />
          </button>
          {alphabet.map(letter => {
            const hasGroup = groupedProfiles.some(([l]) => l === letter);
            return (
              <button
                key={letter}
                onClick={() => scrollToLetter(letter)}
                disabled={!hasGroup}
                className={`text-[9px] font-black h-4 w-full flex items-center justify-center transition-all ${
                  hasGroup ? 'text-indigo-600 hover:scale-150' : 'text-slate-300 opacity-30 cursor-default'
                }`}
              >
                {letter}
              </button>
            );
          })}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-4 bg-slate-900 text-white rounded-2xl shadow-2xl animate-slide-up border border-white/10">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-bold">{toast.message}</span>
        </div>
      )}
    </div>
  );
};

/* --- Compact Row (List View) --- */
const ProfileRow: React.FC<{ profile: EntityProfile; onClick: () => void; onEdit: (e: React.MouseEvent) => void; categoryName: string }> = ({ profile, onClick, onEdit, categoryName }) => (
  <div onClick={onClick} className="bg-white px-5 py-3 rounded-2xl border-2 border-slate-100 hover:border-indigo-400 hover:shadow-lg transition-all flex items-center justify-between group cursor-pointer">
    <div className="flex items-center gap-4 min-w-0">
      <div className={`p-2 rounded-xl shrink-0 ${profile.type === 'VENDOR' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
        <Building className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-black text-slate-900 truncate group-hover:text-indigo-600">{profile.name}</h3>
        <p className="text-[9px] font-black uppercase text-slate-500 tracking-tighter">{categoryName} • {profile.type}</p>
      </div>
    </div>
    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
       <button onClick={onEdit} className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 rounded-lg"><Edit2 size={14}/></button>
       <ChevronRight size={18} className="text-slate-300" />
    </div>
  </div>
);

/* --- Visual Card (Grid View) --- */
const ProfileCard: React.FC<{ profile: EntityProfile; onClick: () => void; onEdit: (e: React.MouseEvent) => void; categoryName: string }> = ({ profile, onClick, onEdit, categoryName }) => (
  <div onClick={onClick} className="bg-white p-6 rounded-3xl shadow-sm border-2 border-slate-100 hover:border-indigo-400 hover:shadow-xl transition-all group relative cursor-pointer flex flex-col h-full">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 rounded-2xl ${profile.type === 'VENDOR' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
        <Building className="w-6 h-6" />
      </div>
      <button onClick={onEdit} className="p-2 text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-all bg-slate-50 rounded-xl border border-slate-200"><Edit2 className="w-4 h-4" /></button>
    </div>
    <div className="flex-1">
      <h3 className="text-lg font-black text-slate-900 leading-tight mb-1 group-hover:text-indigo-600">{profile.name}</h3>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-3">{profile.type}</p>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {profile.tags.slice(0, 3).map((tag, i) => (
          <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[9px] font-bold border border-slate-200">#{tag}</span>
        ))}
      </div>
    </div>
    <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
      <span className="text-[10px] font-black uppercase text-slate-700">{categoryName}</span>
      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 translate-x-0 group-hover:translate-x-1" />
    </div>
  </div>
);

/* --- Detail View --- */
const ProfileDetailView: React.FC<{ 
  entity: EntityProfile; 
  transactions: Transaction[]; 
  categories: Category[];
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}> = ({ entity, transactions, categories, onBack, onEdit, onDelete, isDeleting }) => {
  const [activeTab, setActiveTab] = useState<'LEDGER' | 'STATEMENT'>('LEDGER');
  const [insight, setInsight] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const entityTransactions = useMemo(() => {
    return transactions.filter(t => t.entityId === entity.id || (entity.id === 'unlinked' && !t.entityId));
  }, [transactions, entity]);
  
  const financialStats = useMemo(() => {
    let income = 0;
    let expense = 0;
    const catBreakdown: Record<string, number> = {};

    entityTransactions.forEach(t => {
      if (t.type === TransactionType.INCOME) income += t.amount;
      else expense += t.amount;
      catBreakdown[t.category] = (catBreakdown[t.category] || 0) + t.amount;
    });

    return { income, expense, net: income - expense, catBreakdown };
  }, [entityTransactions]);

  const handleGenerateInsight = async () => {
    setIsAnalyzing(true);
    try {
      const narrative = await generateFinancialNarrative({
        totalIncome: financialStats.income,
        totalExpense: financialStats.expense,
        netProfit: financialStats.net,
        topExpenses: Object.keys(financialStats.catBreakdown).slice(0, 3)
      });
      setInsight(narrative);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-32">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 font-black uppercase text-[10px] tracking-widest transition-all group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Directory
      </button>

      <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-sm border-2 border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/30 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row justify-between items-start gap-8">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-4">
              <div className={`p-4 rounded-3xl ${entity.type === 'VENDOR' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                {entity.id === 'unlinked' ? <Zap className="w-8 h-8" /> : <Building className="w-8 h-8" />}
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">{entity.name}</h1>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">{entity.type}</p>
              </div>
            </div>
            <p className="text-slate-700 max-w-2xl leading-relaxed font-bold mb-6 text-sm">{entity.description || 'No profile description provided.'}</p>
            <div className="flex flex-wrap gap-2">
              {entity.tags.map((tag, i) => (
                <span key={i} className="px-4 py-1.5 bg-slate-100 text-slate-800 rounded-xl text-[10px] font-black border border-slate-200">#{tag}</span>
              ))}
            </div>
          </div>
          <div className="w-full md:w-auto flex flex-col gap-3">
             <div className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-xl">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Impact Score</p>
                <h3 className="text-3xl font-black tabular-nums">${financialStats.net.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                <p className="text-[10px] font-black text-indigo-400 uppercase mt-4">{entityTransactions.length} Verified Entries</p>
             </div>
             {entity.id !== 'unlinked' && (
               <div className="flex gap-2">
                 <button onClick={onEdit} className="flex-1 px-6 py-4 bg-white border-2 border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-900 hover:border-indigo-400 transition-all shadow-sm">Edit Identity</button>
                 <button onClick={onDelete} disabled={isDeleting} className="p-4 bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-600 hover:text-white transition-all border-2 border-rose-100"><Trash2 size={20} /></button>
               </div>
             )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border-2 border-slate-100 shadow-sm overflow-hidden">
        <div className="px-8 py-4 border-b-2 border-slate-100 flex items-center justify-between bg-slate-50/50">
           <div className="flex gap-4">
             <button 
               onClick={() => setActiveTab('LEDGER')}
               className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all ${activeTab === 'LEDGER' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
             >
               Ledger History
             </button>
             <button 
               onClick={() => setActiveTab('STATEMENT')}
               className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all ${activeTab === 'STATEMENT' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
             >
               Entity Statement
             </button>
           </div>
           {activeTab === 'STATEMENT' && (
             <button 
               onClick={handleGenerateInsight} 
               disabled={isAnalyzing}
               className="text-[9px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-all"
             >
               {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} AI Performance Review
             </button>
           )}
        </div>

        <div className="p-8">
          {activeTab === 'LEDGER' ? (
            <div className="divide-y-2 divide-slate-50">
              {entityTransactions.length === 0 ? (
                <div className="py-20 text-center text-slate-400 font-bold text-sm italic">No records in current ledger.</div>
              ) : (
                entityTransactions.map(t => (
                  <div key={t.id} className="py-4 flex items-center justify-between hover:bg-slate-50 rounded-xl px-4 -mx-4 transition-all">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{t.description}</p>
                      <p className="text-[10px] font-black uppercase text-slate-500">{t.date} • {t.category}</p>
                    </div>
                    <span className={`text-base font-black tabular-nums ${t.type === TransactionType.INCOME ? 'text-emerald-700' : 'text-slate-900'}`}>
                      {t.type === TransactionType.INCOME ? '+' : '-'}${t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-8 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-emerald-50 p-6 rounded-[2rem] border border-emerald-100">
                  <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-1">Total Received</p>
                  <h4 className="text-2xl font-black text-emerald-900 tracking-tight">${financialStats.income.toLocaleString()}</h4>
                </div>
                <div className="bg-rose-50 p-6 rounded-[2rem] border border-rose-100">
                  <p className="text-[9px] font-black uppercase tracking-widest text-rose-600 mb-1">Total Paid</p>
                  <h4 className="text-2xl font-black text-rose-900 tracking-tight">${financialStats.expense.toLocaleString()}</h4>
                </div>
                <div className="bg-slate-900 p-6 rounded-[2rem] shadow-xl text-white">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Net Balance</p>
                  <h4 className="text-2xl font-black tracking-tight">${financialStats.net.toLocaleString()}</h4>
                </div>
              </div>

              {insight && (
                <div className="bg-indigo-600 p-8 rounded-[2rem] text-white shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                    <ShieldCheck className="w-24 h-24" />
                  </div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-indigo-300 mb-4 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" /> AI Credit Analysis
                  </h4>
                  <p className="text-lg font-serif italic leading-relaxed relative z-10">{insight}</p>
                </div>
              )}

              <div className="bg-white border-4 border-slate-900 p-8 rounded-[2rem]">
                <h4 className="text-center text-xl font-black uppercase tracking-tighter mb-8 border-b-4 border-slate-900 pb-4">Mini P&L Statement: {entity.name}</h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <span className="text-sm font-black uppercase text-slate-400 tracking-widest">Revenue Impact</span>
                    <span className="font-mono font-bold text-emerald-600">${financialStats.income.toFixed(2)}</span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Expense Breakdown</p>
                    {/* Add comment: Fix type error 'Property toFixed does not exist on type unknown' by casting val to number */}
                    {Object.entries(financialStats.catBreakdown).map(([cat, val]) => (
                      <div key={cat} className="flex justify-between items-center text-xs ml-4">
                        <span className="text-slate-600 font-bold">{cat}</span>
                        <span className="font-mono text-slate-900">${(val as number).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center pt-6 border-t-4 border-slate-900">
                    <span className="text-lg font-black uppercase tracking-tighter italic">Net Financial Value</span>
                    <span className="text-xl font-black tabular-nums font-mono">${financialStats.net.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* --- Profile Editor --- */
const ProfileEditor: React.FC<{ 
  profile: EntityProfile | null; 
  categories: Category[];
  onSave: (data: EntityProfile, applyRules: boolean) => void; 
  onCancel: () => void;
}> = ({ profile, categories, onSave, onCancel }) => {
  const [name, setName] = useState(profile?.name || '');
  const [type, setType] = useState<'VENDOR' | 'CLIENT'>(profile?.type || 'VENDOR');
  const [description, setDescription] = useState(profile?.description || '');
  const [tags, setTags] = useState(profile?.tags.join(', ') || '');
  const [keywordMatch, setKeywordMatch] = useState(profile?.keywordMatch || '');
  const [defaultCategoryId, setDefaultCategoryId] = useState(profile?.defaultCategoryId || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [applyRules, setApplyRules] = useState(false);

  const handleMagicFill = async () => {
    if (!name) return;
    setIsGenerating(true);
    try {
      const data = await autoFillProfileData(name);
      setDescription(data.description);
      setType(data.type);
      setTags(data.tags.join(', '));
      setKeywordMatch(data.keywordMatch);
      const cat = categories.find(c => c.name === data.defaultCategory);
      if (cat) setDefaultCategoryId(cat.id);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    if (!name) return;
    onSave({
      id: profile?.id || `prof-${Date.now()}`,
      name, type, description,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      keywordMatch: keywordMatch || name,
      defaultCategoryId,
    }, applyRules);
  };

  const inputStyles = "w-full p-4 bg-white border-2 border-slate-300 rounded-2xl text-sm font-black text-slate-900 focus:border-indigo-600 transition-all outline-none placeholder:text-slate-400";
  const labelStyles = "text-[11px] font-black uppercase tracking-widest text-slate-700 block mb-2";

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in pb-32">
      <div className="flex items-center justify-between mb-8">
        <div>
           <button onClick={onCancel} className="text-slate-600 hover:text-indigo-600 text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-1">
             <ArrowLeft size={14} /> Directory
           </button>
           <h2 className="text-3xl font-black text-slate-900 tracking-tight">{profile ? 'Edit Identity' : 'New Identity'}</h2>
        </div>
        <button onClick={handleMagicFill} disabled={!name || isGenerating} className="bg-indigo-600 text-white px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-200 hover:bg-indigo-500 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-30">
          {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />} AI Fill
        </button>
      </div>

      <div className="bg-white p-6 md:p-10 rounded-[2.5rem] shadow-sm border-2 border-slate-200 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className={labelStyles}>Legal Business Name</label>
            <input type="text" className={inputStyles} value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Apple Inc." />
          </div>
          <div className="space-y-2">
            <label className={labelStyles}>Entity Type</label>
            <div className="flex gap-2">
              {(['VENDOR', 'CLIENT'] as const).map(t => (
                <button key={t} onClick={() => setType(t)} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${type === t ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-slate-50 text-slate-600 border-slate-300'}`}>{t}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className={labelStyles}>Memo / Description</label>
          <textarea rows={3} className={`${inputStyles} resize-none`} value={description} onChange={e => setDescription(e.target.value)} placeholder="Business activities..." />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="space-y-2">
              <label className={labelStyles}>Bank Search Keyword</label>
              <input type="text" className={inputStyles} value={keywordMatch} onChange={e => setKeywordMatch(e.target.value)} placeholder="Bank string" />
           </div>
           <div className="space-y-2">
              <label className={labelStyles}>Default GL Account</label>
              <select className={`${inputStyles} appearance-none pr-10`} value={defaultCategoryId} onChange={e => setDefaultCategoryId(e.target.value)}>
                <option value="">Choose Category...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
           </div>
        </div>

        <div className="bg-slate-100 p-6 rounded-3xl border-2 border-slate-200 flex items-center justify-between">
           <div className="flex items-center gap-3">
             <div className="bg-indigo-100 p-2 rounded-xl"><Zap className="w-5 h-5 text-indigo-700" /></div>
             <div>
               <p className="text-sm font-black text-slate-900">Automation Rule</p>
               <p className="text-[10px] text-slate-600 uppercase tracking-widest">Auto-link ledger history</p>
             </div>
           </div>
           <button onClick={() => setApplyRules(!applyRules)} className={`w-14 h-7 rounded-full relative transition-all border-2 ${applyRules ? 'bg-indigo-600 border-indigo-700' : 'bg-slate-300 border-slate-400'}`}>
             <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all shadow-md ${applyRules ? 'left-8' : 'left-0.5'}`} />
           </button>
        </div>

        <button onClick={handleSave} className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-300 hover:bg-indigo-600 transition-all active:scale-[0.98]">
          Commit Identity Commit
        </button>
      </div>
    </div>
  );
};

export default EntityProfiles;
