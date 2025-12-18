import React, { useState } from 'react';
import { CategorizationRule, Transaction, TransactionType } from '../types';
import { Plus, X, Zap } from 'lucide-react';

interface RulesEngineProps {
  rules: CategorizationRule[];
  categories: string[];
  onAddRule: (rule: CategorizationRule) => void;
  onRemoveRule: (id: string) => void;
  onApplyRules: () => void;
}

const RulesEngine: React.FC<RulesEngineProps> = ({ rules, categories, onAddRule, onRemoveRule, onApplyRules }) => {
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState(categories[0] || 'Uncategorized');
  const [isOpen, setIsOpen] = useState(false);

  const handleAdd = () => {
    if (!keyword) return;
    const newRule: CategorizationRule = {
      id: Date.now().toString(),
      keyword,
      targetCategory: category
    };
    onAddRule(newRule);
    setKeyword('');
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-slate-800 flex items-center">
          <Zap className="w-5 h-5 text-amber-500 mr-2" />
          Automation Rules
        </h3>
        <button 
          onClick={onApplyRules}
          className="text-sm bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors font-medium"
        >
          Run All Rules
        </button>
      </div>

      <div className="space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="If description contains..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-1/3 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button
            onClick={handleAdd}
            disabled={!keyword}
            className="bg-slate-800 text-white p-2 rounded-lg hover:bg-slate-700 disabled:opacity-50"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2 max-h-48 overflow-y-auto">
          {rules.length === 0 && <p className="text-sm text-slate-400 text-center py-2">No rules defined yet.</p>}
          {rules.map(rule => (
            <div key={rule.id} className="flex items-center justify-between text-sm bg-slate-50 p-2 rounded border border-slate-100">
              <span className="text-slate-600">
                Contains <strong className="text-slate-800">"{rule.keyword}"</strong> &rarr; <span className="bg-white px-2 py-0.5 rounded border border-slate-200 text-xs font-medium">{rule.targetCategory}</span>
              </span>
              <button onClick={() => onRemoveRule(rule.id)} className="text-slate-400 hover:text-rose-500">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RulesEngine;