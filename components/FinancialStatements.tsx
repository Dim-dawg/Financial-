
import React, { useMemo, useState, useEffect } from 'react';
import { Transaction, TransactionType, BalanceSheetAdjustment, AccountType, Category } from '../types';
import { ShieldCheck, Info, AlertCircle } from 'lucide-react';

interface FinancialStatementsProps {
  transactions: Transaction[];
  categories?: Category[];
  businessName?: string;
  dateRange?: string;
}

interface BalanceSheetProps extends FinancialStatementsProps {
  adjustments: BalanceSheetAdjustment[];
  overrides?: Record<string, number>;
  onAddAdjustment: (adj: BalanceSheetAdjustment) => void;
  onRemoveAdjustment: (id: string) => void;
  onOverride?: (category: string, amount: number | undefined) => void;
}

// STRICT MAPPING based on user's database list
// This is used as a fallback or for system defaults
const DATABASE_MAPPING: Record<string, AccountType> = {
  // Assets
  'Inventory': AccountType.CURRENT_ASSET,
  
  // Liabilities
  'Loans': AccountType.LONG_TERM_LIAB,
  
  // Equity
  'Withdrawal': AccountType.EQUITY,
  
  // Income (Explicit)
  'Sales Revenue': AccountType.INCOME,
  'Services Income': AccountType.INCOME,
  
  // Expenses (Explicit)
  'Bank Fees': AccountType.EXPENSE,
  'Dinning': AccountType.EXPENSE, // Handling the typo in DB
  'Dining': AccountType.EXPENSE,
  'Marketing': AccountType.EXPENSE,
  'Office Supplies': AccountType.EXPENSE,
  'Payroll': AccountType.EXPENSE,
  'Professional Fees': AccountType.EXPENSE,
  'Rent': AccountType.EXPENSE,
  'Repairs & Maintenance': AccountType.EXPENSE,
  'Travel': AccountType.EXPENSE,
  'Utilities': AccountType.EXPENSE,
  'Uncategorized': AccountType.EXPENSE
};

const FIXED_ASSET_KEYWORDS = [
  'equipment', 'computer', 'furniture', 'vehicle', 'property', 
  'machinery', 'building', 'improvement', 'hardware', 'laptop', 
  'server', 'fixture', 'land', 'renovation', 'truck', 'auto', 'macbook', 'pc'
];

const LONG_TERM_LIAB_KEYWORDS = [
  'mortgage', 'note payable', 'financing', 'term loan', 
  'sba', 'eidl', 'line of credit', 'debt', 'borrowing', 'credit facility', 'bond'
];

const CURRENT_LIAB_KEYWORDS = [
  'credit card', 'amex', 'chase', 'visa', 'mastercard', 'accounts payable', 
  'tax payable', 'accrued', 'short-term', 'overdraft'
];

// Helper to determine account type based on Category Object OR Keyword Fallback
const getAccountClassification = (categoryName: string, categories: Category[]): AccountType | 'PL_ITEM' => {
  const normName = categoryName.trim();
  
  // 1. PRIORITY: Check Dynamic Categories (User Preference)
  // This allows users to override defaults. If they say "Computer Hardware" is an Expense, it obeys.
  const matchedCat = categories.find(c => c.name.toLowerCase() === normName.toLowerCase());
  if (matchedCat?.accountType) {
    if (matchedCat.accountType === AccountType.INCOME || matchedCat.accountType === AccountType.EXPENSE) {
      return 'PL_ITEM';
    }
    return matchedCat.accountType;
  }

  // 2. Check Strict Mapping (Fallback for system defaults)
  if (DATABASE_MAPPING[normName]) {
    const mappedType = DATABASE_MAPPING[normName];
    if (mappedType === AccountType.INCOME || mappedType === AccountType.EXPENSE) {
      return 'PL_ITEM';
    }
    return mappedType;
  }

  // 3. Fallback to Keyword Search (Last Resort)
  // Only if the category is unknown/new
  const lowerCat = normName.toLowerCase();
  if (FIXED_ASSET_KEYWORDS.some(k => lowerCat.includes(k))) return AccountType.FIXED_ASSET;
  if (LONG_TERM_LIAB_KEYWORDS.some(k => lowerCat.includes(k))) return AccountType.LONG_TERM_LIAB;
  if (CURRENT_LIAB_KEYWORDS.some(k => lowerCat.includes(k))) return AccountType.CURRENT_LIABILITY;

  // Default to P&L Item (Expense) if unsure
  return 'PL_ITEM';
};

const MoneyValue: React.FC<{ 
  value: number; 
  isTotal?: boolean; 
  isGrandTotal?: boolean; 
  negativeRed?: boolean;
}> = ({ value, isTotal, isGrandTotal, negativeRed }) => {
  const formatted = new Intl.NumberFormat('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  }).format(Math.abs(value));

  const baseClass = "font-black text-slate-800 tabular-nums";
  const underlineClass = isTotal ? "border-t-2 border-slate-900 pt-0.5 mt-1" : "";
  const grandTotalClass = isGrandTotal ? "border-b-4 border-double border-slate-900 pb-0.5" : "";

  return (
    <span className={`${baseClass} ${underlineClass} ${grandTotalClass} ${value < 0 && negativeRed ? 'text-rose-600' : ''}`}>
      ${formatted}
    </span>
  );
};

const StatementHeader: React.FC<{ title: string; businessName?: string; dateRange?: string }> = ({ title, businessName, dateRange }) => {
  const name = businessName || localStorage.getItem('cf_biz_name') || 'LITIGATION SERVICES CORP';
  const period = dateRange || 'Fiscal Period Ending Dec 2024';

  return (
    <div className="text-center mb-16">
      <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900 mb-1">{name}</h2>
      <h1 className="text-sm font-bold text-slate-500 uppercase tracking-[0.3em] mb-4">{title}</h1>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{period}</p>
    </div>
  );
};

export const ProfitLossStatement: React.FC<FinancialStatementsProps> = ({ transactions, categories = [], businessName, dateRange }) => {
  const data = useMemo(() => {
    const income: Record<string, number> = {};
    const expenses: Record<string, number> = {};
    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach(t => {
      const classification = getAccountClassification(t.category, categories);
      
      // Only include P&L items
      if (classification !== 'PL_ITEM') return;

      if (t.type === TransactionType.INCOME) {
        income[t.category] = (income[t.category] || 0) + t.amount;
        totalIncome += t.amount;
      } else {
        expenses[t.category] = (expenses[t.category] || 0) + t.amount;
        totalExpense += t.amount;
      }
    });

    return { income, expenses, totalIncome, totalExpense, netProfit: totalIncome - totalExpense };
  }, [transactions, categories]);

  return (
    <div className="max-w-4xl mx-auto bg-white p-12 md:p-20 shadow-2xl border border-slate-100 print:shadow-none print:border-none print:p-0">
      <StatementHeader title="Profit & Loss Statement" businessName={businessName} dateRange={dateRange} />

      <section className="mb-12">
        <h3 className="text-xs font-black text-slate-900 border-b-4 border-slate-900 pb-1 mb-6 uppercase tracking-widest">I. OPERATING REVENUE</h3>
        <div className="space-y-4 pl-6">
          {Object.entries(data.income).map(([cat, amount]) => (
            <div key={cat} className="flex justify-between text-xs font-bold text-slate-600">
              <span className="uppercase tracking-tight">{cat}</span>
              <MoneyValue value={amount as number} />
            </div>
          ))}
          {Object.keys(data.income).length === 0 && <div className="text-[10px] text-slate-300 italic">No revenue recorded</div>}
          <div className="flex justify-between font-black pt-6 text-slate-900 uppercase text-[11px] border-t border-slate-100">
            <span className="tracking-widest">Total Operating Revenue</span>
            <MoneyValue value={data.totalIncome} isTotal />
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h3 className="text-xs font-black text-slate-900 border-b-4 border-slate-900 pb-1 mb-6 uppercase tracking-widest">II. OPERATING EXPENSES</h3>
        <div className="space-y-4 pl-6">
          {Object.entries(data.expenses).sort(([,a],[,b]) => (b as number)-(a as number)).map(([cat, amount]) => (
            <div key={cat} className="flex justify-between text-xs font-bold text-slate-600">
              <span className="uppercase tracking-tight">{cat}</span>
              <MoneyValue value={amount as number} />
            </div>
          ))}
          {Object.keys(data.expenses).length === 0 && <div className="text-[10px] text-slate-300 italic">No expenses recorded</div>}
          <div className="flex justify-between font-black pt-6 text-slate-900 uppercase text-[11px] border-t border-slate-100">
            <span className="tracking-widest">Total Operating Expenses</span>
            <MoneyValue value={data.totalExpense} isTotal />
          </div>
        </div>
      </section>

      <div className="mt-24 border-t-8 border-slate-900 pt-6 flex justify-between items-center italic">
        <span className="text-sm font-black uppercase tracking-tighter">Net Operating Income</span>
        <MoneyValue value={data.netProfit} isGrandTotal negativeRed />
      </div>
    </div>
  );
};

export const BalanceSheet: React.FC<BalanceSheetProps> = ({ 
  transactions, 
  categories = [],
  adjustments, 
  overrides = {}, 
  businessName,
  dateRange
}) => {
  const data = useMemo(() => {
    let cashIn = 0, cashOut = 0;
    const assets: Record<string, number> = {};
    const liabilities: Record<string, number> = {};
    const currentAssets: Record<string, number> = {};
    const currentLiabs: Record<string, number> = {};
    const equityItems: Record<string, number> = {};
    
    let operatingIncome = 0, operatingExpense = 0;

    transactions.forEach(t => {
      const classification = getAccountClassification(t.category, categories);

      // --- LOGIC: Bucket transaction based on Classification ---
      
      // FIXED ASSETS
      if (classification === AccountType.FIXED_ASSET || classification === AccountType.ASSET) {
         const impact = t.type === TransactionType.EXPENSE ? t.amount : -t.amount;
         assets[t.category] = (assets[t.category] || 0) + impact;
      }
      
      // CURRENT ASSETS (e.g. Inventory)
      else if (classification === AccountType.CURRENT_ASSET) {
         const impact = t.type === TransactionType.EXPENSE ? t.amount : -t.amount;
         currentAssets[t.category] = (currentAssets[t.category] || 0) + impact;
      }

      // LONG TERM LIABILITIES
      else if (classification === AccountType.LONG_TERM_LIAB || classification === AccountType.LIABILITY) {
         const impact = t.type === TransactionType.INCOME ? t.amount : -t.amount;
         liabilities[t.category] = (liabilities[t.category] || 0) + impact;
      }

      // CURRENT LIABILITIES
      else if (classification === AccountType.CURRENT_LIABILITY) {
         const impact = t.type === TransactionType.INCOME ? t.amount : -t.amount;
         currentLiabs[t.category] = (currentLiabs[t.category] || 0) + impact;
      }

      // EQUITY
      else if (classification === AccountType.EQUITY) {
         const impact = t.type === TransactionType.INCOME ? t.amount : -t.amount;
         equityItems[t.category] = (equityItems[t.category] || 0) + impact;
      }

      // P&L ITEMS (Retained Earnings Calculation)
      else {
        if (t.type === TransactionType.INCOME) operatingIncome += t.amount; else operatingExpense += t.amount;
      }
      
      // CASH CALCULATION (Independent of category)
      if (t.type === TransactionType.INCOME) cashIn += t.amount; else cashOut += t.amount;
    });

    // --- AGGREGATION ---

    const cashBalance = cashIn - cashOut;
    const finalCash = overrides['Cash & Equivalents'] !== undefined ? overrides['Cash & Equivalents'] : cashBalance;

    const currentAssetsList: any[] = [{ name: 'Cash & Equivalents', amount: finalCash }];
    Object.entries(currentAssets).forEach(([name, amount]) => currentAssetsList.push({ name, amount }));

    const fixedAssetsList: any[] = [];
    Object.entries(assets).forEach(([name, amount]) => fixedAssetsList.push({ name, amount }));

    const currentLiabilitiesList: any[] = [];
    Object.entries(currentLiabs).forEach(([name, amount]) => currentLiabilitiesList.push({ name, amount }));

    const longTermLiabilitiesList: any[] = [];
    Object.entries(liabilities).forEach(([name, amount]) => longTermLiabilitiesList.push({ name, amount }));
    
    const equityList: any[] = [];
    Object.entries(equityItems).forEach(([name, amount]) => equityList.push({ name, amount }));

    // Add manual adjustments
    adjustments.forEach(adj => {
      if (adj.type === 'ASSET') currentAssetsList.push({ name: adj.name, amount: adj.amount });
      else longTermLiabilitiesList.push({ name: adj.name, amount: adj.amount });
    });

    const totalCurrentAssets = currentAssetsList.reduce((s, a) => s + a.amount, 0);
    const totalFixedAssets = fixedAssetsList.reduce((s, a) => s + a.amount, 0);
    const totalAssets = totalCurrentAssets + totalFixedAssets;

    const retainedEarnings = operatingIncome - operatingExpense;
    const totalEquityItems = equityList.reduce((s, e) => s + e.amount, 0);
    
    const totalLiabilities = currentLiabilitiesList.reduce((s, l) => s + l.amount, 0) + longTermLiabilitiesList.reduce((s, l) => s + l.amount, 0);
    const totalEquity = retainedEarnings + totalEquityItems;

    return { 
      currentAssets: currentAssetsList, 
      fixedAssets: fixedAssetsList, 
      currentLiabilities: currentLiabilitiesList, 
      longTermLiabilities: longTermLiabilitiesList,
      equityList,
      totalCurrentAssets, totalFixedAssets, totalAssets,
      totalLiabilities,
      retainedEarnings, 
      totalLiabAndEquity: totalLiabilities + totalEquity
    };
  }, [transactions, adjustments, overrides, categories]);

  return (
    <div className="max-w-4xl mx-auto bg-white p-12 md:p-20 shadow-2xl border border-slate-100 min-h-[1000px] print:shadow-none print:border-none print:p-0">
      <StatementHeader title="Consolidated Balance Sheet" businessName={businessName} dateRange={dateRange} />
      {/* (Rest of balance sheet JSX matches previous file, keeping layout identical) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
        <div className="space-y-10">
          <section>
            <h3 className="text-xs font-black text-slate-900 border-b-4 border-slate-900 pb-1 mb-6 uppercase tracking-widest">Assets</h3>
            
            <div className="mb-8">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 italic">Current Assets</p>
              <div className="space-y-3 pl-6">
                {data.currentAssets.map((a, i) => (
                  <div key={i} className="flex justify-between text-xs font-bold text-slate-600">
                    <span className="uppercase tracking-tight">{a.name}</span>
                    <MoneyValue value={a.amount} />
                  </div>
                ))}
                <div className="flex justify-between font-black pt-4 border-t border-slate-100 uppercase text-[10px]">
                  <span>Total Current Assets</span>
                  <MoneyValue value={data.totalCurrentAssets} isTotal />
                </div>
              </div>
            </div>

            <div className="mb-8">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 italic">Fixed Assets</p>
              <div className="space-y-3 pl-6">
                {data.fixedAssets.map((a, i) => (
                  <div key={i} className="flex justify-between text-xs font-bold text-slate-600">
                    <span className="uppercase tracking-tight">{a.name}</span>
                    <MoneyValue value={a.amount} />
                  </div>
                ))}
                {data.fixedAssets.length === 0 && (
                  <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl text-[9px] font-bold text-slate-400 uppercase">
                    <Info size={12} /> No Fixed Assets Recorded
                  </div>
                )}
                {data.fixedAssets.length > 0 && (
                  <div className="flex justify-between font-black pt-4 border-t border-slate-100 uppercase text-[10px]">
                    <span>Total Fixed Assets</span>
                    <MoneyValue value={data.totalFixedAssets} isTotal />
                  </div>
                )}
              </div>
            </div>
          </section>
          
          <div className="pt-8 border-t-8 border-slate-900 flex justify-between font-black uppercase tracking-tighter text-sm italic">
            <span>Total Assets</span>
            <MoneyValue value={data.totalAssets} isGrandTotal />
          </div>
        </div>

        <div className="space-y-10">
          <section>
            <h3 className="text-xs font-black text-slate-900 border-b-4 border-slate-900 pb-1 mb-6 uppercase tracking-widest">Liabilities & Equity</h3>
            
            <div className="mb-8">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 italic">Current Liabilities</p>
              <div className="space-y-3 pl-6">
                {data.currentLiabilities.map((l, i) => (
                  <div key={i} className="flex justify-between text-xs font-bold text-slate-600">
                    <span className="uppercase tracking-tight">{l.name}</span>
                    <MoneyValue value={l.amount} />
                  </div>
                ))}
                {data.currentLiabilities.length === 0 && (
                    <div className="text-[9px] text-slate-300 italic pl-2">No short-term debt found</div>
                )}
              </div>
            </div>

            <div className="mb-8">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 italic">Long-Term Liabilities</p>
              <div className="space-y-3 pl-6">
                {data.longTermLiabilities.map((l, i) => (
                  <div key={i} className="flex justify-between text-xs font-bold text-slate-600">
                    <span className="uppercase tracking-tight">{l.name}</span>
                    <MoneyValue value={l.amount} />
                  </div>
                ))}
                {data.longTermLiabilities.length === 0 && (
                  <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl text-[9px] font-bold text-slate-400 uppercase">
                    <Info size={12} /> Map "Loans" to populate.
                  </div>
                )}
                <div className="flex justify-between font-black pt-4 border-t border-slate-100 uppercase text-[10px]">
                  <span>Total Liabilities</span>
                  <MoneyValue value={data.totalLiabilities} isTotal />
                </div>
              </div>
            </div>

            <div className="mb-8">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 italic">Equity</p>
              <div className="space-y-3 pl-6">
                <div className="flex justify-between text-xs font-bold text-slate-600">
                  <span className="uppercase tracking-tight italic">Retained Earnings (P&L)</span>
                  <MoneyValue value={data.retainedEarnings} />
                </div>
                {data.equityList.map((e, i) => (
                   <div key={i} className="flex justify-between text-xs font-bold text-slate-600">
                    <span className="uppercase tracking-tight italic">{e.name}</span>
                    <MoneyValue value={e.amount} negativeRed />
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="pt-8 border-t-8 border-slate-900 flex justify-between font-black uppercase tracking-tighter text-sm italic">
            <span>Total Liab. & Equity</span>
            <MoneyValue value={data.totalLiabAndEquity} isGrandTotal />
          </div>
        </div>
      </div>

      <div className="mt-40 grid grid-cols-2 gap-20">
        <div className="border-t-2 border-slate-200 pt-4">
          <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-4">Certified Preparation</p>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="text-[10px] font-black uppercase text-slate-800 tracking-tight">Cipher AI Financial Core</span>
          </div>
        </div>
        <div className="border-t-2 border-slate-200 pt-4 text-right">
          <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Business Officer</p>
          <div className="h-10"></div>
        </div>
      </div>
    </div>
  );
};
