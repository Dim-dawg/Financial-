
import React, { useMemo, useState, useEffect } from 'react';
import { Transaction, TransactionType, BalanceSheetAdjustment } from '../types';
import { Printer, Info, Plus, Trash2, Edit2, RotateCcw, Building2, Calendar } from 'lucide-react';

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

const ASSET_KEYWORDS = ['equipment', 'computer', 'furniture', 'vehicle', 'property', 'inventory', 'asset', 'machinery', 'building'];
const LIABILITY_KEYWORDS = ['loan', 'principal', 'mortgage', 'liability', 'credit line', 'financing'];

const getAccountType = (category: string): 'ASSET' | 'LIABILITY' | 'OPERATING' => {
  const lowerCat = category.toLowerCase();
  if (ASSET_KEYWORDS.some(k => lowerCat.includes(k))) return 'ASSET';
  if (LIABILITY_KEYWORDS.some(k => lowerCat.includes(k))) return 'LIABILITY';
  return 'OPERATING';
};

const StatementHeader: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => {
  const [businessName, setBusinessName] = useState(() => localStorage.getItem('cf_biz_name') || 'Your Business Name');
  const [period, setPeriod] = useState(() => localStorage.getItem('cf_period') || 'Current Fiscal Period');

  useEffect(() => {
    localStorage.setItem('cf_biz_name', businessName);
  }, [businessName]);

  useEffect(() => {
    localStorage.setItem('cf_period', period);
  }, [period]);

  return (
    <div className="text-center mb-8 md:mb-12 border-b-2 border-slate-900 pb-6 md:pb-8">
      <input 
        value={businessName} 
        onChange={e => setBusinessName(e.target.value)}
        className="text-xl md:text-3xl font-black uppercase tracking-widest text-slate-800 mb-2 text-center w-full bg-transparent border-none focus:ring-0"
        placeholder="BUSINESS NAME"
      />
      <h1 className="text-lg md:text-xl font-medium text-slate-500 mb-4">{title}</h1>
      <div className="flex flex-col items-center justify-center space-y-1 text-slate-400 text-[10px] md:text-xs">
        <div className="flex items-center">
          <Calendar className="w-3 h-3 mr-2 print:hidden" />
          <input 
            value={period} 
            onChange={e => setPeriod(e.target.value)}
            className="text-center bg-transparent border-none focus:ring-0 p-0 text-slate-400"
            placeholder="Statement Period"
          />
        </div>
        <p>Generated: {new Date().toLocaleDateString()}</p>
      </div>
    </div>
  );
};

const EditableAmount: React.FC<{ 
  value: number; 
  originalValue?: number;
  isEditable?: boolean;
  onChange: (val: number | undefined) => void 
}> = ({ value, originalValue, isEditable = true, onChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value.toString());

  useEffect(() => {
    setEditValue(value.toString());
  }, [value]);

  const handleSave = () => {
    const num = parseFloat(editValue);
    if (!isNaN(num)) onChange(num);
    setIsEditing(false);
  };

  const hasOverride = originalValue !== undefined && Math.abs(value - originalValue) > 0.01;

  if (isEditing) {
    return (
      <input
        type="number"
        autoFocus
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        className="w-20 px-1 py-0.5 text-right border border-blue-400 rounded text-xs font-bold"
      />
    );
  }

  return (
    <div 
      onClick={() => isEditable && setIsEditing(true)}
      className={`group flex items-center justify-end gap-1 ${isEditable ? 'cursor-pointer hover:bg-slate-50 px-1 rounded transition-colors' : ''}`}
    >
      <span className={`font-bold ${value < 0 ? 'text-rose-500' : 'text-slate-800'} ${hasOverride ? 'text-blue-600' : ''}`}>
        ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(value)}
        {hasOverride && '*'}
      </span>
    </div>
  );
};

export const ProfitLossStatement: React.FC<FinancialStatementsProps> = ({ transactions }) => {
  const data = useMemo(() => {
    const income: Record<string, number> = {};
    const expenses: Record<string, number> = {};
    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach(t => {
      const accountType = getAccountType(t.category);
      if (accountType !== 'OPERATING') return;

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
    <div className="max-w-4xl mx-auto space-y-4 animate-fade-in">
      <div className="flex justify-end print:hidden">
        <button onClick={() => window.print()} className="flex items-center px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold shadow-lg shadow-slate-200 transition active:scale-95">
          <Printer className="w-4 h-4 mr-2" /> Print Statement
        </button>
      </div>

      <div className="bg-white p-6 md:p-12 shadow-xl border border-slate-100 min-h-[600px] text-slate-900 print:shadow-none print:p-0">
        <StatementHeader title="Profit & Loss Statement" />

        <div className="mb-10">
          <h3 className="text-sm font-black text-slate-800 border-b-2 border-slate-900 pb-1 mb-4 uppercase tracking-tighter">Operating Revenue</h3>
          <div className="divide-y divide-slate-100">
            {Object.entries(data.income).map(([cat, amount]) => (
              <div key={cat} className="flex justify-between py-2 text-xs md:text-sm">
                <span className="text-slate-500">{cat}</span>
                <span className="font-bold">${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(amount as number)}</span>
              </div>
            ))}
            <div className="flex justify-between py-4 font-black uppercase tracking-tighter text-slate-900 bg-slate-50/50 px-2 mt-2">
              <span>Total Revenue</span>
              <span>${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(data.totalIncome as number)}</span>
            </div>
          </div>
        </div>

        <div className="mb-10">
          <h3 className="text-sm font-black text-slate-800 border-b-2 border-slate-900 pb-1 mb-4 uppercase tracking-tighter">Operating Expenses</h3>
          <div className="divide-y divide-slate-100">
            {Object.entries(data.expenses).sort(([, a], [, b]) => (b as number) - (a as number)).map(([cat, amount]) => (
              <div key={cat} className="flex justify-between py-2 text-xs md:text-sm">
                <span className="text-slate-500">{cat}</span>
                <span className="font-bold">${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(amount as number)}</span>
              </div>
            ))}
            <div className="flex justify-between py-4 font-black uppercase tracking-tighter text-slate-900 bg-slate-50/50 px-2 mt-2">
              <span>Total Expenses</span>
              <span>${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(data.totalExpense as number)}</span>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t-4 border-double border-slate-900 pt-6">
          <div className="flex justify-between items-center text-lg md:text-2xl font-black uppercase italic tracking-tighter">
            <span>Net Operating Income</span>
            <span className={data.netProfit >= 0 ? "text-slate-900" : "text-rose-600"}>
              ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(data.netProfit as number)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Fix: Updated onOverride default parameter to match its type signature, fixing "Expected 0 arguments, but got 2" errors.
export const BalanceSheet: React.FC<BalanceSheetProps> = ({ 
  transactions, 
  adjustments, 
  overrides = {}, 
  onAddAdjustment, 
  onRemoveAdjustment, 
  onOverride = (_cat: string, _amount: number | undefined) => {} 
}) => {
  const [newAdjName, setNewAdjName] = useState('');
  const [newAdjAmount, setNewAdjAmount] = useState('');
  const [newAdjType, setNewAdjType] = useState<'ASSET' | 'LIABILITY'>('ASSET');

  const data = useMemo(() => {
    let totalCashIn = 0, totalCashOut = 0;
    const rawFixedAssets: Record<string, number> = {}, rawLiabilities: Record<string, number> = {};
    let operatingIncome = 0, operatingExpense = 0;

    transactions.forEach(t => {
      if (t.type === TransactionType.INCOME) totalCashIn += t.amount; else totalCashOut += t.amount;
      const accountType = getAccountType(t.category);
      if (accountType === 'ASSET') {
        rawFixedAssets[t.category] = (rawFixedAssets[t.category] || 0) + (t.type === TransactionType.EXPENSE ? t.amount : -t.amount);
      } else if (accountType === 'LIABILITY') {
        rawLiabilities[t.category] = (rawLiabilities[t.category] || 0) + (t.type === TransactionType.INCOME ? t.amount : -t.amount);
      } else {
        if (t.type === TransactionType.INCOME) operatingIncome += t.amount; else operatingExpense += t.amount;
      }
    });

    const cashBalance = totalCashIn - totalCashOut;
    const fixedAssets = { ...rawFixedAssets }, liabilities = { ...rawLiabilities };
    const finalCash = overrides['Cash & Equivalents'] !== undefined ? overrides['Cash & Equivalents'] : cashBalance;

    Object.keys(overrides).forEach(key => {
      if (key in fixedAssets) fixedAssets[key] = overrides[key];
      if (key in liabilities) liabilities[key] = overrides[key];
    });

    let totalFixedAssets = Object.values(fixedAssets).reduce((a, b) => a + b, 0);
    let totalLiabilities = Object.values(liabilities).reduce((a, b) => a + b, 0);
    
    totalFixedAssets += adjustments.filter(a => a.type === 'ASSET').reduce((sum, item) => sum + item.amount, 0);
    totalLiabilities += adjustments.filter(a => a.type === 'LIABILITY').reduce((sum, item) => sum + item.amount, 0);

    const retainedEarnings = operatingIncome - operatingExpense;
    return { 
      cash: finalCash, rawCash: cashBalance, fixedAssets, rawFixedAssets, 
      liabilities, rawLiabilities, manualAssets: adjustments.filter(a => a.type === 'ASSET'), 
      manualLiabilities: adjustments.filter(a => a.type === 'LIABILITY'), 
      totalFixedAssets, totalLiabilities, retainedEarnings, 
      totalAssets: finalCash + totalFixedAssets, 
      totalLiabAndEquity: totalLiabilities + retainedEarnings 
    };
  }, [transactions, adjustments, overrides]);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-start gap-4 print:hidden">
         <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[120px]">
               <input type="text" className="w-full px-3 py-2 border-slate-200 rounded-lg text-xs" placeholder="Entry Name" value={newAdjName} onChange={e => setNewAdjName(e.target.value)} />
            </div>
            <div className="w-24">
               <input type="number" className="w-full px-3 py-2 border-slate-200 rounded-lg text-xs" placeholder="0.00" value={newAdjAmount} onChange={e => setNewAdjAmount(e.target.value)} />
            </div>
            <div className="w-24">
               <select className="w-full px-3 py-2 border-slate-200 rounded-lg text-xs bg-white" value={newAdjType} onChange={(e) => setNewAdjType(e.target.value as any)}>
                 <option value="ASSET">Asset</option>
                 <option value="LIABILITY">Liability</option>
               </select>
            </div>
            <button onClick={() => { if(newAdjName && newAdjAmount) onAddAdjustment({ id: Date.now().toString(), name: newAdjName, amount: parseFloat(newAdjAmount), type: newAdjType }); setNewAdjName(''); setNewAdjAmount(''); }} className="bg-slate-900 text-white p-2 rounded-lg hover:bg-slate-700 transition"><Plus className="w-5 h-5" /></button>
         </div>
        <button onClick={() => window.print()} className="flex items-center justify-center px-4 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold shadow-lg shadow-slate-100 transition">
          <Printer className="w-4 h-4 mr-2" /> Print Sheet
        </button>
      </div>

      <div className="bg-white p-6 md:p-12 shadow-xl border border-slate-100 min-h-[800px] text-slate-900 print:shadow-none print:p-0">
        <StatementHeader title="Balance Sheet" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16">
          <div>
            <h3 className="text-sm font-black text-slate-800 border-b-2 border-slate-900 pb-1 mb-6 uppercase tracking-tighter">Assets</h3>
            <div className="space-y-6">
              <div>
                <h4 className="text-[10px] uppercase font-bold text-slate-400 mb-2">Current Assets</h4>
                <div className="flex justify-between text-xs py-2 border-b border-slate-50">
                  <span className="text-slate-600">Cash & Equivalents</span>
                  <EditableAmount value={data.cash} originalValue={data.rawCash} onChange={(val) => onOverride('Cash & Equivalents', val)} />
                </div>
              </div>
              <div>
                <h4 className="text-[10px] uppercase font-bold text-slate-400 mb-2">Fixed & Other</h4>
                <div className="divide-y divide-slate-50">
                  {Object.keys(data.fixedAssets).map((cat) => (
                    <div key={cat} className="flex justify-between text-xs py-2">
                      <span className="text-slate-600">{cat}</span>
                      <EditableAmount value={data.fixedAssets[cat]} originalValue={data.rawFixedAssets[cat]} onChange={(val) => onOverride(cat, val)} />
                    </div>
                  ))}
                  {data.manualAssets.map(adj => (
                    <div key={adj.id} className="flex justify-between text-xs py-2 group">
                      <span className="text-blue-600 font-medium flex items-center">{adj.name} <button onClick={() => onRemoveAdjustment(adj.id)} className="ml-2 text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 print:hidden transition"><Trash2 className="w-3 h-3" /></button></span>
                      <span className="font-bold text-slate-800">${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(adj.amount as number)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-between font-black pt-4 border-t-2 border-slate-900 mt-6 uppercase text-sm tracking-tighter">
                <span>Total Assets</span>
                <span>${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(data.totalAssets as number)}</span>
              </div>
            </div>
          </div>
          <div className="mt-8 md:mt-0">
            <h3 className="text-sm font-black text-slate-800 border-b-2 border-slate-900 pb-1 mb-6 uppercase tracking-tighter">Liabilities & Equity</h3>
            <div className="space-y-6">
              <div>
                <h4 className="text-[10px] uppercase font-bold text-slate-400 mb-2">Liabilities</h4>
                <div className="divide-y divide-slate-50">
                  {Object.keys(data.liabilities).map((cat) => (
                    <div key={cat} className="flex justify-between text-xs py-2">
                      <span className="text-slate-600">{cat}</span>
                      <EditableAmount value={data.liabilities[cat]} originalValue={data.rawLiabilities[cat]} onChange={(val) => onOverride(cat, val)} />
                    </div>
                  ))}
                  {data.manualLiabilities.map(adj => (
                    <div key={adj.id} className="flex justify-between text-xs py-2 group">
                      <span className="text-blue-600 font-medium flex items-center">{adj.name} <button onClick={() => onRemoveAdjustment(adj.id)} className="ml-2 text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 print:hidden transition"><Trash2 className="w-3 h-3" /></button></span>
                      <span className="font-bold text-slate-800">${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(adj.amount as number)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-[10px] uppercase font-bold text-slate-400 mb-2">Equity</h4>
                <div className="flex justify-between text-xs py-2 border-b border-slate-50">
                  <span className="text-slate-600">Retained Earnings</span>
                  <span className="font-bold text-slate-800">${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(data.retainedEarnings as number)}</span>
                </div>
              </div>
              <div className="flex justify-between font-black pt-4 border-t-2 border-slate-900 mt-6 uppercase text-sm tracking-tighter">
                <span>Total Liab. & Equity</span>
                <span>${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(data.totalLiabAndEquity as number)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
