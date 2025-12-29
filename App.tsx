
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  UploadCloud, FileText, Loader2, 
  Table as TableIcon, Database, PieChart as PieIcon, 
  FileSpreadsheet, Users, Key, X, Trash2,
  Files as FilesIcon, Wallet, Shield, FileBadge, CheckCircle2,
  Settings, LayoutDashboard, Briefcase, Wand2, Plus, Server, BarChart3,
  AlertTriangle, Link, Info, Menu
} from 'lucide-react';
import { 
  Transaction, 
  ProcessingStatus, 
  CategorizationRule, 
  TransactionType,
  TransactionFilter,
  BalanceSheetAdjustment,
  EntityProfile,
  Category,
  DEFAULT_CATEGORIES
} from './types';
import { parseDocumentWithGemini, readFileAsBase64 } from './services/geminiService';
import * as db from './services/supabaseService';
import Dashboard from './components/Dashboard';
import TransactionTable from './components/TransactionTable';
import RulesEngine from './components/RulesEngine';
import CategoryManager from './components/CategoryManager';
import EntityProfiles from './components/EntityProfiles';
import FilterBar from './components/FilterBar';
import { ProfitLossStatement, BalanceSheet } from './components/FinancialStatements';
import FinancialReport from './components/FinancialReport';
import DatabaseConfigModal from './components/DatabaseConfigModal';

// Global Analytics Helper
const trackEvent = (action: string, category: string, label?: string, value?: number) => {
  if (typeof (window as any).gtag === 'function') {
    (window as any).gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value
    });
  }
};

const DEFAULT_GA_ID = 'G-494099882';

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalDbCount, setTotalDbCount] = useState(0);
  const [processingQueue, setProcessingQueue] = useState<ProcessingStatus[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'entities' | 'report' | 'documents'>('dashboard');
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  const [categories, setCategories] = useState<Category[]>(
    DEFAULT_CATEGORIES.map(name => ({ id: name, name }))
  );
  const [rules, setRules] = useState<CategorizationRule[]>([]);
  const [profiles, setProfiles] = useState<EntityProfile[]>([]);
  const [bsAdjustments, setBsAdjustments] = useState<BalanceSheetAdjustment[]>([]);
  const [bsOverrides, setBsOverrides] = useState<Record<string, number>>({});

  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isDbConfigOpen, setIsDbConfigOpen] = useState(false);
  const [filters, setFilters] = useState<TransactionFilter>({
    startDate: '', endDate: '', category: '', minAmount: '', maxAmount: '', search: ''
  });

  const isConfigured = db.isSupabaseConfigured();

  // Navigation Items
  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Home' },
    { id: 'transactions', icon: Briefcase, label: 'Ledger' },
    { id: 'entities', icon: Users, label: 'Profiles' },
    { id: 'report', icon: FileBadge, label: 'Loan Pack' },
  ];

  // Analytics: Track Virtual Page Views on tab changes
  useEffect(() => {
    const gaId = localStorage.getItem('cf_ga_id') || DEFAULT_GA_ID;
    if (typeof (window as any).gtag === 'function') {
      (window as any).gtag('config', gaId, {
        page_title: activeTab.charAt(0).toUpperCase() + activeTab.slice(1),
        page_location: window.location.href,
        page_path: `/${activeTab}`,
        send_page_view: true
      });
    }
  }, [activeTab]);

  const loadData = useCallback(async (currentFilters?: TransactionFilter) => {
    if (!db.isSupabaseConfigured()) return;
    setIsFetching(true);
    try {
      const [txs, rls, profs, cats, totalCount] = await Promise.all([
        db.getTransactions(currentFilters),
        db.getRules(),
        db.getProfiles(),
        db.getCategories(),
        db.getTransactionsTotalInDb()
      ]);
      setTransactions(txs);
      setRules(rls);
      setProfiles(profs);
      setTotalDbCount(totalCount);
      if (cats.length > 0) setCategories(cats);
    } catch (err) {
      console.error("Fetch failed", err);
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await loadData();
      setIsInitialized(true);
    };
    init();
  }, [loadData]);

  useEffect(() => {
    if (isInitialized) loadData(filters);
  }, [filters, isInitialized, loadData]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!db.isSupabaseConfigured()) {
      setIsDbConfigOpen(true);
      return;
    }
    const fileList = event.target.files;
    if (!fileList) return;
    const files = Array.from(fileList) as File[];
    
    trackEvent('upload_start', 'documents', 'files_count', files.length);
    setActiveTab('documents');

    const newStatuses: ProcessingStatus[] = files.map(file => ({
      id: Math.random().toString(36).substring(2, 9),
      fileName: file.name,
      fileType: file.type,
      data: '',
      status: 'pending'
    }));
    setProcessingQueue(prev => [...prev, ...newStatuses]);

    for (const status of newStatuses) {
      const file = files.find(f => f.name === status.fileName);
      if (!file) continue;
      
      setProcessingQueue(prev => prev.map(s => s.id === status.id ? { ...s, status: 'processing' } : s));
      try {
        const base64 = await readFileAsBase64(file);
        const extracted = await parseDocumentWithGemini(file, base64);
        
        if (db.isSupabaseConfigured()) {
          await db.upsertTransactions(extracted);
          await loadData(filters);
        } else {
          setTransactions(prev => [...extracted, ...prev]);
        }
        
        setProcessingQueue(prev => prev.map(s => s.id === status.id ? { ...s, status: 'completed', transactionCount: extracted.length } : s));
        showToast(`Extracted ${extracted.length} records.`);
        trackEvent('upload_complete', 'documents', file.name, extracted.length);
      } catch (err) {
        setProcessingQueue(prev => prev.map(s => s.id === status.id ? { ...s, status: 'error', message: err instanceof Error ? err.message : 'Failed' } : s));
        trackEvent('upload_error', 'documents', file.name);
      }
    }
  };

  const handleBulkUpdate = async (ids: string[], updates: Partial<Transaction>) => {
    const targetTransactions = transactions.filter(t => ids.includes(t.id));
    const updated = targetTransactions.map(t => ({ ...t, ...updates }));
    
    setTransactions(prev => prev.map(t => {
      if (ids.includes(t.id)) return { ...t, ...updates };
      return t;
    }));

    if (db.isSupabaseConfigured()) {
      try {
        await db.upsertTransactions(updated);
        showToast(`Categorized ${ids.length} records.`);
        trackEvent('bulk_update', 'transactions', 'categorize', ids.length);
      } catch (err) {
        showToast("Bulk update failed", 'error');
        loadData(filters);
      }
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    setTransactions(prev => prev.filter(t => !ids.includes(t.id)));
    if (db.isSupabaseConfigured()) {
      try {
        await db.deleteTransactions(ids);
        showToast(`Purged ${ids.length} records.`);
        trackEvent('bulk_delete', 'transactions', 'delete', ids.length);
        loadData(filters);
      } catch (err) {
        showToast("Deletion failed", 'error');
        loadData(filters);
      }
    }
  };

  const handleCreateRuleFromTable = async (keyword: string, categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId);
    if (!cat) {
      showToast("Select a category first.", 'error');
      return;
    }
    const cleanKeyword = keyword.split(' ').slice(0, 2).join(' ').replace(/[*#]/g, '').trim();
    const newRule: CategorizationRule = {
      id: `rule-${Date.now()}`,
      keyword: cleanKeyword,
      targetCategory: cat.name,
      targetCategoryId: cat.id
    };
    
    setRules(prev => [...prev, newRule]);
    trackEvent('create_rule', 'automation', cleanKeyword);
    
    if (db.isSupabaseConfigured()) {
       try {
         await db.upsertRule(newRule);
         showToast("Rule created and synced.");
       } catch (err) {
         showToast("Rule sync failed", "error");
       }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row overflow-hidden">
      {/* Desktop Sidebar (Left) */}
      <nav className="hidden lg:flex flex-col w-72 bg-slate-900 text-white p-8 shrink-0">
        <div className="flex items-center gap-3 mb-12">
          <div className="bg-indigo-600 p-2 rounded-2xl shadow-lg shadow-indigo-500/20">
            <Shield className="w-6 h-6" />
          </div>
          <span className="text-2xl font-black tracking-tighter">CIPHER</span>
        </div>

        <div className="space-y-2">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all ${
                activeTab === item.id ? 'bg-indigo-600 shadow-xl' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <item.icon size={18} /> {item.label}
            </button>
          ))}
          <button
            onClick={() => setActiveTab('documents')}
            className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all ${
              activeTab === 'documents' ? 'bg-indigo-600 shadow-xl' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <FilesIcon size={18} /> Documents
          </button>
        </div>

        <div className="mt-auto pt-8 border-t border-white/5 space-y-4">
          <button 
            onClick={() => setIsDbConfigOpen(true)}
            className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
              !isConfigured ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Database size={18} /> {isConfigured ? 'Vault Settings' : 'Sync Database'}
          </button>
          <button 
            onClick={() => window.aistudio.openSelectKey()}
            className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <Key size={18} /> API Key
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 h-[100dvh] overflow-hidden relative">
        
        {/* Header - Visible on both but re-styled for mobile */}
        <header className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-6 md:px-8 shrink-0 z-20">
          <div className="flex items-center gap-2">
            <Shield className="text-indigo-600 w-6 h-6 lg:hidden" />
            <span className="font-black text-xl tracking-tighter lg:hidden">CIPHER</span>
            <div className="hidden lg:flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
                <Server className={`w-4 h-4 ${isConfigured ? 'text-indigo-500' : 'text-rose-500'}`} />
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                  {isConfigured ? `${totalDbCount} Records Synced` : 'Database Offline'}
                </span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <label className="cursor-pointer bg-slate-900 text-white px-4 md:px-6 py-2.5 rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-slate-800 transition active:scale-95 flex items-center gap-2">
                <UploadCloud className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Upload Statement</span>
                <span className="sm:hidden">Upload</span>
                <input type="file" multiple className="hidden" onChange={handleFileUpload} accept=".pdf,image/*" />
             </label>
             <button onClick={() => setIsDbConfigOpen(true)} className="lg:hidden p-2.5 bg-slate-50 text-slate-400 rounded-xl border border-slate-100">
               <Database className="w-5 h-5" />
             </button>
          </div>
        </header>

        {/* Scrollable Content Container */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-32 lg:pb-8">
          {/* Prominent Call to Action if database is missing */}
          {!isConfigured && activeTab !== 'report' && (
            <div className="mb-6 bg-amber-50 border border-amber-200 p-6 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl shadow-amber-500/5 animate-fade-in">
              <div className="flex items-center gap-4">
                <div className="bg-amber-100 p-4 rounded-2xl">
                  <AlertTriangle className="w-8 h-8 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-amber-900 tracking-tight">Sync Required</h3>
                  <p className="text-amber-700/70 text-sm font-medium leading-tight">To generate a P&L for your bank interview, you must link your financial vault.</p>
                </div>
              </div>
              <button 
                onClick={() => setIsDbConfigOpen(true)}
                className="w-full md:w-auto bg-amber-600 text-white px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg hover:bg-amber-700 transition active:scale-95 flex items-center justify-center gap-2 shrink-0"
              >
                <Link className="w-4 h-4" />
                Connect Now
              </button>
            </div>
          )}

          {activeTab === 'dashboard' && <Dashboard transactions={transactions} />}
          
          {activeTab === 'transactions' && (
            <div className="space-y-6">
              <FilterBar 
                filters={filters} 
                categories={categories} 
                onFilterChange={setFilters} 
                onClear={() => setFilters({startDate: '', endDate: '', category: '', minAmount: '', maxAmount: '', search: ''})} 
                onOpenCategoryManager={() => setIsCategoryManagerOpen(true)}
                totalCount={totalDbCount}
                filteredCount={transactions.length}
                isLoading={isFetching}
              />
              <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                <div className="xl:col-span-3">
                  <TransactionTable 
                    transactions={transactions} 
                    categories={categories} 
                    onUpdateTransaction={async (t) => {
                      setTransactions(prev => prev.map(old => old.id === t.id ? t : old));
                      trackEvent('categorize', 'ledger', t.category);
                      if (db.isSupabaseConfigured()) await db.upsertTransactions([t]);
                    }} 
                    onDeleteTransaction={async (id) => {
                      setTransactions(prev => prev.filter(t => t.id !== id));
                      trackEvent('delete_record', 'ledger');
                      if (db.isSupabaseConfigured()) {
                        await db.deleteTransaction(id);
                        showToast("Transaction deleted.");
                      }
                    }}
                    onBulkUpdate={handleBulkUpdate}
                    onBulkDelete={handleBulkDelete}
                    onCreateRule={handleCreateRuleFromTable}
                  />
                </div>
                <div className="xl:col-span-1">
                  <RulesEngine 
                    rules={rules} 
                    categories={categories} 
                    transactions={transactions}
                    onAddRule={async (r) => {
                      setRules(prev => [...prev, r]);
                      trackEvent('create_rule', 'automation', r.keyword);
                      if (db.isSupabaseConfigured()) await db.upsertRule(r);
                    }}
                    onRemoveRule={async (id) => {
                      setRules(prev => prev.filter(r => r.id !== id));
                      trackEvent('delete_rule', 'automation');
                      if (db.isSupabaseConfigured()) {
                        await db.deleteRule(id);
                        showToast("Rule removed.");
                      }
                    }}
                    onApplyRules={() => loadData(filters)}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'entities' && (
            <EntityProfiles 
              transactions={transactions}
              profiles={profiles}
              categories={categories}
              onAddProfile={async (p) => {
                const created = await db.upsertProfile(p);
                if (created) {
                  setProfiles(prev => [...prev, created]);
                  trackEvent('create_profile', 'directory', created.name);
                }
                return created;
              }}
              onUpdateProfile={async (p) => {
                const updated = await db.upsertProfile(p);
                if (updated) {
                  setProfiles(prev => prev.map(old => old.id === updated.id ? updated : old));
                  trackEvent('update_profile', 'directory', updated.name);
                }
                return updated;
              }}
              onDeleteProfile={async (id) => {
                if (db.isSupabaseConfigured()) {
                  await db.deleteProfile(id);
                  setProfiles(prev => prev.filter(p => p.id !== id));
                  trackEvent('delete_profile', 'directory');
                  showToast("Profile removed from vault.");
                }
              }}
              onRefreshData={() => loadData(filters)}
            />
          )}

          {activeTab === 'report' && (
            <FinancialReport 
              transactions={transactions}
              bsAdjustments={bsAdjustments}
              bsOverrides={bsOverrides}
              onAddAdjustment={(a) => setBsAdjustments([...bsAdjustments, a])}
              onRemoveAdjustment={(id) => setBsAdjustments(bsAdjustments.filter(a => a.id !== id))}
              onOverride={(cat, val) => setBsOverrides(prev => ({ ...prev, [cat]: val as number }))}
            />
          )}

          {activeTab === 'documents' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {processingQueue.length === 0 ? (
                <div className="col-span-full py-24 flex flex-col items-center justify-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
                  <FilesIcon className="w-16 h-16 text-slate-100 mb-4" />
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No active extractions</p>
                </div>
              ) : (
                processingQueue.map(status => (
                  <div key={status.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <div className="flex justify-between items-start mb-4">
                      <div className={`p-3 rounded-2xl ${
                        status.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 
                        status.status === 'error' ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'
                      }`}>
                        <FileText className="w-6 h-6" />
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                         status.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                      }`}>
                        {status.status}
                      </span>
                    </div>
                    <h4 className="font-black text-slate-800 truncate mb-1 text-sm">{status.fileName}</h4>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">{status.transactionCount || 0} Records Parsed</p>
                    
                    {status.status === 'processing' && (
                      <div className="w-full bg-slate-50 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-indigo-500 h-full animate-progress-indefinite" />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Mobile Bottom Navigation Bar */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-4 py-3 pb-8 flex justify-around items-center z-50 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`flex flex-col items-center gap-1 transition-all ${
                activeTab === item.id ? 'text-indigo-600' : 'text-slate-400'
              }`}
            >
              <item.icon size={22} className={activeTab === item.id ? 'scale-110' : ''} />
              <span className={`text-[10px] font-black uppercase tracking-tighter ${activeTab === item.id ? 'opacity-100' : 'opacity-60'}`}>
                {item.label}
              </span>
            </button>
          ))}
          <button
              onClick={() => setActiveTab('documents')}
              className={`flex flex-col items-center gap-1 transition-all ${
                activeTab === 'documents' ? 'text-indigo-600' : 'text-slate-400'
              }`}
            >
              <FilesIcon size={22} className={activeTab === 'documents' ? 'scale-110' : ''} />
              <span className={`text-[10px] font-black uppercase tracking-tighter ${activeTab === 'documents' ? 'opacity-100' : 'opacity-60'}`}>
                Docs
              </span>
            </button>
        </nav>
      </main>

      {/* Overlays & Modals */}
      <CategoryManager 
        isOpen={isCategoryManagerOpen} 
        onClose={() => setIsCategoryManagerOpen(false)}
        categories={categories}
        onAdd={async (name) => {
          if (db.isSupabaseConfigured()) {
            await db.upsertCategory(name);
            showToast(`Added ${name}.`);
          }
          trackEvent('create_category', 'settings', name);
          loadData(filters);
        }}
        onRename={async (old, next) => {
          if (db.isSupabaseConfigured()) {
            await db.bulkUpdateTransactionCategory(old, next);
            showToast(`Renamed to ${next}.`);
          }
          trackEvent('rename_category', 'settings', next);
          loadData(filters);
        }}
        onDelete={async (name) => {
          if (db.isSupabaseConfigured()) {
            await db.deleteCategory(name);
            showToast(`Deleted ${name}.`);
          }
          trackEvent('delete_category', 'settings', name);
          loadData(filters);
        }}
      />
      
      <DatabaseConfigModal 
        isOpen={isDbConfigOpen} 
        onClose={() => setIsDbConfigOpen(false)} 
        onSuccess={() => loadData(filters)} 
      />

      {toast && (
        <div className={`fixed bottom-24 lg:bottom-10 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl animate-slide-up border ${
          toast.type === 'success' ? 'bg-slate-900 text-white border-white/10' : 'bg-rose-600 text-white border-rose-400'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <X className="w-5 h-5" />}
          <span className="text-sm font-black uppercase tracking-tight">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
