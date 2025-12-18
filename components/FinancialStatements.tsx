
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
    <div className="text-center mb-12 border-b-2 border-slate-900 pb-8">
      <input 
        value={businessName} 
        onChange={e => setBusinessName(e.target.value)}
        className="text-3xl font-bold uppercase tracking-widest text-slate-800 mb-2 text-center w-full bg-transparent border-none focus:ring-0"
        placeholder="ENTER BUSINESS NAME"
      />
      <h1 className="text-xl font-medium text-slate-600 mb-4">{title}</h1>
      <div className="flex flex-col items-center justify-center space-y-1 text-slate-500 text-sm">
        <div className="flex items-center">
          <Calendar className="w-3 h-3 mr-2 print:hidden" />
          <input 
            value={period} 
            onChange={e => setPeriod(e.target.value)}
            className="text-center bg-transparent border-none focus:ring-0 p-0 text-slate-500"
            placeholder="Statement Period (e.g. FY 2024)"
          />
        </div>
        <p>Prepared on: {new Date().toLocaleDateString()}</p>
        <p className="text-[10px] uppercase tracking-tighter opacity-50">Cipher Finance AI-Generated Reporting</p>
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
    if (!isNaN(num)) {
      onChange(num);
    }
    setIsEditing(false);
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined);
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
        className="w-24 px-1 py-0.5 text-right border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm font-medium"
      />
    );
  }

  return (
    <div 
      onClick={() => isEditable && setIsEditing(true)}
      className={`group flex items-center justify-end gap-2 ${isEditable ? 'cursor-pointer hover:bg-slate-100 px-1 -mr-1 rounded' : ''}`}
      title={isEditable ? "Click to edit amount" : ""}
    >
      {hasOverride && (
        <button 
          onClick={handleReset}
          className="text-slate-400 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 print:hidden"
          title="Reset to calculated value"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      )}
      <span className={`font-medium ${value < 0 ? 'text-red-500' : ''} ${hasOverride ? 'text-blue-700' : ''}`}>
        ${value.toLocaleString(undefined, {minimumFractionDigits: 2})}
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
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex justify-end space-x-3 print:hidden">
        <button onClick={() => window.print()} className="flex items-center px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition">
          <Printer className="w-4 h-4 mr-2" /> Print / Save as PDF
        </button>
      </div>

      <div className="bg-white p-12 shadow-lg border border-slate-200 min-h-[1000px] text-slate-900 print:shadow-none print:border-none print:p-0">
        <StatementHeader title="Profit & Loss Statement" />

        <div className="mb-8">
          <h3 className="text-lg font-bold text-slate-700 border-b-2 border-slate-800 pb-1 mb-4 uppercase">Operating Revenue</h3>
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(data.income).map(([cat, amount]) => (
                <tr key={cat} className="border-b border-slate-100">
                  <td className="py-2 text-slate-600 w-2/3">{cat}</td>
                  {/* Fixed toLocaleString error by casting amount to number */}
                  <td className="py-2 text-right font-medium w-1/3">${(amount as number).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-bold">
                <td className="py-3 pl-2 text-slate-800 uppercase text-xs">Total Revenue</td>
                {/* Fixed toLocaleString error by casting to number */}
                <td className="py-3 text-right text-slate-800">${(data.totalIncome as number).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mb-8">
          <h3 className="text-lg font-bold text-slate-700 border-b-2 border-slate-800 pb-1 mb-4 uppercase">Operating Expenses</h3>
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(data.expenses).sort(([, a], [, b]) => (b as number) - (a as number)).map(([cat, amount]) => (
                <tr key={cat} className="border-b border-slate-100">
                  <td className="py-2 text-slate-600 w-2/3">{cat}</td>
                  {/* Fixed toLocaleString error by casting amount to number */}
                  <td className="py-2 text-right font-medium w-1/3">${(amount as number).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-bold">
                <td className="py-3 pl-2 text-slate-800 uppercase text-xs">Total Expenses</td>
                {/* Fixed toLocaleString error by casting to number */}
                <td className="py-3 text-right text-slate-800">${(data.totalExpense as number).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-12 border-t-4 border-double border-slate-800 pt-4">
          <div className="flex justify-between items-center text-xl font-bold">
            <span className="uppercase">Net Operating Income</span>
            {/* Fixed toLocaleString error by casting to number */}
            <span className={data.netProfit >= 0 ? "text-slate-900" : "text-red-600"}>
              ${(data.netProfit as number).toLocaleString(undefined, {minimumFractionDigits: 2})}
            </span>
          </div>
        </div>

        <div className="mt-12 p-4 bg-slate-50 border border-slate-100 rounded text-[10px] text-slate-500 italic">
          Disclaimer: This financial statement is prepared based on provided transaction history and categorized using AI. It has not been audited by a certified public accountant.
        </div>
      </div>
    </div>
  );
};

export const BalanceSheet: React.FC<BalanceSheetProps> = ({ transactions, adjustments, overrides = {}, onAddAdjustment, onRemoveAdjustment, onOverride = () => {} }) => {
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
    return { cash: finalCash, rawCash: cashBalance, fixedAssets, rawFixedAssets, liabilities, rawLiabilities, manualAssets: adjustments.filter(a => a.type === 'ASSET'), manualLiabilities: adjustments.filter(a => a.type === 'LIABILITY'), totalFixedAssets, totalLiabilities, retainedEarnings, totalAssets: finalCash + totalFixedAssets, totalLiabAndEquity: totalLiabilities + retainedEarnings };
  }, [transactions, adjustments, overrides]);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex justify-between items-start print:hidden">
         <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex gap-2 items-end">
            <div>
               <label className="text-xs font-semibold text-slate-500 block mb-1">Manual Entry Name</label>
               <input type="text" className="px-2 py-1.5 border border-slate-300 rounded text-sm w-40" placeholder="e.g. Real Estate" value={newAdjName} onChange={e => setNewAdjName(e.target.value)} />
            </div>
            <div>
               <label className="text-xs font-semibold text-slate-500 block mb-1">Amount</label>
               <input type="number" className="px-2 py-1.5 border border-slate-300 rounded text-sm w-28" placeholder="0.00" value={newAdjAmount} onChange={e => setNewAdjAmount(e.target.value)} />
            </div>
            <div>
               <label className="text-xs font-semibold text-slate-500 block mb-1">Type</label>
               <select className="px-2 py-1.5 border border-slate-300 rounded text-sm" value={newAdjType} onChange={(e) => setNewAdjType(e.target.value as any)}>
                 <option value="ASSET">Asset</option>
                 <option value="LIABILITY">Liability</option>
               </select>
            </div>
            <button onClick={() => { if(newAdjName && newAdjAmount) onAddAdjustment({ id: Date.now().toString(), name: newAdjName, amount: parseFloat(newAdjAmount), type: newAdjType }); setNewAdjName(''); setNewAdjAmount(''); }} className="bg-slate-800 text-white p-1.5 rounded hover:bg-slate-700 h-[34px]"><Plus className="w-5 h-5" /></button>
         </div>
        <button onClick={() => window.print()} className="flex items-center px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition"><Printer className="w-4 h-4 mr-2" /> Print / Save as PDF</button>
      </div>

      <div className="bg-white p-12 shadow-lg border border-slate-200 min-h-[1000px] text-slate-900 print:shadow-none print:border-none print:p-0">
        <StatementHeader title="Balance Sheet" />
        <div className="grid grid-cols-2 gap-12">
          <div>
            <h3 className="text-lg font-bold text-slate-700 border-b-2 border-slate-800 pb-1 mb-4 uppercase">Assets</h3>
            <div className="space-y-6">
              <div>
                <h4 className="font-semibold text-slate-800 mb-2">Current Assets</h4>
                <div className="flex justify-between text-sm py-1 border-b border-slate-100">
                  <span className="text-slate-600">Cash & Equivalents</span>
                  <EditableAmount value={data.cash} originalValue={data.rawCash} onChange={(val) => onOverride('Cash & Equivalents', val)} />
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-slate-800 mb-2">Fixed & Other Assets</h4>
                {Object.keys(data.fixedAssets).map((cat) => (
                  <div key={cat} className="flex justify-between text-sm py-1 border-b border-slate-100">
                    <span className="text-slate-600">{cat}</span>
                    <EditableAmount value={data.fixedAssets[cat]} originalValue={data.rawFixedAssets[cat]} onChange={(val) => onOverride(cat, val)} />
                  </div>
                ))}
                {data.manualAssets.map(adj => (
                  <div key={adj.id} className="flex justify-between text-sm py-1 group border-b border-slate-100">
                    <span className="text-blue-600 flex items-center">{adj.name} <button onClick={() => onRemoveAdjustment(adj.id)} className="ml-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 print:hidden"><Trash2 className="w-3 h-3" /></button></span>
                    {/* Fixed toLocaleString error by casting adj.amount to number */}
                    <span className="font-medium text-slate-700">${(adj.amount as number).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                ))}
              </div>
              {/* Fixed toLocaleString error by casting data.totalAssets to number */}
              <div className="flex justify-between font-bold pt-4 border-t-2 border-slate-800 mt-8 uppercase text-sm"><span>Total Assets</span><span>${(data.totalAssets as number).toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-700 border-b-2 border-slate-800 pb-1 mb-4 uppercase">Liabilities & Equity</h3>
            <div className="space-y-6">
              <div>
                <h4 className="font-semibold text-slate-800 mb-2">Liabilities</h4>
                {Object.keys(data.liabilities).map((cat) => (
                  <div key={cat} className="flex justify-between text-sm py-1 border-b border-slate-100">
                    <span className="text-slate-600">{cat}</span>
                    <EditableAmount value={data.liabilities[cat]} originalValue={data.rawLiabilities[cat]} onChange={(val) => onOverride(cat, val)} />
                  </div>
                ))}
                {data.manualLiabilities.map(adj => (
                  <div key={adj.id} className="flex justify-between text-sm py-1 group border-b border-slate-100">
                    <span className="text-blue-600 flex items-center">{adj.name} <button onClick={() => onRemoveAdjustment(adj.id)} className="ml-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 print:hidden"><Trash2 className="w-3 h-3" /></button></span>
                    {/* Fixed toLocaleString error by casting adj.amount to number */}
                    <span className="font-medium text-slate-700">${(adj.amount as number).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                ))}
              </div>
              <div>
                <h4 className="font-semibold text-slate-800 mb-2">Equity</h4>
                <div className="flex justify-between text-sm py-1 border-b border-slate-100">
                  <span className="text-slate-600">Retained Earnings</span>
                  {/* Fixed toLocaleString error by casting to number */}
                  <span className="font-medium">${(data.retainedEarnings as number).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
              </div>
              {/* Fixed toLocaleString error by casting data.totalLiabAndEquity to number */}
              <div className="flex justify-between font-bold pt-4 border-t-2 border-slate-800 mt-8 uppercase text-sm"><span>Total Liab. & Equity</span><span>${(data.totalLiabAndEquity as number).toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
            </div>
          </div>
        </div>
        <div className="mt-12 p-4 bg-blue-50 border border-blue-100 rounded text-[10px] text-slate-600 print:hidden flex items-start">
           <Info className="w-4 h-4 mr-2 text-blue-500 mt-0.5 flex-shrink-0" />
           <div><strong>Adjustment Notes:</strong> Derived values marked with <span className="text-blue-700">*</span> have been manually adjusted for reporting accuracy. Manual entries are highlighted in blue.</div>
        </div>
      </div>
    </div>
  );
};
