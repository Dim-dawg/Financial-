import { createClient } from '@supabase/supabase-js';
import { Transaction, CategorizationRule, EntityProfile, TransactionType } from '../types';

// Use environment variables or local storage fallbacks
const SUPABASE_URL = process.env.SUPABASE_URL || localStorage.getItem('cf_supabase_url') || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || localStorage.getItem('cf_supabase_key') || '';

export const isSupabaseConfigured = () => !!SUPABASE_URL && !!SUPABASE_ANON_KEY;

const supabase = isSupabaseConfigured() ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

export const saveConfig = (url: string, key: string) => {
  localStorage.setItem('cf_supabase_url', url);
  localStorage.setItem('cf_supabase_key', key);
  window.location.reload(); 
};

/**
 * TRANSACTIONS
 */
export const getTransactions = async (): Promise<Transaction[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }

  return data.map(t => ({
    id: t.id,
    date: t.date,
    description: t.description,
    amount: Number(t.amount),
    type: t.type as TransactionType,
    category: t.category,
    originalDescription: t.original_description,
    documentId: t.document_id
  }));
};

export const upsertTransactions = async (transactions: Transaction[]) => {
  if (!supabase) return;
  const payload = transactions.map(t => ({
    // If ID is a temporary local ID (e.g. starts with 'ai-'), don't send it so Supabase generates a UUID
    ...(t.id.includes('-') && t.id.length > 30 ? { id: t.id } : {}), 
    date: t.date,
    description: t.description,
    amount: t.amount,
    type: t.type,
    category: t.category,
    original_description: t.originalDescription,
    document_id: t.documentId
  }));

  const { error } = await supabase.from('transactions').upsert(payload);
  if (error) throw error;
};

export const deleteTransaction = async (id: string) => {
  if (!supabase) return;
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) throw error;
};

/**
 * RULES
 */
export const getRules = async (): Promise<CategorizationRule[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.from('rules').select('*');
  if (error) return [];
  return data.map(r => ({
    id: r.id,
    keyword: r.keyword,
    targetCategory: r.target_category
  }));
};

export const upsertRule = async (rule: CategorizationRule) => {
  if (!supabase) return;
  const payload = {
    keyword: rule.keyword,
    target_category: rule.targetCategory
  };
  // Only include ID if it's an existing valid UUID
  const { error } = await supabase.from('rules').upsert(rule.id.length > 20 ? { ...payload, id: rule.id } : payload);
  if (error) throw error;
};

export const deleteRule = async (id: string) => {
  if (!supabase) return;
  await supabase.from('rules').delete().eq('id', id);
};

/**
 * PROFILES
 */
export const getProfiles = async (): Promise<EntityProfile[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.from('profiles').select('*');
  if (error) return [];
  return data.map(p => ({
    id: p.id,
    name: p.name,
    type: p.type as 'VENDOR' | 'CLIENT',
    description: p.notes || '',
    tags: [], // Tags not in provided schema
    keywordMatch: '' // keywordMatch not in provided schema
  }));
};

export const upsertProfile = async (profile: EntityProfile) => {
  if (!supabase) return;
  const payload = {
    name: profile.name,
    type: profile.type,
    notes: profile.description
  };
  await supabase.from('profiles').upsert(profile.id.length > 20 ? { ...payload, id: profile.id } : payload);
};

export const deleteProfile = async (id: string) => {
  if (!supabase) return;
  await supabase.from('profiles').delete().eq('id', id);
};

/**
 * CATEGORIES
 */
export const getCategories = async (): Promise<string[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.from('categories').select('name');
  if (error) return [];
  return data.map(c => c.name);
};
