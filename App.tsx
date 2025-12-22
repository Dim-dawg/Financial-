import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  UploadCloud, FileText, Loader2, 
  Table as TableIcon, Database, PieChart as PieIcon, 
  FileSpreadsheet, Users, Key, X, Trash2,
  Files as FilesIcon, Wallet, Shield
} from 'lucide-react';
import { 
  Transaction, 
  ProcessingStatus, 
  CategorizationRule, 
  TransactionType,
  TransactionFilter,
  BalanceSheetAdjustment,
  EntityProfile,
  DEFAULT_CATEGORIES
} from './types';
import { parseDocumentWithGemini, readFileAsBase64 } from './services/geminiService';
import * as db from './services/supabaseService';
import Dashboard from './components/Dashboard';
import TransactionTable from './components/TransactionTable';
import RulesEngine from './components/RulesEngine';
import CategoryManager from './components/CategoryManager';
import EntityProfiles from './components/EntityProfiles';
import { ProfitLossStatement, BalanceSheet } from './components/FinancialStatements';

function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [processingQueue, setProcessingQueue] = useState<ProcessingStatus[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'entities' | 'pnl' | 'balance' | 'documents'>('dashboard');
  const [isAutoProcessing, setIsAutoProcessing] = useState(true);
  
  const isProcessingRef = useRef(false);

  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [rules, setRules] = useState<CategorizationRule[]>([]);
  const [profiles, setProfiles] = useState<EntityProfile[]>([]);
  const [bsAdjustments, setBsAdjustments] = useState<BalanceSheetAdjustment[]>([]);
  const [bsOverrides, setBsOverrides] = useState<Record<string, number>>({});

  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [filters, setFilters] = useState<TransactionFilter>({
    startDate: '', endDate: '', category: '', minAmount: '', maxAmount: '', search: ''
  });

  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [sbUrl, setSbUrl] = useState(localStorage.getItem('cf_supabase_url') || '');
  const [sbKey, setSbKey] = useState(localStorage.getItem('cf_supabase_key') || '');

  useEffect(() => {
    const initData = async () => {
      if (db.isSupabaseConfigured()) {
        try {
          const [txs, rls, profs, cats] = await Promise.all([
            db.getTransactions(),
            db.getRules(),
            db.getProfiles(),
            db.getCategories()
          ]);
          setTransactions(txs);
          setRules(rls);
          setProfiles(profs);
          if (cats.length > 0) setCategories(cats);
        } catch (err) {
          console.error("Failed to load Supabase data", err);
        }
      }
      setIsInitialized(true);
    };
    initData();
  }, []);

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
        const taggedTxs = applyRulesToTransactions(extracted, rules).map(t => ({ ...t, documentId: nextItem.id }));
        
        if (db.isSupabaseConfigured()) {
          await db.upsertTransactions(taggedTxs);
          const refreshedTxs = await db.getTransactions();
          setTransactions(refreshedTxs);
        } else {
          setTransactions(prev => [...prev, ...taggedTxs]);
        }

        setProcessingQueue(prev => prev.map(item => item.id === nextItem.id ? { ...item, status: 'completed', transactionCount: taggedTxs.length } : item));
      } catch (error: any) {
        setProcessingQueue(prev => prev.map(item => item.id === nextItem.id ? { ...item, status: 'error', message: error.message } : item));
      } finally {
        isProcessingRef.current = false;
      }
    };

    processNext();
  }, [processingQueue, rules, isAutoProcessing]);

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
    setIsAutoProcessing(true);
    event.target.value = '';
  };

  const applyRulesToTransactions = (txs: Transaction[], currentRules: CategorizationRule[]) => {
    const sorted = [...currentRules].sort((a, b) => b.keyword.length - a.keyword.length);
    return txs.map(t => {
      const match = sorted.find(r => t.description.toLowerCase().includes(r.keyword.toLowerCase()));
      return match ? { ...t, category: match.targetCategory } : t;
    });
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (filters.startDate && t.date < filters.startDate) return false;
      if (filters.endDate && t.date > filters.endDate) return false;
      if (filters.category && t.category !== filters.category) return false;
      if (filters.search && !t.description.toLowerCase().includes(filters.search.toLowerCase())) return false;
      return true;
    });
  }, [transactions, filters]);

  const handleUpdateTransaction = async (updated: Transaction) => {
    setTransactions(prev => prev.map(t => t.id === updated.id ? updated : t));
    if (db.isSupabaseConfigured()) await db.upsertTransactions([updated]);
  };

  const handleDeleteTransaction = async (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    if (db.isSupabaseConfigured()) await db.deleteTransaction(id);
  };

  const handleAddRule = async (rule: CategorizationRule) => {
    setRules(prev => [...prev, rule]);
    if (db.isSupabaseConfigured()) await db.upsertRule(rule);
  };

  const handleRemoveRule = async (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
    if (db.isSupabaseConfigured()) await db.deleteRule(id);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 relative">
      <CategoryManager isOpen={isCategoryManagerOpen} onClose={() => setIsCategoryManagerOpen(false)} categories={categories} onAdd={c => setCategories(prev => [...prev, c].sort())} onRename={(o, n) => setCategories(prev => prev.map(c => c === o ? n : c).sort())} onDelete={c => setCategories(prev => prev.filter(cat => cat !== c))} />
      
      {isConnectModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md animate-scale-up shadow-2xl">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-xl font-bold flex items-center gap-3"><Shield className="w-6 h-6 text-indigo-600" /> Supabase Connection</h3>
              <button onClick={() => setIsConnectModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-full"><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Project URL</label>
                <input type="text" className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-100" placeholder="https://xyz.supabase.co" value={sbUrl} onChange={e => setSbUrl(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Anon Public Key</label>
                <input type="password" className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-100" placeholder="eyJhbGc..." value={sbKey} onChange={e => setSbKey(e.target.value)} />
              </div>
            </div>
            <button 
              onClick={() => db.saveConfig(sbUrl, sbKey)}
              className="mt-8 w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100"
            >
              Connect & Refresh
            </button>
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
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-tighter transition ${db.isSupabaseConfigured() ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}
            >
              <Database className="w-3.5 h-3.5" />
              {db.isSupabaseConfigured() ? 'Supabase Linked' : 'Link Supabase'}
            </button>
          </div>
          <div className="flex items-center space-x-2">
             <button onClick={() => window.aistudio.openSelectKey()} className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition" title="API Settings"><Key className="w-4 h-4" /></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 md:py-8 space-y-6">
        {!isInitialized ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400"><Loader2 className="w-10 h-10 animate-spin mb-4" /><p>Connecting...</p></div>
        ) : (
          <>
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
              <div className="lg:col-span-2">
                <div className="bg-white p-6 md:p-8 rounded-2xl border-2 border-slate-200 border-dashed hover:border-blue-400 transition cursor-pointer relative group h-full flex flex-col items-center justify-center">
                  <input type="file" multiple onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-full mb-3 group-hover:bg-blue-100 transition"><UploadCloud className="w-6 h-6" /></div>
                  <h3 className="text-base font-semibold text-slate-700">Import Statements</h3>
                  <p className="text-slate-500 text-xs">PDF or Images &rarr; Supabase DB</p>
                </div>
              </div>
              <div className="lg:col-span-1">
                <RulesEngine rules={rules} categories={categories} onAddRule={handleAddRule} onRemoveRule={handleRemoveRule} onApplyRules={() => {}} />
              </div>
            </section>

            <div className="flex space-x-1 bg-slate-200/50 p-1 rounded-xl w-fit shadow-inner print:hidden overflow-x-auto">
              {[
                { id: 'dashboard', label: 'Overview', icon: PieIcon },
                { id: 'transactions', label: 'Transactions', icon: TableIcon },
                { id: 'entities', label: 'Profiles', icon: Users },
                { id: 'documents', label: 'Queue', icon: FilesIcon },
                { id: 'pnl', label: 'P&L', icon: FileSpreadsheet },
                { id: 'balance', label: 'Balance', icon: Wallet }
              ].map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-4 py-2 rounded-lg text-xs font-medium transition-all capitalize flex items-center whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  <tab.icon className="w-3.5 h-3.5 mr-2" />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="min-h-[400px]">
              {activeTab === 'dashboard' && <Dashboard transactions={filteredTransactions} />}
              {activeTab === 'transactions' && <TransactionTable transactions={filteredTransactions} categories={categories} onUpdateTransaction={handleUpdateTransaction} onDeleteTransaction={handleDeleteTransaction} />}
              {activeTab === 'entities' && <EntityProfiles transactions={transactions} profiles={profiles} onAddProfile={async p => { setProfiles(prev => [...prev, p]); if(db.isSupabaseConfigured()) await db.upsertProfile(p); }} onUpdateProfile={async p => { setProfiles(prev => prev.map(o => o.id === p.id ? p : o)); if(db.isSupabaseConfigured()) await db.upsertProfile(p); }} onDeleteProfile={async id => { setProfiles(prev => prev.filter(p => p.id !== id)); if(db.isSupabaseConfigured()) await db.deleteProfile(id); }} />}
              {activeTab === 'pnl' && <ProfitLossStatement transactions={filteredTransactions} />}
              {activeTab === 'balance' && <BalanceSheet transactions={filteredTransactions} adjustments={bsAdjustments} overrides={bsOverrides} onAddAdjustment={adj => setBsAdjustments(prev => [...prev, adj])} onRemoveAdjustment={id => setBsAdjustments(prev => prev.filter(a => a.id !== id))} onOverride={(cat, amount) => setBsOverrides(prev => ({...prev, [cat]: amount}))} />}
              
              {activeTab === 'documents' && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="text-sm font-bold">Processing Queue</h3>
                    <button onClick={() => setProcessingQueue([])} className="text-[10px] font-black text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg hover:bg-slate-200">Clear All</button>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {processingQueue.length === 0 ? (
                      <div className="p-20 text-center text-slate-400 text-xs italic">Queue is empty.</div>
                    ) : (
                      processingQueue.map(doc => (
                        <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${doc.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                               <FileText className="w-4 h-4" />
                            </div>
                            <div>
                               <p className="text-sm font-bold text-slate-800">{doc.fileName}</p>
                               <p className="text-[10px] text-slate-400 uppercase font-black">{doc.status}</p>
                            </div>
                          </div>
                          {doc.status === 'processing' && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;