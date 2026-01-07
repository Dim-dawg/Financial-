
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
    // IMPORTANT: When filtering by a related table (category), we MUST use !inner join.
    // We try to select category name via join, but handle failures gracefully if possible.
    const isCategoryFilter = filters?.category && filters.category !== '';
    const selectStr = isCategoryFilter 
        ? '*, categories!inner(id, name), profiles(id, name)' 
        : '*, categories(id, name), profiles(id, name)';

    let query = client
      .from('transactions')
      .select(selectStr)
      .range(from, from + PAGE_SIZE - 1)
      .order('date', { ascending: false });

    if (filters) {
      if (filters.startDate) query = query.gte('date', filters.startDate);
      if (filters.endDate) query = query.lte('date', filters.endDate);
      
      if (isCategoryFilter) {
        query = query.eq('categories.name', filters.category);
      }
      
      if (filters.search?.trim()) query = query.ilike('description', `%${filters.search.trim()}%`);
      if (filters.minAmount !== '') query = query.gte('amount', parseFloat(filters.minAmount));
      if (filters.maxAmount !== '') query = query.lte('amount', parseFloat(filters.maxAmount));
    }

    const { data, error } = await query;
    if (error) {
      console.error("Query Error:", error);
      break;
    }
    
    if (data && data.length > 0) {
      allData = [...allData, ...data];
      hasMore = data.length === PAGE_SIZE;
      from += PAGE_SIZE;
    } else {
      hasMore = false;
    }
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
  
  // NOTE: We do not join 'categories' here because the user schema might lack 'category_id' on profiles.
  // We rely on the 'address' field hack for storage and client-side ID lookup for names.
  const { data } = await client.from('profiles').select('*');
  
  return (data || []).map(p => {
    // Legacy support: We use 'address' field to store: tags|keywords|category_id
    const packed = p.address || '';
    const parts = packed.split('|');
    const tags = parts[0] ? parts[0].split(',').filter((s: string) => s) : [];
    const keywords = parts[1] ? parts[1].split(',').filter((s: string) => s) : [p.name];
    const storedCatId = parts[2] || undefined;

    return {
      id: p.id,
      name: String(p.name || ''),
      type: (p.type?.toUpperCase() === 'CLIENT' ? 'CLIENT' : 'VENDOR') as 'VENDOR' | 'CLIENT',
      description: String(p.notes || ''),
      tags,
      keywords,
      defaultCategoryId: p.category_id || storedCatId, // Prefer real column if exists, else packed
      defaultCategory: '', // Resolved in UI
    };
  });
};

export const upsertProfile = async (profile: EntityProfile): Promise<EntityProfile | null> => {
  const client = getSupabaseClient();
  if (!client) return null;

  // Pack tags, keywords, AND categoryId into address field: tags|keywords|catId
  const tagsStr = (profile.tags || []).join(',');
  const keywordsStr = (profile.keywords || []).join(',');
  const catId = profile.defaultCategoryId || '';
  const packedAddress = `${tagsStr}|${keywordsStr}|${catId}`;

  const row = {
    name: profile.name,
    type: profile.type.toLowerCase(),
    notes: profile.description,
    address: packedAddress, 
    // We DO NOT send category_id to DB to avoid "Column not found" error
  };

  let result;
  
  const isRealId = profile.id && !profile.id.startsWith('prof-');

  if (isRealId) {
    result = await client.from('profiles').update(row).eq('id', profile.id).select('*').single();
  } else {
    // Check for collision by name to avoid unique constraint errors
    const { data: existing } = await client.from('profiles').select('id').eq('name', profile.name).maybeSingle();
    
    if (existing) {
        result = await client.from('profiles').update(row).eq('id', existing.id).select('*').single();
    } else {
        result = await client.from('profiles').insert(row).select('*').single();
    }
  }

  if (result.error || !result.data) {
    console.error("Profile Upsert Error", JSON.stringify(result.error));
    return null;
  }

  const p = result.data;
  const parts = (p.address || '').split('|');
  const storedCatId = parts[2] || undefined;
  
  return {
    id: p.id,
    name: p.name,
    type: (p.type?.toUpperCase() === 'CLIENT' ? 'CLIENT' : 'VENDOR'),
    description: p.notes,
    tags: parts[0] ? parts[0].split(',') : [],
    keywords: parts[1] ? parts[1].split(',') : [p.name],
    defaultCategoryId: p.category_id || storedCatId,
    defaultCategory: '', 
  };
};

export const deleteProfile = async (id: string) => {
  const client = getSupabaseClient();
  if (!client) return;
  // First unlink transactions
  await client.from('transactions').update({ profile_id: null }).eq('profile_id', id);
  // Then delete profile
  await client.from('profiles').delete().eq('id', id);
};

export const bulkApplyProfileRule = async (keywords: string[], profileId: string, categoryId: string) => {
  const client = getSupabaseClient();
  if (!client || !keywords || keywords.length === 0) return;

  // 1. Get all transactions that don't have a profile assigned
  const { data: unassigned, error } = await client
    .from('transactions')
    .select('id, description')
    .is('profile_id', null);

  if (error || !unassigned || unassigned.length === 0) return;

  // 2. Client-side matching to support "Longest Match Priority"
  const sortedKeywords = [...keywords].sort((a, b) => b.length - a.length);
  const matchedIds: string[] = [];

  unassigned.forEach(t => {
    const desc = (t.description || '').toLowerCase();
    const isMatch = sortedKeywords.some(k => desc.includes(k.toLowerCase()));
    if (isMatch) {
      matchedIds.push(t.id);
    }
  });

  if (matchedIds.length === 0) return;

  // 3. Update matches in chunks
  const chunkSize = 500;
  for (let i = 0; i < matchedIds.length; i += chunkSize) {
    const chunk = matchedIds.slice(i, i + chunkSize);
    // Transactions table DOES have category_id, so we can update it safely here
    await client
      .from('transactions')
      .update({ profile_id: profileId, category_id: categoryId })
      .in('id', chunk);
  }
};

export const getRules = async (): Promise<CategorizationRule[]> => {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data } = await client.from('rules').select('*, categories(name)');
  return (data || []).map(r => ({
    id: r.id,
    keyword: r.keyword,
    targetCategory: safeExtract(r.categories, 'name'),
    targetCategoryId: r.target_category,
    targetType: r.target_type ? r.target_type.toUpperCase() as TransactionType : undefined
  }));
};

export const getCategories = async (): Promise<Category[]> => {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data } = await client.from('categories').select('*').order('name');
  return (data || []).map(c => ({
    id: c.id,
    name: c.name,
    accountType: c.account_type 
  }));
};

export const upsertCategory = async (name: string) => {
  const client = getSupabaseClient();
  if (!client) return;
  await client.from('categories').upsert({ name }, { onConflict: 'name' });
};

export const deleteCategory = async (name: string) => {
  const client = getSupabaseClient();
  if (!client) return;
  const { data } = await client.from('categories').select('id').eq('name', name).single();
  if (data) {
     await client.from('transactions').update({ category_id: null }).eq('category_id', data.id);
     await client.from('categories').delete().eq('id', data.id);
  }
};

export const bulkUpdateTransactionCategory = async (oldName: string, newName: string) => {
    const client = getSupabaseClient();
    if(!client) return;
    
    // 1. Ensure new category exists
    const { data: newCat } = await client.from('categories').upsert({ name: newName }, { onConflict: 'name' }).select('id').single();
    if (!newCat) return;

    // 2. Find old category ID
    const { data: oldCat } = await client.from('categories').select('id').eq('name', oldName).single();
    if (!oldCat) return;

    // 3. Move transactions
    await client.from('transactions').update({ category_id: newCat.id }).eq('category_id', oldCat.id);
};
