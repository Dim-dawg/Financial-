
import React, { useMemo, useState, useEffect } from 'react';
import { Transaction, TransactionType, BalanceSheetAdjustment } from '../types';
import { Printer, Calendar, Landmark, ShieldCheck } from 'lucide-react';

interface FinancialStatementsProps {
  transactions: Transaction[];
}

interface BalanceSheetProps extends FinancialStatementsProps {
  adjustments: BalanceSheetAdjustment[];
  overrides?: Record<string, number>;
  onAddAdjustment: (adj: BalanceSheetAdjustment) => void;
  onRemoveAdjustment: (id: string) => void;
  onOverride?: (category: string, amount: number | undefined) => void;
}

const FIXED_ASSET_KEYWORDS = ['equipment', 'computer', 'furniture', 'vehicle', 'property', 'machinery', 'building', 'improvement'];
const LONG_TERM_LIAB_KEYWORDS = ['loan', 'mortgage', 'note payable', 'financing', 'term loan'];

const getAccountGroup = (category: string, type: 'ASSET' | 'LIABILITY'): string => {
  const lowerCat = category.toLowerCase();
  if (type === 'ASSET') {
    return FIXED_ASSET_KEYWORDS.some(k => lowerCat.includes(k)) ? 'Fixed Assets' : 'Current Assets';
  } else {
    return LONG_TERM_LIAB_KEYWORDS.some(k => lowerCat.includes(k)) ? 'Long-Term Liabilities' : 'Current Liabilities';
  }
};

const StatementHeader: React.FC<{ title: string; subtitle?: string }> = ({ title }) => {
  const [businessName, setBusinessName] = useState(() => localStorage.getItem('cf_biz_name') || 'Your Business Name');
  const [period, setPeriod] = useState(() => localStorage.getItem('cf_period') || 'For the Period Ended');

  useEffect(() => localStorage.setItem('cf_biz_name', businessName), [businessName]);
  useEffect(() => localStorage.setItem('cf_period', period), [period]);

  return (
    <div className="text-center mb-12 border-b-4 border-slate-900 pb-8">
      <input 
        value={businessName} 
        onChange={e => setBusinessName(e.target.value)}
        className="text-4xl font-black uppercase tracking-tighter text-slate-900 mb-1 text-center w-full bg-transparent border-none focus:ring-0"
        placeholder="LEGAL BUSINESS NAME"
      />
      <h1 className="text-xl font-bold text-slate-600 uppercase tracking-widest mb-4">{title}</h1>
      <div className="flex flex-col items-center justify-center space-y-1 text-slate-500 text-xs">
        <div className="flex items-center">
          <Calendar className="w-3.5 h-3.5 mr-2 print:hidden" />
          <input 
            value={period} 
            onChange={e => setPeriod(e.target.value)}
            className="text-center bg-transparent border-none focus:ring-0 p-0 text-slate-500 font-medium italic"
            placeholder="Accounting Period"
          />
        </div>
        <p className="font-mono">Export Date: {new Date().toLocaleDateString()}</p>
      </div>
    </div>
  );
};

const MoneyValue: React.FC<{ value: number; isTotal?: boolean; isGrandTotal?: boolean; negativeRed?: boolean }> = ({ 
  value, isTotal, isGrandTotal, negativeRed 
}) => {
  const formatted = new Intl.NumberFormat('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  }).format(Math.abs(value));

  return (
    <span className={`font-mono font-bold ${value < 0 && negativeRed ? 'text-rose-600' : 'text-slate-900'} ${isTotal ? 'border-t border-slate-900 pt-0.5' : ''} ${isGrandTotal ? 'border-b-4 border-double border-slate-900 pb-0.5' : ''}`}>
      {value < 0 ? '(' : ''}${formatted}{value < 0 ? ')' : ''}
    </span>
  );
};

export const ProfitLossStatement: React.FC<FinancialStatementsProps> = ({ transactions }) => {
  const data = useMemo(() => {
    const income: Record<string, number> = {};
    const expenses: Record<string, number> = {};
    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach(t => {
      if (t.type === TransactionType.INCOME) {
        income[t.category] = (income[t.category] || 0) + t.amount;
        totalIncome += t.amount;
      } else {
        expenses[t.category] = (expenses[t.category] || 0) + t.amount;
        totalExpense += t.amount;
      }
    });

    return { income, expenses, totalIncome, totalExpense, netProfit: totalIncome - totalExpense };
  }, [transactions]);

  return (
    <div className="max-w-4xl mx-auto space-y-4 animate-fade-in print:m-0 print:max-w-full">
      <div className="bg-white p-8 md:p-16 shadow-2xl border border-slate-200 min-h-[900px] print:shadow-none print:border-none print:p-0">
        <StatementHeader title="Income Statement (Profit & Loss)" />

        <section className="mb-10">
          <h3 className="text-sm font-black text-slate-900 border-b border-slate-200 pb-1 mb-4 uppercase">I. Revenue</h3>
          <div className="space-y-2 pl-4">
            {Object.entries(data.income).map(([cat, amount]) => (
              <div key={cat} className="flex justify-between text-sm">
                <span className="text-slate-600 font-medium">{cat}</span>
                <MoneyValue value={amount as number} />
              </div>
            ))}
            <div className="flex justify-between font-bold pt-4 text-slate-900 border-t border-slate-100">
              <span className="uppercase text-xs tracking-wider">Total Gross Revenue</span>
              <MoneyValue value={data.totalIncome} isTotal />
            </div>
          </div>
        </section>

        <section className="mb-10">
          <h3 className="text-sm font-black text-slate-900 border-b border-slate-200 pb-1 mb-4 uppercase">II. Operating Expenses</h3>
          <div className="space-y-2 pl-4">
            {Object.entries(data.expenses).sort(([, a], [, b]) => (b as number) - (a as number)).map(([cat, amount]) => (
              <div key={cat} className="flex justify-between text-sm">
                <span className="text-slate-600">{cat}</span>
                <MoneyValue value={amount as number} />
              </div>
            ))}
            <div className="flex justify-between font-bold pt-4 text-slate-900 border-t border-slate-100">
              <span className="uppercase text-xs tracking-wider">Total Operating Expenses</span>
              <MoneyValue value={data.totalExpense} isTotal />
            </div>
          </div>
        </section>

        <div className="mt-20 flex justify-end">
          <div className="w-full md:w-1/2">
            <div className="flex justify-between items-center py-4 border-t-2 border-slate-900 font-black uppercase italic">
              <span className="text-lg">Net Operating Income</span>
              <div className="text-xl">
                <MoneyValue value={data.netProfit} isGrandTotal negativeRed />
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 text-right">The accompanying notes are an integral part of these financial statements.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export const BalanceSheet: React.FC<BalanceSheetProps> = ({ 
  transactions, 
  adjustments, 
  overrides = {}, 
  onOverride = () => {} 
}) => {
  const data = useMemo(() => {
    let totalCashIn = 0, totalCashOut = 0;
    const assets: Record<string, number> = {};
    const liabilities: Record<string, number> = {};
    let operatingIncome = 0, operatingExpense = 0;

    transactions.forEach(t => {
      if (t.type === TransactionType.INCOME) totalCashIn += t.amount; else totalCashOut += t.amount;
      
      const lowerCat = t.category.toLowerCase();
      const isAsset = FIXED_ASSET_KEYWORDS.some(k => lowerCat.includes(k)) || lowerCat.includes('asset');
      const isLiab = LONG_TERM_LIAB_KEYWORDS.some(k => lowerCat.includes(k)) || lowerCat.includes('liability');

      if (isAsset) {
        assets[t.category] = (assets[t.category] || 0) + (t.type === TransactionType.EXPENSE ? t.amount : -t.amount);
      } else if (isLiab) {
        liabilities[t.category] = (liabilities[t.category] || 0) + (t.type === TransactionType.INCOME ? t.amount : -t.amount);
      } else {
        if (t.type === TransactionType.INCOME) operatingIncome += t.amount; else operatingExpense += t.amount;
      }
    });

    const cashBalance = totalCashIn - totalCashOut;
    const finalCash = overrides['Cash & Equivalents'] !== undefined ? overrides['Cash & Equivalents'] : cashBalance;

    // Groups
    const currentAssets: any[] = [{ name: 'Cash & Equivalents', amount: finalCash }];
    const fixedAssets: any[] = [];
    const currentLiabilities: any[] = [];
    const longTermLiabilities: any[] = [];

    Object.entries(assets).forEach(([name, amount]) => {
      if (getAccountGroup(name, 'ASSET') === 'Fixed Assets') fixedAssets.push({ name, amount });
      else currentAssets.push({ name, amount });
    });

    Object.entries(liabilities).forEach(([name, amount]) => {
      if (getAccountGroup(name, 'LIABILITY') === 'Long-Term Liabilities') longTermLiabilities.push({ name, amount });
      else currentLiabilities.push({ name, amount });
    });

    // Manual Adjustments
    adjustments.forEach(adj => {
      if (adj.type === 'ASSET') currentAssets.push({ name: adj.name, amount: adj.amount });
      else longTermLiabilities.push({ name: adj.name, amount: adj.amount });
    });

    const totalAssets = [...currentAssets, ...fixedAssets].reduce((s, a) => s + a.amount, 0);
    const totalLiab = [...currentLiabilities, ...longTermLiabilities].reduce((s, l) => s + l.amount, 0);
    const retainedEarnings = operatingIncome - operatingExpense;

    return { 
      currentAssets, fixedAssets, currentLiabilities, longTermLiabilities,
      retainedEarnings, totalAssets, totalLiab, 
      totalEquity: retainedEarnings,
      totalLiabAndEquity: totalLiab + retainedEarnings
    };
  }, [transactions, adjustments, overrides]);

  return (
    <div className="max-w-4xl mx-auto animate-fade-in print:m-0 print:max-w-full">
      <div className="bg-white p-8 md:p-16 shadow-2xl border border-slate-200 min-h-[900px] text-slate-900 print:shadow-none print:border-none print:p-0">
        <StatementHeader title="Statement of Financial Position (Balance Sheet)" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
          {/* Left Column: Assets */}
          <div>
            <h3 className="text-base font-black border-b-2 border-slate-900 pb-1 mb-6 uppercase">Assets</h3>
            
            <div className="mb-8">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 italic">Current Assets</h4>
              <div className="space-y-2 pl-4">
                {data.currentAssets.map((a, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-slate-600">{a.name}</span>
                    <MoneyValue value={a.amount} />
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-8">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 italic">Fixed Assets</h4>
              <div className="space-y-2 pl-4">
                {data.fixedAssets.map((a, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-slate-600">{a.name}</span>
                    <MoneyValue value={a.amount} />
                  </div>
                ))}
                {data.fixedAssets.length === 0 && <p className="text-[10px] text-slate-300 italic">No fixed assets reported.</p>}
              </div>
            </div>

            <div className="mt-12 flex justify-between font-black uppercase text-sm border-t-2 border-slate-900 pt-2">
              <span>Total Assets</span>
              <MoneyValue value={data.totalAssets} isGrandTotal />
            </div>
          </div>

          {/* Right Column: Liabilities & Equity */}
          <div>
            <h3 className="text-base font-black border-b-2 border-slate-900 pb-1 mb-6 uppercase">Liabilities & Equity</h3>
            
            <div className="mb-8">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 italic">Current Liabilities</h4>
              <div className="space-y-2 pl-4">
                {data.currentLiabilities.map((l, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-slate-600">{l.name}</span>
                    <MoneyValue value={l.amount} />
                  </div>
                ))}
                {data.currentLiabilities.length === 0 && <p className="text-[10px] text-slate-300 italic">No current liabilities reported.</p>}
              </div>
            </div>

            <div className="mb-8">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 italic">Long-Term Debt</h4>
              <div className="space-y-2 pl-4">
                {data.longTermLiabilities.map((l, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-slate-600">{l.name}</span>
                    <MoneyValue value={l.amount} />
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-8">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 italic">Shareholder's Equity</h4>
              <div className="space-y-2 pl-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 font-medium italic">Net Retained Earnings</span>
                  <MoneyValue value={data.retainedEarnings} />
                </div>
              </div>
            </div>

            <div className="mt-12 flex justify-between font-black uppercase text-sm border-t-2 border-slate-900 pt-2">
              <span>Total Liab. & Equity</span>
              <MoneyValue value={data.totalLiabAndEquity} isGrandTotal />
            </div>
          </div>
        </div>

        <div className="mt-24 grid grid-cols-2 gap-20 print:mt-32">
          <div className="border-t border-slate-300 pt-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Prepared By</p>
            <p className="text-sm font-bold mt-4 flex items-center gap-2 text-slate-800">
               <ShieldCheck className="w-4 h-4 text-emerald-500" />
               Cipher Finance AI Core
            </p>
          </div>
          <div className="border-t border-slate-300 pt-2 text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Authorized Signature</p>
            <div className="h-10"></div>
          </div>
        </div>
      </div>
    </div>
  );
};
