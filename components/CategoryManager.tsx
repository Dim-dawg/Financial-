import React, { useState } from 'react';
import { X, Plus, Edit2, Trash2, Check, Save } from 'lucide-react';

interface CategoryManagerProps {
  isOpen: boolean;
  onClose: () => void;
  categories: string[];
  onAdd: (category: string) => void;
  onRename: (oldName: string, newName: string) => void;
  onDelete: (category: string) => void;
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
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  if (!isOpen) return null;

  const handleAdd = () => {
    if (newCategory.trim()) {
      onAdd(newCategory.trim());
      setNewCategory('');
    }
  };

  const startEditing = (category: string) => {
    setEditingCategory(category);
    setEditValue(category);
  };

  const saveEdit = () => {
    if (editingCategory && editValue.trim() && editValue !== editingCategory) {
      onRename(editingCategory, editValue.trim());
    }
    setEditingCategory(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    setEditingCategory(null);
    setEditValue('');
  };

  const isSystemCategory = (cat: string) => cat === 'Uncategorized';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800 text-lg">Manage Categories</h3>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Add New Section */}
        <div className="p-4 border-b border-slate-100 bg-white">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="New category name..."
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <button
              onClick={handleAdd}
              disabled={!newCategory.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center"
            >
              <Plus className="w-4 h-4 mr-1" /> Add
            </button>
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 p-2 space-y-1">
          {categories.map((cat) => (
            <div 
              key={cat} 
              className={`flex items-center justify-between p-3 rounded-lg group ${
                editingCategory === cat ? 'bg-blue-50' : 'hover:bg-slate-50'
              }`}
            >
              {editingCategory === cat ? (
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="text"
                    autoFocus
                    className="flex-1 px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit();
                      if (e.key === 'Escape') cancelEdit();
                    }}
                  />
                  <button onClick={saveEdit} className="text-emerald-600 hover:bg-emerald-100 p-1.5 rounded">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={cancelEdit} className="text-slate-500 hover:bg-slate-200 p-1.5 rounded">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <span className="text-slate-700 text-sm font-medium pl-1">{cat}</span>
                  {!isSystemCategory(cat) && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => startEditing(cat)}
                        className="text-slate-400 hover:text-blue-600 p-1.5 rounded hover:bg-blue-50 transition-colors"
                        title="Rename"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => onDelete(cat)}
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded hover:bg-rose-50 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
        
        <div className="p-4 bg-slate-50 text-xs text-slate-500 text-center border-t border-slate-100">
           Renaming a category will update all linked transactions and rules.
        </div>
      </div>
    </div>
  );
};

export default CategoryManager;