
import React, { useState, useMemo } from 'react';
import { CategorizationRule, Transaction, TransactionType, Category } from '../types';
import { Plus, X, Zap, ArrowRight, Activity, Tag, ListFilter } from 'lucide-react';

interface RulesEngineProps {
  rules: CategorizationRule[];
  categories: Category[];
  transactions: Transaction[];
  onAddRule: (rule: CategorizationRule) => void;
  onRemoveRule: (id: string) => void;
  onApplyRules: () => void;
}

const RulesEngine: React.FC<RulesEngineProps> = ({ 
  rules, 
  categories, 
  transactions,
  onAddRule, 
  onRemoveRule, 
  onApplyRules 
}) => {
  const [keyword, setKeyword] = useState('');
  const [categoryName, setCategoryName] = useState(categories[0]?.name || 'Uncategorized');
  const [ruleType, setRuleType] = useState<TransactionType | 'BOTH'>('BOTH');
  const [isApplying, setIsApplying] = useState(false);

  // Calculate impact: How many transactions are matched by each rule
  const ruleImpact = useMemo(() => {
    const counts: Record<string, number> = {};
    const sortedRules = [...rules].sort((a, b) => b.keyword.length - a.keyword.length);
    
    rules.forEach(r => counts[r.id] = 0);

    transactions.forEach(t => {
      const match = sortedRules.find(r => {
        const textMatch = t.description.toLowerCase().includes(r.keyword.toLowerCase());
        const typeMatch = !r.targetType || r.targetType === t.type;
        return textMatch && typeMatch;
      });
      if (match) counts[match.id]++;
    });

    return counts;
  }, [rules, transactions]);

  const handleAdd = () => {
    if (!keyword) return;
    const cat = categories.find(c => c.name === categoryName);
    const newRule: CategorizationRule = {
      id: `rule-${Date.now()}`,
      keyword,
      targetCategory: categoryName,
      targetCategoryId: cat?.id,
      targetType: ruleType === 'BOTH' ? undefined : ruleType
    };
    onAddRule(newRule);
    setKeyword('');
  };

  const handleRunAll = async () => {
    setIsApplying(true);
    await onApplyRules();
    setTimeout(() => setIsApplying(false), 800);
  };

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-full">
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-sm font-bold text-slate-800 flex items-center">
          <Zap className="w-4 h-4 text-amber-500 mr-2" />
          Automation Rules
        </h3>
        <button 
          onClick={handleRunAll}
          disabled={rules.length === 0 || isApplying}
          className={`text-[10px] px-3 py-1.5 rounded-lg font-black uppercase tracking-widest transition-all ${
            isApplying ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
          }`}
        >
          {isApplying ? 'Running...' : 'Run All'}
        </button>
      </div>

      <div className="space-y-4">
        {/* Create Rule Form */}
        <div className="bg-slate-50 p-3 rounded-xl space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Merchant keyword..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="flex-1 px-3 py-2 border-none rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 shadow-sm"
            />
          </div>
          <div className="flex gap-2">
             <select
              value={ruleType}
              onChange={(e) => setRuleType(e.target.value as any)}
              className="flex-1 px-2 py-2 border-none rounded-lg text-[10px] font-bold uppercase tracking-wider focus:ring-2 focus:ring-blue-500 shadow-sm bg-white"
            >
              <option value="BOTH">All Types</option>
              <option value={TransactionType.EXPENSE}>Expenses Only</option>
              <option value={TransactionType.INCOME}>Income Only</option>
            </select>
            <select
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              className="flex-1 px-2 py-2 border-none rounded-lg text-[10px] font-bold uppercase tracking-wider focus:ring-2 focus:ring-blue-500 shadow-sm bg-white"
            >
              {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <button
              onClick={handleAdd}
              disabled={!keyword}
              className="bg-slate-900 text-white p-2 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition shadow-lg"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Rules List Breakdown */}
        <div className="space-y-2 overflow-y-auto max-h-[300px] pr-1">
          {rules.length === 0 ? (
            <div className="text-center py-8 opacity-40">
              <ListFilter className="w-8 h-8 mx-auto mb-2" />
              <p className="text-[10px] font-bold uppercase tracking-widest">No Active Rules</p>
            </div>
          ) : (
            [...rules].sort((a, b) => b.keyword.length - a.keyword.length).map(rule => (
              <div key={rule.id} className="group relative flex flex-col p-3 bg-white border border-slate-100 rounded-xl hover:shadow-md hover:border-blue-200 transition-all">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-800 italic">"{rule.keyword}"</span>
                    {rule.targetType && (
                      <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase ${
                        rule.targetType === TransactionType.INCOME ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                      }`}>
                        {rule.targetType}
                      </span>
                    )}
                  </div>
                  <button onClick={() => onRemoveRule(rule.id)} className="p-1 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center text-[10px] font-bold text-slate-400">
                    <ArrowRight className="w-3 h-3 mr-1" />
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">{rule.targetCategory}</span>
                  </div>
                  <div className="flex items-center text-[9px] font-black uppercase text-blue-500 bg-blue-50 px-2 py-1 rounded-full">
                    <Activity className="w-2.5 h-2.5 mr-1" />
                    {ruleImpact[rule.id] || 0} hits
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      <div className="mt-auto pt-4 border-t border-slate-50 text-[9px] text-slate-400 font-medium italic">
        Rules are priority-ordered by keyword length. Specific matches override generic ones.
      </div>
    </div>
  );
};

export default RulesEngine;
