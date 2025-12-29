
import React, { useState } from 'react';
import { X, Database, Link, ShieldCheck, AlertCircle, Loader2, Save, ExternalLink } from 'lucide-react';
import { saveConfig, testConnection } from '../services/supabaseService';

interface DatabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const DatabaseConfigModal: React.FC<DatabaseConfigModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [url, setUrl] = useState(localStorage.getItem('cf_supabase_url') || '');
  const [key, setKey] = useState(localStorage.getItem('cf_supabase_key') || '');
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleTestAndSave = async () => {
    setStatus('testing');
    const isConnected = await testConnection(url, key);
    
    if (isConnected) {
      saveConfig(url, key);
      setStatus('success');
      setTimeout(() => {
        onSuccess();
        onClose();
        setStatus('idle');
      }, 1500);
    } else {
      setStatus('error');
      setErrorMessage('Could not connect to Supabase. Check your URL and Key.');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-up border border-slate-100">
        <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 tracking-tight">Vault Connection</h3>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Supabase Setup</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-300 hover:text-slate-600 transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-start gap-3">
             <AlertCircle className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
             <p className="text-xs text-slate-500 leading-relaxed font-medium">
               Cipher Finance uses Supabase for cloud-scale storage. Find your credentials in <span className="font-bold text-slate-700">Settings > API</span>.
             </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Project URL</label>
              <input 
                type="text" 
                placeholder="https://xyz.supabase.co" 
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none"
                value={url}
                onChange={e => setUrl(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Anon Public Key</label>
              <input 
                type="password" 
                placeholder="eyJh..." 
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none"
                value={key}
                onChange={e => setKey(e.target.value)}
              />
            </div>
          </div>

          {status === 'error' && (
            <div className="bg-rose-50 text-rose-600 p-3 rounded-xl text-[10px] font-black uppercase tracking-tight flex items-center gap-2 border border-rose-100">
               <AlertCircle className="w-4 h-4" /> {errorMessage}
            </div>
          )}

          {status === 'success' && (
            <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl text-[10px] font-black uppercase tracking-tight flex items-center gap-2 border border-emerald-100">
               <ShieldCheck className="w-4 h-4" /> Connection Verified!
            </div>
          )}

          <div className="flex flex-col gap-3">
            <button 
              onClick={handleTestAndSave}
              disabled={!url || !key || status === 'testing'}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-slate-800 transition active:scale-95 disabled:opacity-30 flex items-center justify-center"
            >
              {status === 'testing' ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Link className="w-5 h-5 mr-2" />}
              {status === 'testing' ? 'Connecting...' : 'Test & Sync Vault'}
            </button>
            <a 
              href="https://supabase.com/dashboard" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-center text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center justify-center gap-1 py-2"
            >
              Open Supabase Dashboard <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatabaseConfigModal;
