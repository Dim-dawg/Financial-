
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, Check, Save, AlertTriangle, Search, Lock } from 'lucide-react';
import { Category } from '../types';

interface CategoryManagerProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onAdd: (categoryName: string) => void;
  onRename: (oldName: string, newName: string) => void;
  onDelete: (categoryName: string) => void;
}

const CategoryManager: React.FC<CategoryManagerProps> = ({ 
  isOpen, 
  onClose, 
  categories, 
  onAdd, 
  onRename, 
  onDelete 
}) => {
  const [newCategory, setNewCategory] = useState('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editValue, setEditValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on open
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
      onAdd(trimmed);
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
      if (categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase() && c.id !== editingCategory.id)) {
        alert("Another category already has this name.");
        return;
      }
      onRename(editingCategory.name, trimmed);
    }
    setEditingCategory(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    setEditingCategory(null);
    setEditValue('');
  };

  const isSystemCategory = (catName: string) => {
    const system = ['Uncategorized', 'Sales Revenue', 'Services Income'];
    return system.includes(catName);
  };

  const handleDelete = (name: string) => {
    onDelete(name);
    setConfirmDelete(null);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] animate-scale-up border border-slate-100">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center bg-white">
          <div>
            <h3 className="font-black text-slate-800 text-xl tracking-tight">Chart of Accounts</h3>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-widest mt-1">Manage Categories</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Action Bar */}
        <div className="px-8 py-6 bg-slate-50/50 border-b border-slate-100 space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Plus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
              <input
                ref={inputRef}
                type="text"
                placeholder="New category (e.g. Marketing)..."
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={!newCategory.trim()}
              className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-slate-800 disabled:opacity-30 transition-all shadow-lg active:scale-95 flex items-center shrink-0"
            >
              Add
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Filter existing accounts..."
              className="w-full pl-10 pr-4 py-2 bg-transparent border-none text-xs font-medium focus:ring-0 placeholder:text-slate-300"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* List Section */}
        <div className="overflow-y-auto flex-1 px-4 py-2">
          <div className="space-y-1">
            {filteredCategories.length === 0 ? (
              <div className="py-20 text-center">
                <p className="text-slate-300 text-sm font-medium italic">No accounts found matching your search.</p>
              </div>
            ) : (
              filteredCategories.map((cat) => (
                <div 
                  key={cat.id} 
                  className={`flex items-center justify-between p-4 rounded-2xl transition-all group ${
                    editingCategory?.id === cat.id ? 'bg-indigo-50' : 'hover:bg-slate-50'
                  }`}
                >
                  {editingCategory?.id === cat.id ? (
                    <div className="flex-1 flex items-center gap-3">
                      <input
                        type="text"
                        autoFocus
                        className="flex-1 px-3 py-2 border-2 border-indigo-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 bg-white"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit();
                          if (e.key === 'Escape') cancelEdit();
                        }}
                      />
                      <button onClick={saveEdit} className="p-2 bg-indigo-600 text-white rounded-xl shadow-md hover:bg-indigo-700 transition-all">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={cancelEdit} className="p-2 bg-white text-slate-400 border border-slate-200 rounded-xl hover:bg-slate-100 transition-all">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : confirmDelete === cat.name ? (
                    <div className="flex-1 flex items-center justify-between gap-4 animate-fade-in">
                       <div className="flex items-center gap-2 text-rose-600">
                         <AlertTriangle className="w-4 h-4" />
                         <span className="text-xs font-black uppercase tracking-tight">Confirm Delete?</span>
                       </div>
                       <div className="flex gap-2">
                         <button onClick={() => handleDelete(cat.name)} className="px-3 py-1.5 bg-rose-600 text-white text-[10px] font-black uppercase rounded-lg hover:bg-rose-700 transition-all">Delete</button>
                         <button onClick={() => setConfirmDelete(null)} className="px-3 py-1.5 bg-slate-100 text-slate-600 text-[10px] font-black uppercase rounded-lg hover:bg-slate-200 transition-all">Cancel</button>
                       </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-2 h-2 rounded-full ${isSystemCategory(cat.name) ? 'bg-indigo-400' : 'bg-slate-200'}`} />
                        <span className="text-slate-700 text-sm font-bold truncate pr-4">{cat.name}</span>
                        {isSystemCategory(cat.name) && (
                          <Lock className="w-3 h-3 text-slate-300 shrink-0" />
                        )}
                      </div>
                      
                      {!isSystemCategory(cat.name) && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                          <button 
                            onClick={() => startEditing(cat)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                            title="Rename"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setConfirmDelete(cat.name)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* Footer Info */}
        <div className="p-6 bg-slate-50 text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center border-t border-slate-100">
           Renaming categories updates all associated records in Supabase.
        </div>
      </div>
    </div>
  );
};

export default CategoryManager;
