
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  UploadCloud, FileText, CheckCircle, AlertCircle, Loader2, Download, 
  Table as TableIcon, Link as LinkIcon, Database, PieChart as PieIcon, 
  LogOut, FileSpreadsheet, Users, Key, Hourglass, X, RotateCcw, Eye, Trash2,
  Files as FilesIcon, ExternalLink, Wallet, RefreshCw, Play
} from 'lucide-react';
import { 
  Transaction, 
  ProcessingStatus, 
  CategorizationRule, 
  TransactionType,
  SheetUser,
  TransactionFilter,
  BalanceSheetAdjustment,
  EntityProfile,
  DEFAULT_CATEGORIES
} from './types';
import { parseDocumentWithGemini, readFileAsBase64 } from './services/geminiService';
import { connectToSheet, saveTransactionsToSheet, saveRulesToSheet, fetchRulesFromSheet, fetchTransactionsFromSheet } from './services/sheetService';
import Dashboard from './components/Dashboard';
import TransactionTable from './components/TransactionTable';
import RulesEngine from './components/RulesEngine';
import FilterBar from './components/FilterBar';
import CategoryManager from './components/CategoryManager';
import EntityProfiles from './components/EntityProfiles';
import { ProfitLossStatement, BalanceSheet } from './components/FinancialStatements';

function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [processingQueue, setProcessingQueue] = useState<ProcessingStatus[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'entities' | 'pnl' | 'balance' | 'documents'>('dashboard');
  const [previewDoc, setPreviewDoc] = useState<ProcessingStatus | null>(null);
  const [isAutoProcessing, setIsAutoProcessing] = useState(true);
  
  const isProcessingRef = useRef(false);

  const [categories, setCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('cf_categories');
    return saved ? JSON.parse(saved) : DEFAULT_CATEGORIES;
  });
  
  const [rules, setRules] = useState<CategorizationRule[]>(() => {
    const saved = localStorage.getItem('cf_rules');
    return saved ? JSON.parse(saved) : [];
  });

  const [profiles, setProfiles] = useState<EntityProfile[]>(() => {
    const saved = localStorage.getItem('cf_profiles');
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
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isSavingToSheet, setIsSavingToSheet] = useState(false);
  const [showKeyWarning, setShowKeyWarning] = useState(false);
  const [isKeyWarningDismissed, setIsKeyWarningDismissed] = useState(false);

  useEffect(() => { localStorage.setItem('cf_categories', JSON.stringify(categories)); }, [categories]);
  useEffect(() => { localStorage.setItem('cf_profiles', JSON.stringify(profiles)); }, [profiles]);
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
    const checkKey = async () => {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) setShowKeyWarning(true);
      }
    };
    checkKey();
    if (sheetUrl && sheetUser && !isInitialized) {
      loadDataFromSheet(sheetUrl, sheetUser.user_id).finally(() => setIsInitialized(true));
    } else { setIsInitialized(true); }
  }, []);

  // Background processing loop
  useEffect(() => {
    if (!isAutoProcessing) return;

    const processNext = async () => {
      if (isProcessingRef.current) return;
      
      const nextItem = processingQueue.find(item => item.status === 'pending');
      if (!nextItem) return;

      isProcessingRef.current = true;
      setProcessingQueue(prev => prev.map(item => item.id === nextItem.id ? { ...item, status: 'processing' } : item));

      try {
        const extracted = await parseDocumentWithGemini({ name: nextItem.fileName, type: nextItem.fileType } as File, nextItem.data);
        
        setProcessingQueue(prev => {
          const current = prev.find(p => p.id === nextItem.id);
          if (current?.status === 'cancelled') return prev;
          
          const taggedTxs = applyRulesToTransactions(extracted, rules).map(t => ({ ...t, documentId: nextItem.id }));
          setTransactions(txs => [...txs, ...taggedTxs]);
          
          return prev.map(item => item.id === nextItem.id ? { ...item, status: 'completed', transactionCount: taggedTxs.length } : item);
        });

        // Safe delay between items
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (error: any) {
        const errorMsg = error.message || "Unknown error";
        
        if (errorMsg === "ENTITY_NOT_FOUND" && window.aistudio) {
          await window.aistudio.openSelectKey();
        }

        setProcessingQueue(prev => {
          const current = prev.find(p => p.id === nextItem.id);
          if (current?.status === 'cancelled') return prev;
          return prev.map(item => item.id === nextItem.id ? { ...item, status: 'error', message: errorMsg } : item);
        });

        if (errorMsg === "RATE_LIMIT_EXCEEDED" || errorMsg.includes('429') || errorMsg.includes('403')) {
          setShowKeyWarning(true);
          setIsKeyWarningDismissed(false);
          setIsAutoProcessing(false); // Stop auto-processing on rate limits
        }
      } finally {
        isProcessingRef.current = false;
      }
    };

    processNext();
  }, [processingQueue, rules, isAutoProcessing]);

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
    link.setAttribute("download", `cipher_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenKeySelect = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setShowKeyWarning(false);
      setIsKeyWarningDismissed(false);
      setIsAutoProcessing(true); // Resume processing after key re-selection
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;
    const files = Array.from(event.target.files) as File[];
    
    const newItems: ProcessingStatus[] = [];
    for (const file of files) {
      const base64Data = await readFileAsBase64(file);
      newItems.push({
        id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        fileName: file.name,
        fileType: file.type,
        data: base64Data,
        status: 'pending'
      });
    }
    
    setProcessingQueue(prev => [...prev, ...newItems]);
    setIsAutoProcessing(true); // New files trigger auto-process
    event.target.value = '';
  };

  const cancelProcessing = (id: string) => {
    setProcessingQueue(prev => prev.map(item => item.id === id ? { ...item, status: 'cancelled' } : item));
  };

  const startAnalysis = (id: string) => {
    setTransactions(prev => prev.filter(t => t.documentId !== id));
    setProcessingQueue(prev => prev.map(item => item.id === id ? { ...item, status: 'pending', message: undefined, transactionCount: 0 } : item));
    setIsAutoProcessing(true);
  };

  const removeFromQueue = (id: string, removeTransactions = true) => {
    if (removeTransactions) {
      setTransactions(prev => prev.filter(t => t.documentId !== id));
    }
    setProcessingQueue(prev => prev.filter(item => item.id !== id));
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

  const handleConnectToCloud = async () => {
    setConnectError(null);
    setIsConnecting(true);
    try {
      const u = await connectToSheet(sheetUrl);
      setSheetUser(u);
      setIsConnectModalOpen(false);
      await loadDataFromSheet(sheetUrl, u.user_id);
    } catch (err: any) {
      setConnectError(err.message || "An unexpected error occurred.");
    } finally {
      setIsConnecting(false);
    }
  };

  const pendingCount = processingQueue.filter(q => q.status === 'pending' || q.status === 'error').length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 relative">
      <CategoryManager isOpen={isCategoryManagerOpen} onClose={() => setIsCategoryManagerOpen(false)} categories={categories} onAdd={c => setCategories(prev => [...prev, c].sort())} onRename={(o, n) => setCategories(prev => prev.map(c => c === o ? n : c).sort())} onDelete={c => setCategories(prev => prev.filter(cat => cat !== c))} />
      
      {previewDoc && (
        <div className="fixed inset-0 bg-slate-900/80 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-scale-up">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0">
              <div className="flex items-center gap-3">
                <div className="bg-blue-50 p-2 rounded-xl text-blue-600"><FileText className="w-5 h-5" /></div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg leading-tight">{previewDoc.fileName}</h3>
                  <p className="text-xs text-slate-400">Document Analysis Review</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                   onClick={() => { setPreviewDoc(null); startAnalysis(previewDoc.id); }}
                   className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Re-analyze
                </button>
                <button onClick={() => setPreviewDoc(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100/50 p-4 md:p-8 overflow-auto flex items-start justify-center">
              {previewDoc.fileType.includes('pdf') ? (
                <iframe src={`data:${previewDoc.fileType};base64,${previewDoc.data}`} className="w-full h-full rounded-xl shadow-2xl bg-white border border-slate-200" />
              ) : (
                <img src={`data:${previewDoc.fileType};base64,${previewDoc.data}`} className="max-w-full rounded-xl shadow-2xl border border-slate-200" alt="Preview" />
              )}
            </div>
          </div>
        </div>
      )}

      {showKeyWarning && !isKeyWarningDismissed && (
        <div className="fixed top-20 right-4 left-4 md:left-auto md:w-96 bg-white border border-rose-100 shadow-2xl rounded-2xl p-5 z-[60] animate-slide-up">
          <button 
            onClick={() => setIsKeyWarningDismissed(true)} 
            className="absolute top-3 right-3 p-1 hover:bg-slate-100 rounded-full transition"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
          <div className="flex items-start gap-4">
            <div className="bg-rose-50 p-2 rounded-xl text-rose-600"><AlertCircle className="w-5 h-5" /></div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-slate-800">Resource Limit Reached</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">Free tier keys have strict limits. For faster processing and higher volume, please use a billing-enabled API key.</p>
              <button onClick={handleOpenKeySelect} className="mt-4 w-full py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition flex items-center justify-center gap-2"><Key className="w-3.5 h-3.5" /> Select API Key</button>
            </div>
          </div>
        </div>
      )}

      {isConnectModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-6 w-full max-w-md animate-fade-in shadow-2xl">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold flex items-center"><Database className="w-6 h-6 mr-2 text-emerald-600" /> Cloud Sync Setup</h3>
              <button onClick={() => setIsConnectModalOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">Ensure your Google Apps Script is deployed as a Web App with access for "Anyone".</p>
            <input 
              type="text" 
              className={`w-full border p-3 rounded-lg mb-2 text-sm focus:ring-2 outline-none ${connectError ? 'border-rose-300 ring-rose-50' : 'border-slate-200 ring-emerald-50'}`} 
              placeholder="Script Deployment URL" 
              value={sheetUrl} 
              onChange={e => setSheetUrl(e.target.value)} 
            />
            {connectError && <p className="text-rose-500 text-xs mb-4 px-1">{connectError}</p>}
            <div className="flex justify-between space-x-3 mt-4">
              <button 
                onClick={() => { setSheetUrl(''); setSheetUser(null); localStorage.removeItem('cf_sheet_url'); localStorage.removeItem('cf_sheet_user'); }} 
                className="text-[10px] font-bold text-slate-400 hover:text-rose-500 uppercase tracking-wider flex items-center gap-1.5"
              >
                <RefreshCw className="w-3 h-3" /> Reset Session
              </button>
              <div className="flex gap-3">
                <button onClick={() => setIsConnectModalOpen(false)} className="px-4 py-2 text-slate-600 text-sm">Close</button>
                <button onClick={handleConnectToCloud} disabled={isConnecting || !sheetUrl} className="px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-emerald-100 disabled:opacity-50">
                  {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm print:hidden">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <div className="bg-blue-600 p-1.5 rounded-lg"><FileText className="w-4 h-4 text-white" /></div>
              <h1 className="text-lg font-bold text-slate-800 tracking-tight">Cipher</h1>
            </div>
            
            <button 
              onClick={() => setIsConnectModalOpen(true)}
              className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition ${sheetUser ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}
            >
              <Database className="w-3.5 h-3.5" />
              {sheetUser ? `Cloud Synced: ${sheetUser.name}` : 'Connect to Cloud'}
              {sheetUser && <CheckCircle className="w-3 h-3" />}
            </button>
          </div>

          <div className="flex items-center space-x-2">
             <button onClick={handleOpenKeySelect} className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition" title="API Settings"><Key className="w-4 h-4" /></button>
             <button onClick={exportToCSV} className="p-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition" title="Export CSV"><FileSpreadsheet className="w-4 h-4" /></button>
             {sheetUser && (
                <div className="flex items-center space-x-2">
                   <button onClick={async () => { setIsSavingToSheet(true); try { await saveTransactionsToSheet(sheetUrl, sheetUser.user_id, transactions); } finally { setIsSavingToSheet(false); } }} className="p-2 rounded-lg bg-slate-800 text-white shadow-sm" title="Push Data to Sheets">
                      {isSavingToSheet ? <Loader2 className="w-4 h-4 animate-spin" /> : <TableIcon className="w-4 h-4" />}
                   </button>
                   <button onClick={() => { setSheetUser(null); setSheetUrl(''); setTransactions([]); }} className="p-2 text-slate-300 hover:text-rose-500" title="Logout"><LogOut className="w-4 h-4" /></button>
                </div>
             )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 md:py-8 space-y-6 md:space-y-8">
        {!isInitialized ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400"><Loader2 className="w-10 h-10 animate-spin mb-4" /><p>Restoring session...</p></div>
        ) : (
          <>
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 print:hidden">
              <div className="lg:col-span-2 space-y-4 md:space-y-6">
                <div className="bg-white p-6 md:p-8 rounded-2xl border-2 border-slate-200 border-dashed hover:border-blue-400 transition cursor-pointer relative group">
                  <input type="file" multiple onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  <div className="flex flex-col items-center justify-center text-center space-y-3">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-full group-hover:bg-blue-100 transition"><UploadCloud className="w-6 h-6" /></div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-700">Import Statements</h3>
                      <p className="text-slate-500 text-xs">Drop PDF or Images here to begin analysis</p>
                    </div>
                  </div>
                </div>
                
                {processingQueue.length > 0 && activeTab !== 'documents' && (
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm animate-fade-in">
                    <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Analysis Engine</span>
                      <button onClick={() => setActiveTab('documents')} className="text-[10px] text-blue-600 font-bold flex items-center gap-1">GO TO DOCUMENT CENTER <ExternalLink className="w-2.5 h-2.5" /></button>
                    </div>
                    <div className="max-h-32 overflow-y-auto divide-y divide-slate-100">
                      {processingQueue.filter(q => q.status === 'pending' || q.status === 'processing' || q.status === 'error').map(item => (
                        <div key={item.id} className="px-4 py-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                             {item.status === 'error' ? <AlertCircle className="w-3 h-3 text-rose-500" /> : <FileText className="w-3 h-3 text-slate-400" />}
                             <span className={`text-xs truncate max-w-[200px] ${item.status === 'error' ? 'text-rose-500 font-bold' : 'text-slate-600'}`}>{item.fileName}</span>
                          </div>
                          {item.status === 'processing' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" /> : <Hourglass className="w-3.5 h-3.5 text-slate-300" />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="lg:col-span-1">
                <RulesEngine rules={rules} categories={categories} onAddRule={r => setRules(prev => [...prev, r])} onRemoveRule={id => setRules(prev => prev.filter(r => r.id !== id))} onApplyRules={() => setTransactions(prev => applyRulesToTransactions(prev, rules))} />
              </div>
            </section>

            <section className="space-y-4 md:space-y-6">
              <div className="overflow-x-auto -mx-4 px-4 pb-2 scrollbar-hide md:overflow-visible md:mx-0 md:px-0 md:pb-0">
                <div className="flex space-x-1 bg-slate-200/50 p-1 rounded-xl w-max md:w-fit shadow-inner print:hidden">
                  {[
                    { id: 'dashboard', label: 'Overview', icon: PieIcon },
                    { id: 'transactions', label: 'Transactions', icon: TableIcon },
                    { id: 'documents', label: 'Documents', icon: FilesIcon, badge: pendingCount > 0 ? pendingCount : null },
                    { id: 'entities', label: 'Profiles', icon: Users },
                    { id: 'pnl', label: 'P&L Statement', icon: FileSpreadsheet },
                    { id: 'balance', label: 'Balance Sheet', icon: Wallet }
                  ].map((tab) => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-4 md:px-6 py-2 rounded-lg text-xs md:text-sm font-medium transition-all capitalize flex items-center whitespace-nowrap relative ${activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                      <tab.icon className="w-3.5 h-3.5 mr-2" />
                      {tab.label}
                      {tab.badge && (
                        <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[8px] font-black h-4 w-4 rounded-full flex items-center justify-center border-2 border-slate-50">
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              
              {activeTab !== 'entities' && activeTab !== 'documents' && (
                <div className="print:hidden">
                  <FilterBar filters={filters} categories={categories} onFilterChange={setFilters} onClear={() => setFilters({ startDate: '', endDate: '', category: '', minAmount: '', maxAmount: '', search: '' })} onOpenCategoryManager={() => setIsCategoryManagerOpen(true)} />
                </div>
              )}

              <div className="min-h-[400px]">
                {activeTab === 'dashboard' && <Dashboard transactions={filteredTransactions} />}
                {activeTab === 'transactions' && <TransactionTable transactions={filteredTransactions} categories={categories} onUpdateTransaction={updated => setTransactions(prev => prev.map(t => t.id === updated.id ? updated : t))} onDeleteTransaction={id => setTransactions(prev => prev.filter(t => t.id !== id))} />}
                {activeTab === 'entities' && <EntityProfiles transactions={transactions} profiles={profiles} onAddProfile={p => setProfiles(prev => [...prev, p])} onUpdateProfile={p => setProfiles(prev => prev.map(old => old.id === p.id ? p : old))} onDeleteProfile={id => setProfiles(prev => prev.filter(p => p.id !== id))} />}
                {activeTab === 'pnl' && <ProfitLossStatement transactions={filteredTransactions} />}
                {activeTab === 'balance' && <BalanceSheet transactions={filteredTransactions} adjustments={bsAdjustments} overrides={bsOverrides} onAddAdjustment={adj => setBsAdjustments(prev => [...prev, adj])} onRemoveAdjustment={id => setBsAdjustments(prev => prev.filter(a => a.id !== id))} onOverride={(cat, amount) => setBsOverrides(prev => ({...prev, [cat]: amount}))} />}
                
                {activeTab === 'documents' && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                      <div className="px-6 py-4 border-b border-slate-200 flex flex-col md:flex-row md:justify-between md:items-center gap-4 bg-slate-50/50">
                        <div>
                          <h3 className="text-lg font-bold text-slate-800">Document Archive</h3>
                          <p className="text-xs text-slate-500">Manage and trigger analysis for source files</p>
                        </div>
                        <div className="flex items-center gap-2">
                           <button 
                             onClick={() => setIsAutoProcessing(prev => !prev)} 
                             className={`text-[10px] font-black px-3 py-1.5 rounded-lg transition uppercase tracking-tighter flex items-center gap-2 ${isAutoProcessing ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}
                           >
                             {isAutoProcessing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                             {isAutoProcessing ? 'Auto-Process On' : 'Auto-Process Off'}
                           </button>
                           {pendingCount > 0 && !isAutoProcessing && (
                             <button onClick={() => setIsAutoProcessing(true)} className="bg-slate-900 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-800 transition flex items-center gap-2">
                               <Play className="w-3 h-3" /> Process All Pending
                             </button>
                           )}
                           <button onClick={() => setProcessingQueue(prev => prev.filter(p => p.status === 'error' || p.status === 'cancelled'))} className="text-[10px] font-black text-rose-500 bg-rose-50 px-3 py-1.5 rounded-lg hover:bg-rose-100 transition uppercase tracking-tighter">Clear Issues</button>
                           <button onClick={() => setProcessingQueue([])} className="text-[10px] font-black text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition uppercase tracking-tighter">Reset All</button>
                        </div>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {processingQueue.length === 0 ? (
                          <div className="p-20 text-center flex flex-col items-center">
                            <FilesIcon className="w-12 h-12 text-slate-100 mb-4" />
                            <p className="text-slate-400 font-medium">Archive is empty.</p>
                            <button onClick={() => document.getElementById('archive-upload')?.click()} className="mt-4 text-blue-600 font-bold text-sm">Upload first document</button>
                            <input id="archive-upload" type="file" multiple className="hidden" onChange={handleFileUpload} />
                          </div>
                        ) : (
                          processingQueue.map(doc => (
                            <div key={doc.id} className="p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 transition border-l-4 border-transparent hover:border-blue-400">
                              <div className="flex items-start gap-4 flex-1">
                                <div className={`p-3 rounded-xl flex-shrink-0 ${doc.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : doc.status === 'error' ? 'bg-rose-50 text-rose-600' : doc.status === 'cancelled' ? 'bg-slate-100 text-slate-500' : 'bg-blue-50 text-blue-600'}`}>
                                  {doc.status === 'processing' ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-bold text-slate-800 truncate">{doc.fileName}</h4>
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter border ${doc.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : doc.status === 'error' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                      {doc.status}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-4 mt-1.5">
                                    <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1"><CheckCircle className="w-3 h-3 text-emerald-400" /> {doc.transactionCount || 0} Extracted</span>
                                    {doc.message && <span className="text-[10px] text-rose-400 font-medium italic flex items-center gap-1 max-w-xs truncate" title={doc.message}><AlertCircle className="w-3 h-3" /> {doc.message}</span>}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 pl-14 md:pl-0">
                                <button onClick={() => setPreviewDoc(doc)} className="px-3 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-sm flex items-center gap-2">
                                  <Eye className="w-3.5 h-3.5" /> Preview
                                </button>
                                {doc.status === 'processing' ? (
                                  <button onClick={() => cancelProcessing(doc.id)} className="px-3 py-2 text-xs font-bold text-rose-500 hover:bg-rose-50 rounded-lg transition">Cancel</button>
                                ) : (
                                  <button 
                                    onClick={() => startAnalysis(doc.id)} 
                                    className={`px-4 py-2 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${doc.status === 'error' ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                                  >
                                    <Play className="w-3.5 h-3.5" /> 
                                    {doc.status === 'completed' ? 'Re-run Analysis' : 'Start Analysis'}
                                  </button>
                                )}
                                <button onClick={() => removeFromQueue(doc.id)} className="p-2 text-slate-300 hover:text-rose-500 transition"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
