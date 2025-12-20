
import React, { useState, useMemo } from 'react';
import { Transaction, EntityProfile, TransactionType } from '../types';
import { 
  Users, UserPlus, Search, Tag, History, TrendingUp, 
  ChevronRight, ArrowLeft, Trash2, Edit3, Globe, Briefcase 
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer 
} from 'recharts';

interface EntityProfilesProps {
  transactions: Transaction[];
  profiles: EntityProfile[];
  onAddProfile: (profile: EntityProfile) => void;
  onUpdateProfile: (profile: EntityProfile) => void;
  onDeleteProfile: (id: string) => void;
}

const EntityProfiles: React.FC<EntityProfilesProps> = ({ 
  transactions, 
  profiles, 
  onAddProfile, 
  onUpdateProfile, 
  onDeleteProfile 
}) => {
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // New Profile Form State
  const [formData, setFormData] = useState<Partial<EntityProfile>>({
    name: '', type: 'VENDOR', description: '', tags: [], keywordMatch: ''
  });

  const selectedEntity = useMemo(() => 
    profiles.find(p => p.id === selectedEntityId), 
    [selectedEntityId, profiles]
  );

  const entityTransactions = useMemo(() => {
    if (!selectedEntity) return [];
    return transactions.filter(t => 
      t.description.toLowerCase().includes(selectedEntity.keywordMatch.toLowerCase()) ||
      t.originalDescription?.toLowerCase().includes(selectedEntity.keywordMatch.toLowerCase())
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedEntity, transactions]);

  const chartData = useMemo(() => {
    if (!selectedEntity) return [];
    const monthly: Record<string, number> = {};
    entityTransactions.forEach(t => {
      const month = t.date.substring(0, 7); // YYYY-MM
      monthly[month] = (monthly[month] || 0) + t.amount;
    });
    return Object.entries(monthly)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entityTransactions, selectedEntity]);

  const filteredProfiles = profiles.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSaveProfile = () => {
    if (!formData.name || !formData.keywordMatch) return;
    const newProfile: EntityProfile = {
      id: `ent-${Date.now()}`,
      name: formData.name,
      type: formData.type as 'VENDOR' | 'CLIENT',
      description: formData.description || '',
      tags: formData.tags || [],
      keywordMatch: formData.keywordMatch,
    };
    onAddProfile(newProfile);
    setIsAdding(false);
    setFormData({ name: '', type: 'VENDOR', description: '', tags: [], keywordMatch: '' });
  };

  if (selectedEntity) {
    return (
      <div className="animate-fade-in space-y-6">
        <button 
          onClick={() => setSelectedEntityId(null)}
          className="flex items-center text-slate-500 hover:text-slate-800 transition py-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Profiles
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl ${selectedEntity.type === 'VENDOR' ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'}`}>
                  {selectedEntity.type === 'VENDOR' ? <Briefcase className="w-6 h-6" /> : <Users className="w-6 h-6" />}
                </div>
                <button 
                  onClick={() => { if(confirm('Delete profile?')) { onDeleteProfile(selectedEntity.id); setSelectedEntityId(null); }}}
                  className="text-slate-300 hover:text-rose-500 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <h2 className="text-2xl font-bold text-slate-800">{selectedEntity.name}</h2>
              <p className="text-slate-500 text-sm mt-1">{selectedEntity.description || 'No description provided.'}</p>
              
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedEntity.tags.map(tag => (
                  <span key={tag} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold uppercase tracking-wider">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Total Volume</p>
                  <p className="text-xl font-bold text-slate-800">
                    ${new Intl.NumberFormat('en-US').format(entityTransactions.reduce((s, t) => s + t.amount, 0))}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Tx Count</p>
                  <p className="text-xl font-bold text-slate-800">{entityTransactions.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-800 p-6 rounded-2xl text-white">
              <h4 className="text-sm font-bold opacity-70 mb-2 uppercase">Matching Logic</h4>
              <p className="text-xs opacity-90 leading-relaxed">
                Transactions containing "<span className="font-bold underline">{selectedEntity.keywordMatch}</span>" are automatically associated with this profile.
              </p>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-blue-500" /> Activity Trend
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} style={{ fontSize: '10px' }} />
                    <YAxis axisLine={false} tickLine={false} style={{ fontSize: '10px' }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    />
                    <Line type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-800 flex items-center">
                  <History className="w-5 h-5 mr-2 text-slate-400" /> Transaction History
                </h3>
              </div>
              <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
                {entityTransactions.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-sm">No transactions linked yet.</div>
                ) : (
                  entityTransactions.map(t => (
                    <div key={t.id} className="px-6 py-4 flex justify-between items-center hover:bg-slate-50 transition">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{t.description}</p>
                        <p className="text-[10px] text-slate-400">{t.date} • {t.category}</p>
                      </div>
                      <p className={`font-bold ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-slate-800'}`}>
                        {t.type === TransactionType.INCOME ? '+' : ''}${t.amount.toFixed(2)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Entities</h2>
          <p className="text-slate-500 text-sm">Manage your relationships with vendors and clients.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by name or tag..."
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 outline-none w-64"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition shadow-sm shadow-blue-200"
          >
            <UserPlus className="w-4 h-4 mr-2" /> Add Profile
          </button>
        </div>
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-blue-100 animate-slide-up">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Create New Profile</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Entity Name</label>
                <input 
                  type="text" 
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" 
                  placeholder="e.g. AWS Cloud Services" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Entity Type</label>
                <select 
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                  value={formData.type}
                  onChange={e => setFormData({...formData, type: e.target.value as any})}
                >
                  <option value="VENDOR">Vendor (Payable)</option>
                  <option value="CLIENT">Client (Receivable)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Sync Keyword</label>
                <input 
                  type="text" 
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono" 
                  placeholder="The text that appears in bank records" 
                  value={formData.keywordMatch}
                  onChange={e => setFormData({...formData, keywordMatch: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Description</label>
                <textarea 
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm h-28" 
                  placeholder="What does this company do?"
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Tags (Comma Separated)</label>
                <input 
                  type="text" 
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" 
                  placeholder="Software, Monthly, Vital..." 
                  onChange={e => setFormData({...formData, tags: e.target.value.split(',').map(s => s.trim()).filter(s => s)})}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setIsAdding(false)} className="px-6 py-2 text-slate-500 font-bold text-sm">Cancel</button>
            <button 
              onClick={handleSaveProfile} 
              disabled={!formData.name || !formData.keywordMatch}
              className="px-8 py-2 bg-slate-800 text-white rounded-lg font-bold text-sm hover:bg-slate-900 disabled:opacity-30"
            >
              Save Profile
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProfiles.length === 0 ? (
          <div className="col-span-full py-20 text-center text-slate-400 flex flex-col items-center">
             <Users className="w-12 h-12 mb-4 opacity-20" />
             <p>No entity profiles found. Create your first one to see insights.</p>
          </div>
        ) : (
          filteredProfiles.map(p => (
            <div 
              key={p.id} 
              onClick={() => setSelectedEntityId(p.id)}
              className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:border-blue-300 transition group cursor-pointer"
            >
              <div className="flex justify-between items-start mb-4">
                <div className={`p-2.5 rounded-xl ${p.type === 'VENDOR' ? 'bg-orange-50 text-orange-500' : 'bg-emerald-50 text-emerald-500'}`}>
                  {p.type === 'VENDOR' ? <Briefcase className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">{p.name}</h3>
              <p className="text-slate-400 text-xs mt-1 line-clamp-2">{p.description || 'No description provided.'}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {p.tags.slice(0, 3).map(tag => (
                  <span key={tag} className="px-2 py-0.5 bg-slate-50 text-slate-400 rounded text-[9px] font-bold uppercase tracking-wider">
                    {tag}
                  </span>
                ))}
                {p.tags.length > 3 && <span className="text-[9px] text-slate-300 font-bold">+{p.tags.length - 3}</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default EntityProfiles;
