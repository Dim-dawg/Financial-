
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, Check, AlertTriangle, Search, Lock, PieChart, Landmark, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { Category, AccountType } from '../types';

interface CategoryManagerProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onAdd: (categoryName: string, accountType: AccountType) => void;
  onRename: (oldName: string, newName: string) => void;
  onDelete: (categoryName: string) => void;
  onUpdateType?: (id: string, type: AccountType) => void;
}

const CategoryManager: React.FC<CategoryManagerProps> = ({ 
  isOpen, 
  onClose, 
  categories, 
  onAdd, 
  onRename, 
  onDelete,
  onUpdateType
}) => {
  const [newCategory, setNewCategory] = useState('');
  const [newType, setNewType] = useState<AccountType>(AccountType.EXPENSE);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editValue, setEditValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && !editingCategory) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, editingCategory]);

  const filteredCategories = useMemo(() => {
    return categories.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [categories, searchQuery]);

  if (!isOpen) return null;

  const handleAdd = () => {
    const trimmed = newCategory.trim();
    if (trimmed) {
      if (categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
        alert("This category already exists.");
        return;
      }
      onAdd(trimmed, newType);
      setNewCategory('');
    }
  };

  const startEditing = (category: Category) => {
    setEditingCategory(category);
    setEditValue(category.name);
  };

  const saveEdit = () => {
    const trimmed = editValue.trim();
    if (editingCategory && trimmed && trimmed !== editingCategory.name) {
      onRename(editingCategory.name, trimmed);
    }
    setEditingCategory(null);
  };

  const isSystemCategory = (catName: string) => {
    return ['Uncategorized', 'Sales Revenue', 'Services Income'].includes(catName);
  };

  const getTypeIcon = (type?: AccountType) => {
    switch (type) {
      case AccountType.INCOME: return <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />;
      case AccountType.EXPENSE: return <TrendingDown className="w-3.5 h-3.5 text-rose-500" />;
      case AccountType.CURRENT_ASSET:
      case AccountType.FIXED_ASSET:
      case AccountType.ASSET: return <Wallet className="w-3.5 h-3.5 text-indigo-500" />;
      case AccountType.CURRENT_LIABILITY:
      case AccountType.LONG_TERM_LIAB:
      case AccountType.LIABILITY: return <Landmark className="w-3.5 h-3.5 text-amber-500" />;
      default: return <PieChart className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
    [AccountType.INCOME]: 'Income',
    [AccountType.EXPENSE]: 'Expense',
    [AccountType.CURRENT_ASSET]: 'Current Asset',
    [AccountType.FIXED_ASSET]: 'Fixed Asset',
    [AccountType.CURRENT_LIABILITY]: 'Current Liab.',
    [AccountType.LONG_TERM_LIAB]: 'Long-Term Debt',
    [AccountType.EQUITY]: 'Equity',
    [AccountType.ASSET]: 'Asset (Generic)',
    [AccountType.LIABILITY]: 'Liab (Generic)',
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh] animate-scale-up border border-slate-100">
        <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center">
          <div>
            <h3 className="font-black text-slate-800 text-xl tracking-tight">Chart of Accounts</h3>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Classification Settings</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-300 hover:text-slate-600 transition-all"><X className="w-6 h-6" /></button>
        </div>

        <div className="px-8 py-6 bg-slate-50/50 border-b border-slate-100 space-y-4">
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                placeholder="Category Name..."
                className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:border-indigo-500 outline-none transition-all shadow-sm"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              />
              <button
                onClick={handleAdd}
                disabled={!newCategory.trim()}
                className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 disabled:opacity-30 transition-all shadow-lg active:scale-95 shrink-0"
              >
                Add Account
              </button>
            </div>
            
            <div className="space-y-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Map to Ledger Type:</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                {[AccountType.INCOME, AccountType.EXPENSE, AccountType.CURRENT_ASSET, AccountType.FIXED_ASSET, AccountType.CURRENT_LIABILITY, AccountType.LONG_TERM_LIAB].map(t => (
                  <button
                    key={t}
                    onClick={() => setNewType(t)}
                    className={`py-2 px-1 rounded-xl text-[8px] font-black uppercase tracking-tighter border-2 transition-all ${newType === t ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-400 border-slate-100'}`}
                  >
                    {ACCOUNT_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Filter current accounts..."
              className="w-full pl-10 pr-4 py-2 bg-transparent border-none text-[10px] font-bold uppercase tracking-widest focus:ring-0 placeholder:text-slate-300"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-2">
          <div className="space-y-1">
            {filteredCategories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between p-4 rounded-2xl transition-all group hover:bg-slate-50">
                {editingCategory?.id === cat.id ? (
                  <div className="flex-1 flex items-center gap-2">
                    <input autoFocus className="flex-1 px-3 py-2 border-2 border-indigo-200 rounded-xl text-xs font-bold bg-white" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEdit()} />
                    <button onClick={saveEdit} className="p-2 bg-indigo-600 text-white rounded-xl shadow-md"><Check className="w-4 h-4" /></button>
                  </div>
                ) : confirmDelete === cat.name ? (
                  <div className="flex-1 flex items-center justify-between gap-4 animate-fade-in">
                     <span className="text-[10px] font-black text-rose-600 uppercase tracking-tight">Confirm Deletion?</span>
                     <div className="flex gap-2">
                       <button onClick={() => { onDelete(cat.name); setConfirmDelete(null); }} className="px-3 py-1.5 bg-rose-600 text-white text-[9px] font-black uppercase rounded-lg">Delete</button>
                       <button onClick={() => setConfirmDelete(null)} className="px-3 py-1.5 bg-slate-100 text-slate-600 text-[9px] font-black uppercase rounded-lg">Cancel</button>
                     </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">{getTypeIcon(cat.accountType)}</div>
                      <div className="min-w-0">
                        <span className="text-slate-700 text-xs font-black uppercase tracking-tight truncate block">{cat.name}</span>
                        <select 
                          className="bg-transparent border-none p-0 text-[8px] font-black text-slate-400 uppercase tracking-widest focus:ring-0 cursor-pointer hover:text-indigo-500"
                          value={cat.accountType || AccountType.EXPENSE}
                          onChange={(e) => onUpdateType && onUpdateType(cat.id, e.target.value as AccountType)}
                        >
                          {Object.values(AccountType).map(t => (
                            <option key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {!isSystemCategory(cat.name) && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => startEditing(cat)} className="p-2 text-slate-300 hover:text-indigo-600"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setConfirmDelete(cat.name)} className="p-2 text-slate-300 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategoryManager;
