import React, { useState, useMemo, useRef } from 'react';
import { ProfitLossStatement, BalanceSheet } from './FinancialStatements';
import { Transaction, BalanceSheetAdjustment, TransactionType, Category, TransactionFilter } from '../types';
import { generateFinancialNarrative } from '../services/geminiService';
import { FileBadge, Printer, Sparkles, Loader2, ShieldCheck, CheckCircle2, Landmark, Edit2, Calendar, Download } from 'lucide-react';

interface FinancialReportProps {
  view: 'pnl' | 'balance_sheet';
  transactions: Transaction[];
  categories?: Category[];
  filters: TransactionFilter;
  businessName: string;
  onUpdateBusinessName: (name: string) => void;
  bsAdjustments: BalanceSheetAdjustment[];
  bsOverrides: Record<string, number>;
  onAddAdjustment: (adj: BalanceSheetAdjustment) => void;
  onRemoveAdjustment: (id: string) => void;
  onOverride: (cat: string, val: number | undefined) => void;
}

const FinancialReport: React.FC<FinancialReportProps> = ({
  view,
  transactions,
  categories = [],
  filters,
  businessName,
  onUpdateBusinessName,
  bsAdjustments,
  bsOverrides,
  onAddAdjustment,
  onRemoveAdjustment,
  onOverride
}) => {
  const [narrative, setNarrative] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(businessName);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const reportRef = useRef<HTMLDivElement>(null);

  // Filter Logic specific to report type
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // String comparison for dates (YYYY-MM-DD) is safer and avoids timezone dropping
      if (view === 'pnl') {
        if (filters.startDate && t.date < filters.startDate) return false;
        if (filters.endDate && t.date > filters.endDate) return false;
      } else {
        // Balance Sheet: As of End Date
        if (filters.endDate && t.date > filters.endDate) return false;
      }
      return true;
    });
  }, [transactions, filters, view]);

  const summaryData = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    const expenseCats: Record<string, number> = {};

    filteredTransactions.forEach(t => {
      if (t.type === TransactionType.INCOME) {
        totalIncome += t.amount;
      } else {
        totalExpense += t.amount;
        expenseCats[t.category] = (expenseCats[t.category] || 0) + t.amount;
      }
    });

    const topExpenses = Object.entries(expenseCats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([cat]) => cat);

    return { totalIncome, totalExpense, netProfit: totalIncome - totalExpense, topExpenses };
  }, [filteredTransactions]);

  const handleGenerateNarrative = async () => {
    setIsGenerating(true);
    try {
      const text = await generateFinancialNarrative(summaryData);
      setNarrative(text);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNameSave = () => {
    if (tempName.trim()) {
      onUpdateBusinessName(tempName);
    }
    setIsEditingName(false);
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    
    // Set loading state immediately to show UI feedback
    setIsDownloading(true);

    // Defer the heavy PDF generation to the next tick to allow the UI (spinner) to update first
    setTimeout(async () => {
      try {
        const element = reportRef.current;
        // @ts-ignore
        if (typeof window.html2pdf !== 'undefined') {
            const opt = {
              margin: 0.5,
              filename: `${businessName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${view}.pdf`,
              image: { type: 'jpeg', quality: 0.98 },
              // Optimized scale to 1.5 (down from 2) for significantly faster generation while maintaining readability
              html2canvas: { scale: 1.5, useCORS: true, logging: false },
              jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
            };
            // @ts-ignore
            await window.html2pdf().from(element).set(opt).save();
        } else {
            window.print();
        }
      } catch (e) {
        console.error("PDF Generation failed", e);
      } finally {
        setIsDownloading(false);
      }
    }, 100);
  };

  const activeDateRange = useMemo(() => {
    if (filters.startDate && filters.endDate) return `${filters.startDate} to ${filters.endDate}`;
    if (filters.startDate) return `Since ${filters.startDate}`;
    if (filters.endDate) return `Up to ${filters.endDate}`;
    return 'All Time';
  }, [filters]);

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-24 print:pb-0 print:space-y-0">
      
      {/* Interactive Report Header */}
      <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm print:hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex-1">
             <div className="flex items-center gap-3 mb-2">
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <input 
                      autoFocus
                      className="text-2xl font-black uppercase tracking-tighter text-slate-900 border-b-2 border-indigo-500 focus:outline-none bg-transparent w-full md:w-96"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      onBlur={handleNameSave}
                      onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
                    />
                    <button onClick={handleNameSave} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><CheckCircle2 size={16} /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 group cursor-pointer" onClick={() => { setTempName(businessName); setIsEditingName(true); }}>
                    <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-slate-900 border-b-2 border-transparent hover:border-indigo-200 transition-all">{businessName}</h1>
                    <button className="p-2 bg-slate-50 text-slate-300 rounded-lg group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                        <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
             </div>
             <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest">
                <Calendar className="w-3.5 h-3.5" />
                <span>Period: <span className="text-slate-600">{activeDateRange}</span></span>
             </div>
          </div>

          <div className="flex flex-wrap gap-3">
             {view === 'pnl' && (
                <button 
                  onClick={handleGenerateNarrative}
                  disabled={isGenerating || filteredTransactions.length === 0}
                  className="flex items-center px-5 py-3 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-100 transition active:scale-95 border border-indigo-100"
                >
                  {isGenerating ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-2" />}
                  Generate AI Memo
                </button>
             )}
             <button 
                onClick={handleDownloadPDF}
                disabled={isDownloading}
                className="flex items-center px-5 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition active:scale-95 shadow-lg shadow-slate-200"
             >
               {isDownloading ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-2" />}
               PDF
             </button>
          </div>
        </div>
      </div>

      {/* Printable Report Area */}
      <div ref={reportRef} className="bg-white print:bg-white">
        {view === 'pnl' ? (
          <ProfitLossStatement 
            transactions={filteredTransactions}
            categories={categories}
            businessName={businessName}
            dateRange={activeDateRange}
          />
        ) : (
          <BalanceSheet 
            transactions={filteredTransactions}
            categories={categories}
            adjustments={bsAdjustments}
            overrides={bsOverrides}
            onAddAdjustment={onAddAdjustment}
            onRemoveAdjustment={onRemoveAdjustment}
            onOverride={onOverride}
            businessName={businessName}
            dateRange={activeDateRange}
          />
        )}
      </div>
    </div>
  );
};

export default FinancialReport;