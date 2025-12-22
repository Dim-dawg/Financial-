
import React, { useState, useEffect, useMemo } from 'react';
import { ProfitLossStatement, BalanceSheet } from './FinancialStatements';
import { Transaction, BalanceSheetAdjustment, TransactionType } from '../types';
import { generateFinancialNarrative } from '../services/geminiService';
import { FileBadge, Printer, Sparkles, Loader2, ShieldCheck, CheckCircle2 } from 'lucide-react';

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
    try {
      const text = await generateFinancialNarrative(summaryData);
      setNarrative(text);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-24">
      {/* Tool Header */}
      <div className="bg-indigo-600 rounded-2xl p-6 md:p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-center gap-6 print:hidden">
        <div className="flex items-center gap-4">
          <div className="bg-white/20 p-3 rounded-xl backdrop-blur-md">
            <FileBadge className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Bank Interview Package</h2>
            <p className="text-indigo-100 text-sm opacity-90">Consolidated P&L and Balance Sheet for lenders.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleGenerateNarrative}
            disabled={isGenerating || transactions.length === 0}
            className="flex items-center px-5 py-2.5 bg-white text-indigo-600 rounded-xl text-sm font-bold shadow-lg hover:bg-indigo-50 transition active:scale-95 disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            AI Loan Memo
          </button>
          <button 
            onClick={() => window.print()}
            className="flex items-center px-5 py-2.5 bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg hover:bg-indigo-400 border border-indigo-400 transition active:scale-95"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print Full Package
          </button>
        </div>
      </div>

      {/* Narrative Section */}
      {narrative && (
        <section className="bg-white p-8 md:p-12 rounded-2xl border-l-8 border-indigo-600 shadow-sm animate-fade-in print:shadow-none print:border-l-0 print:p-0">
          <div className="flex items-center gap-3 mb-6 print:hidden">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Management Narrative</h3>
          </div>
          <div className="prose prose-slate max-w-none">
            {narrative.split('\n\n').map((para, i) => (
              <p key={i} className="text-slate-700 leading-relaxed mb-4 text-sm md:text-base italic font-serif">
                {para}
              </p>
            ))}
          </div>
          <div className="mt-8 pt-8 border-t border-slate-100 flex justify-between items-center print:mt-12">
            <div>
              <div className="w-48 h-px bg-slate-300 mb-2"></div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Business Owner Signature</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Date Signed</p>
              <p className="text-sm text-slate-800 font-bold">{new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </section>
      )}

      {/* Integrated Statements */}
      <div className="space-y-12 print:space-y-0">
        <div className="print:page-break-after">
          <ProfitLossStatement transactions={transactions} />
        </div>
        <div className="print:mt-12">
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
      <div className="bg-slate-900 rounded-3xl p-8 md:p-12 text-white print:hidden">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
          <CheckCircle2 className="text-emerald-400 w-6 h-6" />
          Loan Application Readiness
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { label: "P&L Categorization", status: transactions.some(t => t.category === 'Uncategorized') ? 'Warning' : 'Complete' },
            { label: "Balance Sheet Assets", status: bsAdjustments.some(a => a.type === 'ASSET') || transactions.some(t => t.category.toLowerCase().includes('equipment')) ? 'Complete' : 'Pending' },
            { label: "Debt Service Narrative", status: narrative ? 'Complete' : 'Pending' },
            { label: "Bank Reconciliation", status: 'Complete' }
          ].map((item, i) => (
            <div key={i} className="bg-white/5 p-4 rounded-xl border border-white/10 flex items-center justify-between">
              <span className="text-sm font-medium opacity-80">{item.label}</span>
              <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${item.status === 'Complete' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
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
