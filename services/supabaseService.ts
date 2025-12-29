
import { createClient } from '@supabase/supabase-js';
import { Transaction, CategorizationRule, EntityProfile, TransactionType, TransactionFilter, Category } from '../types';

const SUPABASE_URL = () => localStorage.getItem('cf_supabase_url') || '';
const SUPABASE_ANON_KEY = () => localStorage.getItem('cf_supabase_key') || '';

export const isSupabaseConfigured = () => !!SUPABASE_URL() && !!SUPABASE_ANON_KEY();

let supabaseClient: any = null;
let lastUsedUrl = '';
let lastUsedKey = '';

export const getSupabaseClient = (urlOverride?: string, keyOverride?: string) => {
  const url = urlOverride || SUPABASE_URL();
  const key = keyOverride || SUPABASE_ANON_KEY();
  
  if (!url || !key) return null;

  if (!supabaseClient || url !== lastUsedUrl || key !== lastUsedKey) {
    supabaseClient = createClient(url, key);
    lastUsedUrl = url;
    lastUsedKey = key;
  }
  return supabaseClient;
};

export const testConnection = async (url: string, key: string): Promise<boolean> => {
  try {
    const tempClient = createClient(url, key);
    // Simple query to verify connection
    const { error } = await tempClient.from('categories').select('id').limit(1);
    if (error && error.code !== 'PGRST116') return false; 
    return true;
  } catch (e) {
    return false;
  }
};

export const saveConfig = (url: string, key: string) => {
  localStorage.setItem('cf_supabase_url', url);
  localStorage.setItem('cf_supabase_key', key);
};

const safeExtract = (field: any, key: string): string => {
  if (!field) return '';
  if (Array.isArray(field)) return field[0]?.[key] || '';
  if (typeof field === 'object') return field[key] || '';
  return String(field);
};

async function resolveIds(table: string, names: string[], defaultValues: any = {}): Promise<Record<string, string>> {
  const client = getSupabaseClient();
  if (!client || names.length === 0) return {};

  const cleanNames = Array.from(new Set(names.filter(n => typeof n === 'string' && n.length > 0)));
  const { data: existing } = await client.from(table).select('id, name').in('name', cleanNames);
  const nameToId: Record<string, string> = {};
  existing?.forEach((row: any) => nameToId[row.name] = row.id);

  const missing = cleanNames.filter(n => !nameToId[n]);
  if (missing.length > 0) {
    const { data: created, error } = await client.from(table).insert(
      missing.map(name => ({ name, ...defaultValues }))
    ).select('id, name');
    if (!error && created) created.forEach((row: any) => nameToId[row.name] = row.id);
  }
  return nameToId;
}

export const getTransactions = async (filters?: TransactionFilter): Promise<Transaction[]> => {
  const client = getSupabaseClient();
  if (!client) return [];
  
  const PAGE_SIZE = 1000;
  let allData: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = client
      .from('transactions')
      .select('*, categories(id, name), profiles(id, name)')
      .range(from, from + PAGE_SIZE - 1)
      .order('date', { ascending: false });

    if (filters) {
      if (filters.startDate) query = query.gte('date', filters.startDate);
      if (filters.endDate) query = query.lte('date', filters.endDate);
      if (filters.category && filters.category !== '') {
        query = query.filter('categories.name', 'eq', filters.category);
      }
      if (filters.search?.trim()) query = query.ilike('description', `%${filters.search.trim()}%`);
      if (filters.minAmount !== '') query = query.gte('amount', parseFloat(filters.minAmount));
      if (filters.maxAmount !== '') query = query.lte('amount', parseFloat(filters.maxAmount));
    }

    const { data, error } = await query;
    if (error) break;
    if (data && data.length > 0) {
      allData = [...allData, ...data];
      hasMore = data.length === PAGE_SIZE;
      from += PAGE_SIZE;
    } else hasMore = false;
  }

  return allData.map(t => ({
    id: t.id,
    date: t.date,
    description: String(t.description || 'No Description'),
    amount: parseFloat(t.amount || 0),
    type: (t.type as TransactionType) || TransactionType.EXPENSE,
    category: safeExtract(t.categories, 'name') || 'Uncategorized',
    categoryId: t.category_id,
    originalDescription: String(t.original_description || t.description || ''),
    documentId: t.document_id,
    entityId: t.profile_id || undefined,
    entityName: safeExtract(t.profiles, 'name') || undefined
  }));
};

export const getTransactionsTotalInDb = async (): Promise<number> => {
  const client = getSupabaseClient();
  if (!client) return 0;
  const { count, error } = await client.from('transactions').select('*', { count: 'exact', head: true });
  return error ? 0 : (count || 0);
};

export const upsertTransactions = async (transactions: Transaction[]) => {
  const client = getSupabaseClient();
  if (!client) return;

  const categoryMap = await resolveIds('categories', transactions.map(t => t.category || 'Uncategorized'));
  
  const payload = transactions.map(t => {
    const row: any = {
      date: t.date,
      description: t.description || 'Untitled',
      amount: t.amount, 
      type: t.type.toLowerCase(), 
      category_id: t.categoryId || categoryMap[t.category || 'Uncategorized'],
      profile_id: t.entityId || null,
      original_description: t.originalDescription || t.description,
      document_id: t.documentId
    };
    if (t.id && !t.id.startsWith('ai-') && !t.id.startsWith('doc-')) row.id = t.id;
    return row;
  });

  const { error } = await client.from('transactions').upsert(payload, { onConflict: 'id' });
  if (error) throw error;
};

export const deleteTransaction = async (id: string) => {
  const client = getSupabaseClient();
  if (!client) return;
  const { error } = await client.from('transactions').delete().eq('id', id);
  if (error) throw error;
};

export const deleteTransactions = async (ids: string[]) => {
  const client = getSupabaseClient();
  if (!client) return;
  const { error } = await client.from('transactions').delete().in('id', ids);
  if (error) throw error;
};

export const getProfiles = async (): Promise<EntityProfile[]> => {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data } = await client.from('profiles').select('*, categories(name)');
  return (data || []).map(p => ({
    id: p.id,
    name: String(p.name || ''),
    type: (p.type?.toUpperCase() === 'CLIENT' ? 'CLIENT' : 'VENDOR') as 'VENDOR' | 'CLIENT',
    description: String(p.notes || ''),
    tags: p.address?.split('|')[0]?.split(',') || [], 
    keywordMatch: p.address?.split('|')[1] || p.name,
    defaultCategoryId: p.default_category_id,
    defaultCategory: safeExtract(p.categories, 'name') || 'Uncategorized'
  }));
};

export const upsertProfile = async (profile: Partial<EntityProfile>) => {
  const client = getSupabaseClient();
  if (!client) return;
  
  const payload: any = { 
    name: profile.name, 
    type: profile.type?.toLowerCase(), 
    notes: profile.description,
    address: `${profile.tags?.join(',')}|${profile.keywordMatch}|${profile.defaultCategoryId}`,
    default_category_id: profile.defaultCategoryId
  };
  
  if (profile.id) payload.id = profile.id;
  
  const { data, error } = await client.from('profiles').upsert(payload, { onConflict: 'id' }).select('*, categories(name)');
  if (error) throw error;
  
  const p = data?.[0];
  if (!p) return null;

  return {
    id: p.id,
    name: String(p.name || ''),
    type: (p.type?.toUpperCase() === 'CLIENT' ? 'CLIENT' : 'VENDOR') as 'VENDOR' | 'CLIENT',
    description: String(p.notes || ''),
    tags: p.address?.split('|')[0]?.split(',') || [], 
    keywordMatch: p.address?.split('|')[1] || p.name,
    defaultCategoryId: p.default_category_id,
    defaultCategory: safeExtract(p.categories, 'name') || 'Uncategorized'
  };
};

export const deleteProfile = async (id: string) => {
  const client = getSupabaseClient();
  if (!client) return;
  // Nullify transactions first to avoid constraint issues
  await client.from('transactions').update({ profile_id: null }).eq('profile_id', id);
  const { error } = await client.from('profiles').delete().eq('id', id);
  if (error) throw error;
};

export const bulkApplyProfileRule = async (keyword: string, profileId: string, categoryId: string) => {
  const client = getSupabaseClient();
  if (!client) return;
  const { error } = await client.from('transactions')
    .update({ profile_id: profileId, category_id: categoryId })
    .ilike('description', `%${keyword}%`);
  if (error) throw error;
};

export const getRules = async () => {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data } = await client.from('rules').select('*, categories(name)');
  return (data || []).map(r => ({ 
    id: r.id, 
    keyword: r.keyword, 
    targetCategory: safeExtract(r.categories, 'name') || 'Uncategorized',
    targetCategoryId: r.category_id
  }));
};

export const upsertRule = async (rule: CategorizationRule) => {
  const client = getSupabaseClient();
  if (!client) return;
  const payload: any = { keyword: rule.keyword, category_id: rule.targetCategoryId };
  if (rule.id && !rule.id.startsWith('rule-')) payload.id = rule.id;
  const { error } = await client.from('rules').upsert(payload, { onConflict: 'keyword' });
  if (error) throw error;
};

export const deleteRule = async (id: string) => {
  const client = getSupabaseClient();
  if (!client) return;
  const { error } = await client.from('rules').delete().eq('id', id);
  if (error) throw error;
};

export const getCategories = async (): Promise<Category[]> => {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data } = await client.from('categories').select('id, name').order('name');
  return data || [];
};

export const upsertCategory = async (name: string) => {
  const client = getSupabaseClient();
  if (!client) return;
  const { error } = await client.from('categories').upsert({ name }, { onConflict: 'name' });
  if (error) throw error;
};

export const deleteCategory = async (name: string) => {
  const client = getSupabaseClient();
  if (!client) return;
  const { error } = await client.from('categories').delete().eq('name', name);
  if (error) throw error;
};

export const bulkUpdateTransactionCategory = async (oldName: string, newName: string) => {
  const client = getSupabaseClient();
  if (!client) return;
  const { data: oldCat } = await client.from('categories').select('id').eq('name', oldName).maybeSingle();
  const { data: newCat } = await client.from('categories').select('id').eq('name', newName).maybeSingle();
  if (oldCat && newCat) {
    const { error } = await client.from('transactions').update({ category_id: newCat.id }).eq('category_id', oldCat.id);
    if (error) throw error;
  }
};
