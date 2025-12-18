import React from 'react';
import { Transaction, TransactionType } from '../types';
import { Trash2 } from 'lucide-react';

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
      <div className="p-4 border-b border-slate-100 flex-shrink-0">
        <h3 className="text-lg font-semibold text-slate-800">
          Filtered Transactions ({transactions.length})
        </h3>
      </div>
      
      <div className="overflow-auto flex-1">
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
                <td className="px-4 py-3 text-slate-800 font-medium max-w-xs truncate" title={t.description}>
                  <input 
                    type="text" 
                    value={t.description}
                    onChange={(e) => onUpdateTransaction({ ...t, description: e.target.value })}
                    className="bg-transparent border-none focus:ring-0 w-full p-0"
                  />
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                    t.type === TransactionType.INCOME 
                      ? 'bg-emerald-200 text-emerald-900' 
                      : 'bg-rose-200 text-rose-900'
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
                    {!categories.includes(t.category) && (
                      <option value={t.category}>{t.category}</option>
                    )}
                  </select>
                </td>
                <td className={`px-4 py-3 text-right font-medium ${t.type === TransactionType.INCOME ? 'text-emerald-700' : 'text-rose-700'}`}>
                   {t.type === TransactionType.INCOME ? '+' : '-'}${t.amount.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-center">
                  <button 
                    onClick={() => onDeleteTransaction(t.id)}
                    className="text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No transactions match your current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TransactionTable;