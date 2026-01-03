import React, { useEffect, useMemo, useState } from 'react';
import { Transaction, EntityProfile, Category } from '../types';
import { X, CheckSquare, Search as SearchIcon } from 'lucide-react';
import { findSimilarTransactions } from '../utils/findSimilarTransactions';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  base: Transaction | null;
  transactions: Transaction[];
  profiles?: EntityProfile[];
  categories?: Category[];
  onApply: (ids: string[], updates: Partial<Transaction>) => Promise<void>;
  onUpload?: (txs: Transaction[]) => Promise<void>;
}

const SimilarTransactionsModal: React.FC<Props> = ({ isOpen, onClose, base, transactions, profiles = [], categories = [], onApply, onUpload }) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [profileId, setProfileId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [applying, setApplying] = useState(false);
  const [uploading, setUploading] = useState(false);

  const candidates = useMemo(() => {
    if (!base) return [];
    const sims = findSimilarTransactions(base, transactions, { minTokenOverlap: 2, amountTolerance: 1 });
    return sims;
  }, [base, transactions]);

  useEffect(() => {
    if (isOpen && base) {
      // auto-select amount matches
      const auto = new Set<string>();
      for (const t of candidates) {
        if (Math.abs((t.amount || 0) - (base.amount || 0)) === 0) auto.add(t.id);
      }
      setSelected(auto);
    }
  }, [isOpen, base, candidates]);

  useEffect(() => {
    if (!isOpen) {
      setSelected(new Set());
      setSearch('');
      setProfileId('');
      setCategoryId('');
    }
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(t => (t.description || '').toLowerCase().includes(q) || (t.originalDescription || '').toLowerCase().includes(q));
  }, [candidates, search]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelected(new Set(filtered.map(t => t.id)));
  };

  const clearSelection = () => setSelected(new Set());

  const handleApply = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    const updates: Partial<Transaction> = {};
    if (profileId) {
      const prof = profiles.find(p => p.id === profileId);
      updates.entityId = profileId;
      updates.entityName = prof?.name;
    }
    if (categoryId) {
      const cat = categories.find(c => c.id === categoryId);
      updates.category = cat?.name || undefined;
      updates.categoryId = cat?.id || undefined;
    }

    setApplying(true);
    try {
      await onApply(ids, updates);
      onClose();
    } catch (e) {
      console.error(e);
      alert('Apply failed');
    } finally {
      setApplying(false);
    }
  };

  const handleUpload = async () => {
    if (!onUpload) return;
    if (selected.size === 0) return;
    const txs = transactions.filter(t => selected.has(t.id));
    setUploading(true);
    try {
      await onUpload(txs);
      onClose();
    } catch (e) {
      console.error(e);
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen || !base) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-black">Similar Transactions</h3>
            <p className="text-xs text-slate-400">Matches for "{base.description}"</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600"><X /></button>
        </div>

        <div className="flex gap-3 items-center mb-4">
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
            <input value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm" placeholder="Search within matches" />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={selectAllVisible} className="px-3 py-2 bg-slate-100 rounded-xl text-sm font-black">Select All</button>
            <button onClick={clearSelection} className="px-3 py-2 bg-white border border-slate-100 rounded-xl text-sm">Clear</button>
          </div>
        </div>

        <div className="max-h-[40vh] overflow-y-auto border-t border-b border-slate-100">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs text-slate-400 uppercase tracking-widest">
                <th className="py-2 w-12"></th>
                <th className="py-2">Date</th>
                <th className="py-2">Description</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(t => (
                <tr
                  key={t.id}
                  onClick={() => toggle(t.id)}
                  className={`group transition-colors cursor-pointer ${selected.has(t.id) ? 'bg-indigo-50 hover:bg-indigo-100' : 'hover:bg-slate-50'}`}
                >
                  <td className="py-3 pl-4">
                    <div className={`p-1.5 rounded-lg border-2 transition-all ${selected.has(t.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 group-hover:border-slate-300'}`}>
                      <CheckSquare size={14} />
                    </div>
                  </td>
                  <td className="py-3 text-xs font-bold text-slate-500 tabular-nums w-28">{t.date}</td>
                  <td className="py-3 text-sm font-black text-slate-800 truncate">{t.description}</td>
                  <td className="py-3 text-right text-sm font-black">${t.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-8 text-center text-slate-400 text-xs font-black uppercase">No matches found</div>
          )}
        </div>

        <div className="mt-6">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <select value={profileId} onChange={e => setProfileId(e.target.value)} className="p-2 bg-slate-50 border border-slate-100 rounded-xl text-sm">
              <option value="">Assign to identity...</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="p-2 bg-slate-50 border border-slate-100 rounded-xl text-sm">
              <option value="">Apply category...</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex items-center justify-between">
            <button onClick={onClose} className="px-3 py-2 bg-white border border-slate-100 rounded-xl">Cancel</button>
            <div className="flex items-center gap-2">
              {onUpload && <button onClick={handleUpload} disabled={uploading || selected.size === 0} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-black">{uploading ? 'Uploading...' : 'Upload Selected'}</button>}
              <button onClick={handleApply} disabled={applying || selected.size === 0} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-black">{applying ? 'Applying...' : 'Apply'}</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SimilarTransactionsModal;
