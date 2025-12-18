import React, { useState, useMemo, useEffect } from 'react';
import { UploadCloud, FileText, CheckCircle, AlertCircle, Loader2, Download, Table as TableIcon, Link as LinkIcon, Database, PieChart as PieIcon, LogOut, FileSpreadsheet } from 'lucide-react';
import { 
  Transaction, 
  ProcessingStatus, 
  CategorizationRule, 
  TransactionType,
  SheetUser,
  TransactionFilter,
  BalanceSheetAdjustment,
  DEFAULT_CATEGORIES
} from './types';
import { parseDocumentWithGemini, readFileAsBase64 } from './services/geminiService';
import { connectToSheet, saveTransactionsToSheet, saveRulesToSheet, fetchRulesFromSheet, fetchTransactionsFromSheet } from './services/sheetService';
import Dashboard from './components/Dashboard';
import TransactionTable from './components/TransactionTable';
import RulesEngine from './components/RulesEngine';
import FilterBar from './components/FilterBar';
import CategoryManager from './components/CategoryManager';
import { ProfitLossStatement, BalanceSheet } from './components/FinancialStatements';

function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [processingQueue, setProcessingQueue] = useState<ProcessingStatus[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'pnl' | 'balance'>('dashboard');
  
  const [categories, setCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('cf_categories');
    return saved ? JSON.parse(saved) : DEFAULT_CATEGORIES;
  });
  
  const [rules, setRules] = useState<CategorizationRule[]>(() => {
    const saved = localStorage.getItem('cf_rules');
    return saved ? JSON.parse(saved) : [];
  });

  const [bsAdjustments, setBsAdjustments] = useState<BalanceSheetAdjustment[]>(() => {
    const saved = localStorage.getItem('cf_bs_adjustments');
    return saved ? JSON.parse(saved) : [];
  });

  const [bsOverrides, setBsOverrides] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('cf_bs_overrides');
    return saved ? JSON.parse(saved) : {};
  });

  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [filters, setFilters] = useState<TransactionFilter>({
    startDate: '', endDate: '', category: '', minAmount: '', maxAmount: '', search: ''
  });

  const [sheetUrl, setSheetUrl] = useState(() => localStorage.getItem('cf_sheet_url') || '');
  const [sheetUser, setSheetUser] = useState<SheetUser | null>(() => {
    const saved = localStorage.getItem('cf_sheet_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSavingToSheet, setIsSavingToSheet] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => { localStorage.setItem('cf_categories', JSON.stringify(categories)); }, [categories]);
  useEffect(() => {
    localStorage.setItem('cf_rules', JSON.stringify(rules));
    if (sheetUser && sheetUrl) {
      saveRulesToSheet(sheetUrl, sheetUser.user_id, rules).catch(err => console.error("Rule sync failed", err));
    }
  }, [rules, sheetUser, sheetUrl]);
  useEffect(() => { localStorage.setItem('cf_bs_adjustments', JSON.stringify(bsAdjustments)); }, [bsAdjustments]);
  useEffect(() => { localStorage.setItem('cf_bs_overrides', JSON.stringify(bsOverrides)); }, [bsOverrides]);
  useEffect(() => { if (sheetUrl) localStorage.setItem('cf_sheet_url', sheetUrl); else localStorage.removeItem('cf_sheet_url'); }, [sheetUrl]);
  useEffect(() => { if (sheetUser) localStorage.setItem('cf_sheet_user', JSON.stringify(sheetUser)); else localStorage.removeItem('cf_sheet_user'); }, [sheetUser]);

  useEffect(() => {
    if (sheetUrl && sheetUser && !isInitialized) {
      loadDataFromSheet(sheetUrl, sheetUser.user_id).finally(() => setIsInitialized(true));
    } else { setIsInitialized(true); }
  }, []);

  const loadDataFromSheet = async (url: string, userId: string) => {
    try {
      const [sheetTransactions, sheetRules] = await Promise.all([
        fetchTransactionsFromSheet(url, userId), fetchRulesFromSheet(url, userId)
      ]);
      if (sheetTransactions.length > 0) {
        setTransactions(sheetTransactions);
        const foundCategories = Array.from(new Set(sheetTransactions.map(t => t.category)));
        setCategories(prev => Array.from(new Set([...prev, ...foundCategories])).sort());
      }
      if (sheetRules.length > 0) setRules(sheetRules);
    } catch (e) { console.warn("Sync failed:", e); }
  };

  const exportToCSV = () => {
    if (transactions.length === 0) return;
    const headers = ['Date', 'Description', 'Amount', 'Type', 'Category', 'Original Description'];
    const rows = transactions.map(t => [t.date, t.description, t.amount, t.type, t.category, t.originalDescription]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `cipher_transactions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;
    const files = Array.from(event.target.files) as File[];
    const newQueueItems = files.map(f => ({ fileName: f.name, status: 'pending' as const }));
    setProcessingQueue(prev => [...prev, ...newQueueItems]);

    for (const file of files) {
      setProcessingQueue(prev => prev.map(item => item.fileName === file.name ? { ...item, status: 'processing' } : item));
      try {
        const base64Data = await readFileAsBase64(file);
        const extracted = await parseDocumentWithGemini(file, base64Data);
        setTransactions(prev => [...prev, ...applyRulesToTransactions(extracted, rules)]);
        setProcessingQueue(prev => prev.map(item => item.fileName === file.name ? { ...item, status: 'completed' } : item));
      } catch (error) {
        setProcessingQueue(prev => prev.map(item => item.fileName === file.name ? { ...item, status: 'error' } : item));
      }
    }
  };

  const applyRulesToTransactions = (txs: Transaction[], currentRules: CategorizationRule[]) => {
    const sorted = [...currentRules].sort((a, b) => b.keyword.length - a.keyword.length);
    return txs.map(t => {
      const match = sorted.find(r => t.description.toLowerCase().includes(r.keyword.toLowerCase()) || (t.originalDescription?.toLowerCase().includes(r.keyword.toLowerCase())));
      return match ? { ...t, category: match.targetCategory } : t;
    });
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (filters.startDate && t.date < filters.startDate) return false;
      if (filters.endDate && t.date > filters.endDate) return false;
      if (filters.category && t.category !== filters.category) return false;
      if (filters.minAmount && t.amount < parseFloat(filters.minAmount)) return false;
      if (filters.maxAmount && t.amount > parseFloat(filters.maxAmount)) return false;
      if (filters.search) return t.description.toLowerCase().includes(filters.search.toLowerCase());
      return true;
    });
  }, [transactions, filters]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 relative">
      <CategoryManager isOpen={isCategoryManagerOpen} onClose={() => setIsCategoryManagerOpen(false)} categories={categories} onAdd={c => setCategories(prev => [...prev, c].sort())} onRename={(o, n) => setCategories(prev => prev.map(c => c === o ? n : c).sort())} onDelete={c => setCategories(prev => prev.filter(cat => cat !== c))} />
      
      {isConnectModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4 flex items-center"><Database className="w-6 h-6 mr-2 text-emerald-600" /> Cloud Sync Setup</h3>
            <input type="text" className="w-full border p-3 rounded-lg mb-4 text-sm" placeholder="Apps Script URL..." value={sheetUrl} onChange={e => setSheetUrl(e.target.value)} />
            <div className="flex justify-end space-x-3">
              <button onClick={() => setIsConnectModalOpen(false)} className="px-4 py-2 text-slate-600">Cancel</button>
              <button onClick={async () => { setIsConnecting(true); try { const u = await connectToSheet(sheetUrl); setSheetUser(u); setIsConnectModalOpen(false); await loadDataFromSheet(sheetUrl, u.user_id); } finally { setIsConnecting(false); } }} className="px-4 py-2 bg-emerald-600 text-white rounded-lg">Connect</button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm print:hidden">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-blue-600 p-2 rounded-lg"><FileText className="w-5 h-5 text-white" /></div>
            <h1 className="text-xl font-bold text-slate-800">Cipher Finance</h1>
          </div>
          <div className="flex items-center space-x-3">
             <button onClick={exportToCSV} className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-sm font-medium transition">
               <FileSpreadsheet className="w-4 h-4" /><span>Export CSV</span>
             </button>
             {!sheetUser ? (
               <button onClick={() => setIsConnectModalOpen(true)} className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition"><LinkIcon className="w-4 h-4" /><span>Cloud Sync</span></button>
             ) : (
                <div className="flex items-center space-x-2">
                   <button onClick={async () => { setIsSavingToSheet(true); try { await saveTransactionsToSheet(sheetUrl, sheetUser.user_id, transactions); setSaveStatus('success'); setTimeout(() => setSaveStatus('idle'), 3000); } finally { setIsSavingToSheet(false); } }} className="flex items-center space-x-2 px-4 py-2 rounded-lg text-white font-medium transition text-sm bg-slate-800">
                      {isSavingToSheet ? <Loader2 className="w-4 h-4 animate-spin" /> : <TableIcon className="w-4 h-4" />}
                      <span>{saveStatus === 'success' ? 'Saved!' : 'Sync to Cloud'}</span>
                   </button>
                   <button onClick={() => { setSheetUser(null); setSheetUrl(''); setTransactions([]); }} className="p-2 text-slate-400 hover:text-rose-500"><LogOut className="w-4 h-4" /></button>
                </div>
             )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {!isInitialized ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400"><Loader2 className="w-10 h-10 animate-spin mb-4" /><p>Restoring your profile...</p></div>
        ) : (
          <>
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 print:hidden">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white p-8 rounded-2xl border-2 border-slate-200 border-dashed hover:border-blue-400 transition-colors cursor-pointer relative group">
                  <input type="file" multiple onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  <div className="flex flex-col items-center justify-center text-center space-y-3">
                    <div className="p-4 bg-blue-50 text-blue-600 rounded-full group-hover:bg-blue-100 transition-colors"><UploadCloud className="w-8 h-8" /></div>
                    <div><h3 className="text-lg font-semibold text-slate-700">Scan Bank Statements</h3><p className="text-slate-500 text-sm">Upload images, PDFs, or CSVs for AI analysis.</p></div>
                  </div>
                </div>
                {processingQueue.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-100 divide-y divide-slate-100 max-h-40 overflow-y-auto">
                    {processingQueue.map((item, idx) => (
                      <div key={idx} className="px-4 py-2 flex items-center justify-between">
                          <span className="text-xs text-slate-600 truncate max-w-[150px]">{item.fileName}</span>
                          {item.status === 'processing' ? <span className="text-blue-500 text-[10px] animate-pulse">Analyzing...</span> : <CheckCircle className="w-3 h-3 text-emerald-500" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="lg:col-span-1">
                <RulesEngine rules={rules} categories={categories} onAddRule={r => setRules(prev => [...prev, r])} onRemoveRule={id => setRules(prev => prev.filter(r => r.id !== id))} onApplyRules={() => setTransactions(prev => applyRulesToTransactions(prev, rules))} />
              </div>
            </section>

            <section className="space-y-6">
              <div className="flex space-x-1 bg-slate-200/50 p-1 rounded-xl w-fit shadow-inner print:hidden">
                {['dashboard', 'transactions', 'pnl', 'balance'].map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-6 py-2 rounded-lg text-sm font-medium transition-all capitalize ${activeTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    {tab === 'pnl' ? 'P&L Statement' : tab === 'balance' ? 'Balance Sheet' : tab}
                  </button>
                ))}
              </div>
              
              <div className="print:hidden">
                <FilterBar filters={filters} categories={categories} onFilterChange={setFilters} onClear={() => setFilters({ startDate: '', endDate: '', category: '', minAmount: '', maxAmount: '', search: '' })} onOpenCategoryManager={() => setIsCategoryManagerOpen(true)} />
              </div>

              <div className="min-h-[500px]">
                {activeTab === 'dashboard' && <Dashboard transactions={filteredTransactions} />}
                {activeTab === 'transactions' && <TransactionTable transactions={filteredTransactions} categories={categories} onUpdateTransaction={updated => setTransactions(prev => prev.map(t => t.id === updated.id ? updated : t))} onDeleteTransaction={id => setTransactions(prev => prev.filter(t => t.id !== id))} />}
                {activeTab === 'pnl' && <ProfitLossStatement transactions={filteredTransactions} />}
                {activeTab === 'balance' && <BalanceSheet transactions={filteredTransactions} adjustments={bsAdjustments} overrides={bsOverrides} onAddAdjustment={adj => setBsAdjustments(prev => [...prev, adj])} onRemoveAdjustment={id => setBsAdjustments(prev => prev.filter(a => a.id !== id))} onOverride={(cat, amount) => setBsOverrides(prev => ({...prev, [cat]: amount}))} />}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default App;