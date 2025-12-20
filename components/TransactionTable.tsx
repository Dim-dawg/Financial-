
import React from 'react';
import { Transaction, TransactionType } from '../types';
import { Trash2, Calendar, Tag, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

interface TransactionTableProps {
  transactions: Transaction[];
  categories: string[];
  onUpdateTransaction: (updated: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
}

const TransactionTable: React.FC<TransactionTableProps> = ({ 
  transactions, 
  categories,
  onUpdateTransaction,
  onDeleteTransaction 
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-full max-h-[700px]">
      <div className="p-4 border-b border-slate-100 flex-shrink-0 flex justify-between items-center">
        <h3 className="text-sm md:text-lg font-semibold text-slate-800">
          Transactions ({transactions.length})
        </h3>
      </div>
      
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-auto flex-1">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0 z-10 shadow-sm ring-1 ring-slate-100">
            <tr>
              <th className="px-4 py-3 bg-slate-50">Date</th>
              <th className="px-4 py-3 bg-slate-50">Description</th>
              <th className="px-4 py-3 bg-slate-50">Type</th>
              <th className="px-4 py-3 bg-slate-50">Category</th>
              <th className="px-4 py-3 text-right bg-slate-50">Amount</th>
              <th className="px-4 py-3 text-center bg-slate-50">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {transactions.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{t.date}</td>
                <td className="px-4 py-3 text-slate-800 font-medium max-w-xs truncate">
                  <input 
                    type="text" 
                    value={t.description}
                    onChange={(e) => onUpdateTransaction({ ...t, description: e.target.value })}
                    className="bg-transparent border-none focus:ring-0 w-full p-0"
                  />
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    t.type === TransactionType.INCOME 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : 'bg-rose-100 text-rose-700'
                  }`}>
                    {t.type}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <select 
                    value={t.category}
                    onChange={(e) => onUpdateTransaction({ ...t, category: e.target.value })}
                    className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </td>
                <td className={`px-4 py-3 text-right font-bold ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-slate-900'}`}>
                   {t.type === TransactionType.INCOME ? '+' : '-'}${t.amount.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-center">
                  <button 
                    onClick={() => onDeleteTransaction(t.id)}
                    className="text-slate-300 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile List View */}
      <div className="md:hidden overflow-auto flex-1 divide-y divide-slate-50">
        {transactions.length === 0 ? (
          <div className="px-4 py-12 text-center text-slate-400 text-sm">No transactions found.</div>
        ) : (
          transactions.map((t) => (
            <div key={t.id} className="p-4 space-y-3 active:bg-slate-50 transition-colors">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0 pr-4">
                  <input 
                    type="text" 
                    value={t.description}
                    onChange={(e) => onUpdateTransaction({ ...t, description: e.target.value })}
                    className="bg-transparent border-none focus:ring-0 w-full p-0 font-bold text-slate-800 text-sm truncate"
                  />
                  <div className="flex items-center gap-2 mt-1">
                    <span className="flex items-center text-[10px] text-slate-400 font-medium">
                      <Calendar className="w-3 h-3 mr-1" /> {t.date}
                    </span>
                    <span className={`flex items-center text-[10px] font-bold uppercase tracking-widest ${t.type === TransactionType.INCOME ? 'text-emerald-500' : 'text-slate-400'}`}>
                      {t.type === TransactionType.INCOME ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownLeft className="w-3 h-3 mr-0.5" />}
                      {t.type}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-base font-black ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-slate-900'}`}>
                    {t.type === TransactionType.INCOME ? '+' : ''}${t.amount.toFixed(2)}
                  </p>
                  <button 
                    onClick={() => onDeleteTransaction(t.id)}
                    className="text-slate-300 p-1 mt-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                 <Tag className="w-3 h-3 text-slate-300" />
                 <select 
                    value={t.category}
                    onChange={(e) => onUpdateTransaction({ ...t, category: e.target.value })}
                    className="bg-slate-100 border-none rounded-lg px-2 py-1 text-[11px] font-bold text-slate-600 focus:ring-1 focus:ring-blue-500 appearance-none pr-6 relative"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TransactionTable;
