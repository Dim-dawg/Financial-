import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  UploadCloud, FileText, Loader2, 
  Database, FileSpreadsheet, Users, Key, X, 
  Files as FilesIcon, Shield, FileBadge, CheckCircle2,
  LayoutDashboard, Briefcase, Wand2, Plus, Server,
  AlertTriangle, Link, Info, ShieldCheck, Lock, ArrowRight,
  Globe, Cpu, Sparkles, Play, Landmark, Menu, Scale, PieChart
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
  AccountType,
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
import FinancialReport from './components/FinancialReport';
import DatabaseConfigModal from './components/DatabaseConfigModal';

const navItems = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'transactions', label: 'Ledger', icon: Database },
  { id: 'entities', label: 'Identities', icon: Users },
  { id: 'pnl', label: 'Profit & Loss', icon: FileBadge },
  { id: 'balance_sheet', label: 'Balance Sheet', icon: Scale },
];

// Pre-loaded data to match the user's specific Balance Sheet request
const LOAN_INTERVIEW_DATA: Transaction[] = [
  // --- Equity Injection (Balances the Cash to $280) ---
  { id: 'eq-1', date: '2024-05-20', description: 'Owner Capital Injection', amount: 21087.69, type: TransactionType.INCOME, category: 'Owner\'s Equity', entityName: 'Owner', originalDescription: 'Owner Capital Injection' },
  
  // --- Liabilities (Inflow of Cash/Value) ---
  { id: 'liab-1', date: '2024-05-20', description: 'Quickstop Loan Funding', amount: 1192.31, type: TransactionType.INCOME, category: 'Loans', entityName: 'Quickstop', originalDescription: 'Quickstop Loan Funding' },
  { id: 'liab-2', date: '2024-05-20', description: 'Rent Payable Accrual', amount: 1400.00, type: TransactionType.INCOME, category: 'Rent Payable', entityName: 'Landlord', originalDescription: 'Rent Payable Accrual' },

  // --- Asset Purchases (Outflow of Cash/Value) ---
  { id: 'ast-1', date: '2024-05-20', description: 'Inventory - Cypher', amount: 2000.00, type: TransactionType.EXPENSE, category: 'Inventory', entityName: 'Cypher', originalDescription: 'Inventory - Cypher' },
  { id: 'ast-2', date: '2024-05-20', description: 'Inventory - Sneak Peek EP', amount: 20000.00, type: TransactionType.EXPENSE, category: 'Inventory', entityName: 'Sneak Peek', originalDescription: 'Inventory - Sneak Peek EP' },
  { id: 'ast-3', date: '2024-05-20', description: 'Equipment - Laptops (2)', amount: 1000.00, type: TransactionType.EXPENSE, category: 'Equipment', entityName: 'Apple', originalDescription: 'Equipment - Laptops (2)' },
  { id: 'ast-4', date: '2024-05-20', description: 'Equipment - Phone', amount: 400.00, type: TransactionType.EXPENSE, category: 'Equipment', entityName: 'Verizon', originalDescription: 'Equipment - Phone' },
];

const CUSTOM_CATEGORIES: Category[] = [
  { id: 'c1', name: 'Inventory', accountType: AccountType.CURRENT_ASSET },
  { id: 'c2', name: 'Equipment', accountType: AccountType.FIXED_ASSET },
  { id: 'c3', name: 'Loans', accountType: AccountType.CURRENT_LIABILITY },
  { id: 'c4', name: 'Rent Payable', accountType: AccountType.CURRENT_LIABILITY },
  { id: 'c5', name: 'Owner\'s Equity', accountType: AccountType.EQUITY },
  ...DEFAULT_CATEGORIES.map(name => ({ 
    id: name, 
    name, 
    accountType: name.includes('Income') || name.includes('Revenue') ? AccountType.INCOME : AccountType.EXPENSE 
  }))
];

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  // Initialize with the loan interview data by default
  const [transactions, setTransactions] = useState<Transaction[]>(LOAN_INTERVIEW_DATA);
  const [totalDbCount, setTotalDbCount] = useState(LOAN_INTERVIEW_DATA.length);
  const [processingQueue, setProcessingQueue] = useState<ProcessingStatus[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'entities' | 'pnl' | 'balance_sheet' | 'documents'>('balance_sheet'); // Default to Balance Sheet for the user
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [businessName, setBusinessName] = useState(localStorage.getItem('cf_biz_name') || 'LITIGATION SERVICES CORP');
  
  const [categories, setCategories] = useState<Category[]>(CUSTOM_CATEGORIES);
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
      
      // If DB is empty, keep our demo data, otherwise use DB data
      if (txs.length > 0) {
        setTransactions(txs);
        setTotalDbCount(totalCount);
      }
      
      setRules(rls);
      setProfiles(profs);
      
      if (cats.length > 0) setCategories(cats);
    } catch (err) {
      console.error("Fetch failed", err);
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      if (isConfigured) {
        await loadData();
      }
      setIsInitialized(true);
    };
    init();
  }, [isConfigured, loadData]);

  useEffect(() => {
    if (isInitialized && isConfigured) loadData(filters);
  }, [filters, isInitialized, isConfigured, loadData]);

  const updateBusinessName = (name: string) => {
    setBusinessName(name);
    localStorage.setItem('cf_biz_name', name);
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleTransactionUpdate = async (t: Transaction) => {
    setTransactions(prev => prev.map(old => old.id === t.id ? t : old));
    if (db.isSupabaseConfigured()) await db.upsertTransactions([t]);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!isConfigured) {
      setIsDbConfigOpen(true);
      return;
    }
    const fileList = event.target.files;
    if (!fileList) return;
    const files = Array.from(fileList) as File[];
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
        
        await db.upsertTransactions(extracted);
        await loadData(filters);
        
        setProcessingQueue(prev => prev.map(s => s.id === status.id ? { ...s, status: 'completed', transactionCount: extracted.length } : s));
        showToast(`Extracted ${extracted.length} records.`);
      } catch (err: any) {
        setProcessingQueue(prev => prev.map(s => s.id === status.id ? { ...s, status: 'error', message: err instanceof Error ? err.message : 'Failed' } : s));
      }
    }
  };

  const handleUpdateCategoryType = (id: string, type: AccountType) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, accountType: type } : c));
  };

  const handleCreateProfile = async (p: EntityProfile): Promise<EntityProfile | null> => {
      const created = await db.upsertProfile(p);
      if (created) {
        setProfiles(prev => [...prev, created]);
        showToast(`Identity "${created.name}" created.`);
      }
      return created || null;
  };

  const ReportSwitcher = () => (
    <div className="flex items-center justify-center mb-6 print:hidden">
      <div className="bg-slate-200/50 p-1.5 rounded-xl flex gap-1">
         <button 
           onClick={() => setActiveTab('pnl')}
           className={`px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'pnl' ? 'bg-white text-indigo-600 shadow-md scale-105' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
         >
           Profit & Loss
         </button>
         <button 
           onClick={() => setActiveTab('balance_sheet')}
           className={`px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'balance_sheet' ? 'bg-white text-indigo-600 shadow-md scale-105' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
         >
           Balance Sheet
         </button>
      </div>
    </div>
  );

  if (isInitialized && !isConfigured) {
    return (
      <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-indigo-600/10 rounded-full -mr-96 -mt-96 blur-[150px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-emerald-600/10 rounded-full -ml-96 -mb-96 blur-[150px] pointer-events-none" />

        <div className="max-w-xl w-full relative z-10 animate-fade-in">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-3 mb-10">
              <div className="bg-indigo-600 p-4 rounded-[1.75rem] shadow-2xl shadow-indigo-500/20">
                <Shield className="w-10 h-10" />
              </div>
              <h1 className="text-5xl font-black tracking-tighter uppercase italic">Cipher</h1>
            </div>
            <h2 className="text-4xl font-black mb-4 tracking-tight leading-tight">Prepare for your Loan Interview</h2>
            <p className="text-slate-400 font-medium leading-relaxed max-w-sm mx-auto">
              Generate P&L statements and Balance Sheets instantly from your bank data.
            </p>
          </div>

          <div className="space-y-4">
            {/* Direct Access for User */}
            <button 
              onClick={() => setIsInitialized(true)}
              className="w-full p-8 bg-indigo-600 text-white rounded-[2.5rem] hover:bg-indigo-500 transition-all text-left flex items-center justify-between group shadow-2xl shadow-indigo-500/20"
            >
               <div>
                <h3 className="text-xl font-bold mb-1">Access Loan Dashboard</h3>
                <p className="text-indigo-200 text-sm">View pre-loaded balance sheet data.</p>
              </div>
              <div className="bg-white/20 p-3 rounded-2xl group-hover:scale-110 transition-transform">
                <ArrowRight className="w-5 h-5" />
              </div>
            </button>

            <button 
              onClick={() => setIsDbConfigOpen(true)}
              className="w-full p-6 bg-white/5 text-slate-300 rounded-[2rem] hover:bg-white/10 transition-all text-left flex items-center justify-between group border border-white/10"
            >
              <div>
                <h3 className="text-sm font-bold mb-1">Connect Private Vault</h3>
                <p className="text-slate-500 text-xs">Sync your permanent ledger.</p>
              </div>
              <Database className="w-4 h-4" />
            </button>
          </div>
        </div>
        <DatabaseConfigModal isOpen={isDbConfigOpen} onClose={() => setIsDbConfigOpen(false)} onSuccess={() => loadData()} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row overflow-hidden">
      {/* Sidebar */}
      <nav className="hidden lg:flex flex-col w-72 bg-slate-900 text-white p-8 shrink-0 print:hidden">
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
          <div className="h-px bg-white/10 my-2 mx-4"></div>
          <button
            onClick={() => setActiveTab('documents')}
            className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all ${
              activeTab === 'documents' ? 'bg-indigo-600 shadow-xl' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <FilesIcon size={18} /> Uploads
          </button>
        </div>

        <div className="mt-auto pt-8 border-t border-white/5">
          <button 
            onClick={() => setIsDbConfigOpen(true)}
            className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <Database size={18} /> Vault Settings
          </button>
        </div>
      </nav>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-slate-900 text-white z-[100] border-t border-white/10 pb-6 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] print:hidden">
        <div className="flex justify-around items-center h-20">
          {navItems.slice(0,3).map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all ${
                activeTab === item.id ? 'text-indigo-400 scale-110 font-bold' : 'text-slate-500'
              }`}
            >
              <item.icon size={22} />
              <span className="text-[9px] font-black uppercase tracking-tighter">{item.label}</span>
            </button>
          ))}
          <button
             onClick={() => setActiveTab('pnl')}
              className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all ${
                (activeTab === 'pnl' || activeTab === 'balance_sheet') ? 'text-indigo-400 scale-110 font-bold' : 'text-slate-500'
              }`}
          >
             <FileBadge size={22} />
             <span className="text-[9px] font-black uppercase tracking-tighter">Reports</span>
          </button>
        </div>
      </nav>

      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 h-[100dvh] overflow-hidden relative print:bg-white print:h-auto print:overflow-visible">
        <header className="h-16 lg:h-20 bg-white border-b border-slate-100 flex items-center justify-between px-6 shrink-0 z-20 print:hidden">
          <div className="flex items-center gap-2">
            <Shield className="text-indigo-600 w-5 h-5 lg:hidden" />
            <span className="font-black text-lg tracking-tighter lg:hidden uppercase">Cipher</span>
            <div className="hidden lg:flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
                <Landmark className={`w-4 h-4 ${isConfigured ? 'text-indigo-500' : 'text-rose-500'}`} />
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                  {`${totalDbCount} Records`}
                </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
             <label className="cursor-pointer bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-slate-800 transition flex items-center gap-2">
                <UploadCloud className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Add Statement</span>
                <span className="sm:hidden">Upload</span>
                <input type="file" multiple className="hidden" onChange={handleFileUpload} accept=".pdf,image/*" />
             </label>
          </div>
        </header>

        <div className="flex-1 relative overflow-hidden bg-slate-50 print:bg-white print:overflow-visible">
          
          {/* Dashboard Tab */}
          <div className={`absolute inset-0 overflow-y-auto p-4 lg:p-8 pb-32 print:hidden ${activeTab === 'dashboard' ? 'block' : 'hidden'}`}>
             <Dashboard transactions={transactions} />
          </div>

          {/* Transactions Tab */}
          <div className={`absolute inset-0 overflow-y-auto p-4 lg:p-8 pb-32 print:hidden ${activeTab === 'transactions' ? 'block' : 'hidden'}`}>
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
              <TransactionTable 
                transactions={transactions} 
                categories={categories} 
                profiles={profiles}
                onUpdateTransaction={handleTransactionUpdate} 
                onDeleteTransaction={async (id) => {
                  setTransactions(prev => prev.filter(t => t.id !== id));
                  if (db.isSupabaseConfigured()) await db.deleteTransaction(id);
                }}
                onBulkUpdate={async (ids, updates) => {
                  setTransactions(prev => prev.map(t => ids.includes(t.id) ? { ...t, ...updates } : t));
                  const targets = transactions.filter(t => ids.includes(t.id)).map(t => ({ ...t, ...updates }));
                  if (db.isSupabaseConfigured()) await db.upsertTransactions(targets);
                }}
                onCreateProfile={handleCreateProfile}
              />
            </div>
          </div>

          {/* Entities Tab */}
          <div className={`absolute inset-0 bg-slate-50 print:hidden ${activeTab === 'entities' ? 'block' : 'hidden'}`}>
             <div className="h-full p-4 lg:p-8 pb-32">
              <EntityProfiles 
                transactions={transactions}
                profiles={profiles}
                categories={categories}
                onUpdateTransaction={handleTransactionUpdate}
                onAddProfile={handleCreateProfile}
                onUpdateProfile={async (p) => {
                  const updated = await db.upsertProfile(p);
                  if (updated) setProfiles(prev => prev.map(old => old.id === updated.id ? updated : old));
                  return updated;
                }}
                onDeleteProfile={async (id) => {
                  await db.deleteProfile(id);
                  setProfiles(prev => prev.filter(p => p.id !== id));
                  setTransactions(prev => prev.map(t => t.entityId === id ? { ...t, entityId: undefined, entityName: undefined } : t));
                }}
                onRefreshData={() => loadData(filters)}
              />
            </div>
          </div>

          {/* P&L Report Tab */}
          <div className={`absolute inset-0 overflow-y-auto p-4 lg:p-8 pb-32 print:relative print:inset-auto print:overflow-visible print:p-0 print:pb-0 ${activeTab === 'pnl' ? 'block' : 'hidden'}`}>
             <div className="print:hidden mb-6">
                <ReportSwitcher />
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
             </div>
             <FinancialReport 
              view="pnl"
              transactions={transactions}
              categories={categories}
              bsAdjustments={bsAdjustments}
              bsOverrides={bsOverrides}
              filters={filters}
              businessName={businessName}
              onUpdateBusinessName={updateBusinessName}
              onAddAdjustment={(a) => setBsAdjustments([...bsAdjustments, a])}
              onRemoveAdjustment={(id) => setBsAdjustments(bsAdjustments.filter(a => a.id !== id))}
              onOverride={(cat, val) => setBsOverrides(prev => ({ ...prev, [cat]: val as number }))}
            />
          </div>

          {/* Balance Sheet Tab */}
          <div className={`absolute inset-0 overflow-y-auto p-4 lg:p-8 pb-32 print:relative print:inset-auto print:overflow-visible print:p-0 print:pb-0 ${activeTab === 'balance_sheet' ? 'block' : 'hidden'}`}>
             <div className="print:hidden mb-6">
                <ReportSwitcher />
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
             </div>
             <FinancialReport 
              view="balance_sheet"
              transactions={transactions}
              categories={categories}
              bsAdjustments={bsAdjustments}
              bsOverrides={bsOverrides}
              filters={filters}
              businessName={businessName}
              onUpdateBusinessName={updateBusinessName}
              onAddAdjustment={(a) => setBsAdjustments([...bsAdjustments, a])}
              onRemoveAdjustment={(id) => setBsAdjustments(bsAdjustments.filter(a => a.id !== id))}
              onOverride={(cat, val) => setBsOverrides(prev => ({ ...prev, [cat]: val as number }))}
            />
          </div>

          {/* Documents Tab */}
          <div className={`absolute inset-0 overflow-y-auto p-4 lg:p-8 pb-32 print:hidden ${activeTab === 'documents' ? 'block' : 'hidden'}`}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {processingQueue.map(status => (
                <div key={status.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <div className={`p-3 rounded-2xl inline-block mb-4 ${status.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                    <FileText className="w-6 h-6" />
                  </div>
                  <h4 className="font-black text-slate-800 truncate mb-1 text-sm">{status.fileName}</h4>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{status.status}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <CategoryManager 
        isOpen={isCategoryManagerOpen} 
        onClose={() => setIsCategoryManagerOpen(false)}
        categories={categories}
        onAdd={async (name, type) => {
          if (db.isSupabaseConfigured()) {
            await db.upsertCategory(name);
            loadData(filters);
          }
        }}
        onRename={async (old, next) => {
          if (db.isSupabaseConfigured()) {
            await db.bulkUpdateTransactionCategory(old, next);
            loadData(filters);
          }
        }}
        onDelete={async (name) => {
          if (db.isSupabaseConfigured()) {
            await db.deleteCategory(name);
            loadData(filters);
          }
        }}
        onUpdateType={handleUpdateCategoryType}
      />
      
      <DatabaseConfigModal isOpen={isDbConfigOpen} onClose={() => setIsDbConfigOpen(false)} onSuccess={() => { loadData(filters); }} />

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl animate-slide-up bg-slate-900 text-white border border-white/10 print:hidden">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-black uppercase tracking-tight">{toast.message}</span>
        </div>
      )}
    </div>
  );
}