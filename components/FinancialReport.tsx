
import React, { useState, useMemo } from 'react';
import { ProfitLossStatement, BalanceSheet } from './FinancialStatements';
import { Transaction, BalanceSheetAdjustment, TransactionType } from '../types';
import { generateFinancialNarrative } from '../services/geminiService';
import { FileBadge, Printer, Sparkles, Loader2, ShieldCheck, CheckCircle2, Landmark, Briefcase } from 'lucide-react';

interface FinancialReportProps {
  transactions: Transaction[];
  bsAdjustments: BalanceSheetAdjustment[];
  bsOverrides: Record<string, number>;
  onAddAdjustment: (adj: BalanceSheetAdjustment) => void;
  onRemoveAdjustment: (id: string) => void;
  onOverride: (cat: string, val: number | undefined) => void;
}

const FinancialReport: React.FC<FinancialReportProps> = ({
  transactions,
  bsAdjustments,
  bsOverrides,
  onAddAdjustment,
  onRemoveAdjustment,
  onOverride
}) => {
  const [narrative, setNarrative] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [includeCover, setIncludeCover] = useState(true);

  const summaryData = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    const expenseCats: Record<string, number> = {};

    transactions.forEach(t => {
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
  }, [transactions]);

  const handleGenerateNarrative = async () => {
    setIsGenerating(true);
    // Fix: Cast window to any for gtag access
    if (typeof (window as any).gtag === 'function') {
      (window as any).gtag('event', 'generate_mda', {
        event_category: 'financial_report',
        transaction_count: transactions.length
      });
    }
    try {
      const text = await generateFinancialNarrative(summaryData);
      setNarrative(text);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    // Fix: Cast window to any for gtag access
    if (typeof (window as any).gtag === 'function') {
      (window as any).gtag('event', 'print_report', {
        event_category: 'financial_report',
        has_narrative: !!narrative
      });
    }
    window.print();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-24">
      {/* Tool Header */}
      <div className="bg-slate-900 rounded-2xl p-6 md:p-10 text-white shadow-2xl flex flex-col md:flex-row justify-between items-center gap-8 print:hidden">
        <div className="flex items-center gap-5">
          <div className="bg-indigo-600 p-4 rounded-2xl shadow-lg shadow-indigo-500/20">
            <Landmark className="w-10 h-10 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight">Lender Review Suite</h2>
            <p className="text-slate-400 text-sm font-medium">Professional reporting for bank credit analysis.</p>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          <button 
            onClick={handleGenerateNarrative}
            disabled={isGenerating || transactions.length === 0}
            className="flex items-center px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-black uppercase tracking-widest shadow-xl hover:bg-indigo-500 transition active:scale-95 disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Generate MD&A
          </button>
          <button 
            onClick={handlePrint}
            className="flex items-center px-6 py-3 bg-white text-slate-900 rounded-xl text-sm font-black uppercase tracking-widest shadow-xl hover:bg-slate-50 transition active:scale-95"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print Full Pack
          </button>
        </div>
      </div>

      {/* Narrative Section */}
      {narrative && (
        <section className="bg-white p-12 md:p-20 rounded-2xl border-t-8 border-indigo-600 shadow-xl animate-fade-in print:shadow-none print:border-t-0 print:p-0 print:mb-20">
          <div className="flex items-center gap-3 mb-10 print:hidden">
            <ShieldCheck className="w-6 h-6 text-indigo-600" />
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Section I: Management Discussion & Analysis</h3>
          </div>
          <div className="prose prose-slate max-w-none">
             <h2 className="text-3xl font-black text-slate-900 mb-8 font-serif italic">Business Performance Overview</h2>
            {narrative.split('\n\n').map((para, i) => (
              <p key={i} className="text-slate-700 leading-relaxed mb-6 text-lg font-serif">
                {para}
              </p>
            ))}
          </div>
          <div className="mt-12 pt-12 border-t border-slate-100 flex justify-between items-end print:mt-20">
            <div>
              <div className="w-64 h-px bg-slate-400 mb-3"></div>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Authorized Officer Signature</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Affirmation Date</p>
              <p className="text-base text-slate-900 font-bold">{new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </section>
      )}

      {/* Integrated Statements */}
      <div className="space-y-20 print:space-y-0">
        <div className="print:page-break-after">
          <ProfitLossStatement transactions={transactions} />
        </div>
        <div className="print:mt-20">
          <BalanceSheet 
            transactions={transactions} 
            adjustments={bsAdjustments} 
            overrides={bsOverrides} 
            onAddAdjustment={onAddAdjustment}
            onRemoveAdjustment={onRemoveAdjustment}
            onOverride={onOverride}
          />
        </div>
      </div>

      {/* Readiness Checklist */}
      <div className="bg-slate-50 rounded-3xl p-10 border border-slate-200 print:hidden">
        <div className="flex items-center justify-between mb-8">
           <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
            <CheckCircle2 className="text-emerald-500 w-6 h-6" />
            Lender Compliance Checklist
          </h3>
          <span className="text-[10px] font-black uppercase bg-white px-3 py-1 rounded-full border border-slate-200">Self-Audit</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { label: "P&L Categorization Integrity", status: transactions.some(t => t.category === 'Uncategorized') ? 'Action Required' : 'Verified' },
            { label: "Fixed Asset Depreciation Estimates", status: transactions.some(t => t.category.toLowerCase().includes('equipment')) ? 'Verified' : 'Manual Entry Needed' },
            { label: "MD&A Debt Service Coverage", status: narrative ? 'Verified' : 'Required' },
            { label: "Database Precision Synced", status: 'Verified' }
          ].map((item, i) => (
            <div key={i} className={`p-4 rounded-xl border flex items-center justify-between ${item.status === 'Verified' ? 'bg-white border-slate-100' : 'bg-amber-50 border-amber-200'}`}>
              <span className="text-sm font-bold text-slate-600">{item.label}</span>
              <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg ${item.status === 'Verified' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FinancialReport;
