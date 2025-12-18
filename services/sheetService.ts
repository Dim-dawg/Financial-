import { Transaction, CategorizationRule, SheetUser, TransactionType } from "../types";

const callScript = async (url: string, payload: any) => {
  try {
    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Sheet API Error:", error);
    throw new Error("Failed to communicate with Google Sheet script.");
  }
};

export const connectToSheet = async (url: string): Promise<SheetUser> => {
  const email = localStorage.getItem('cf_user_email') || "user@cipherfinance.ai";
  const password = "default_password";

  let result = await callScript(url, {
    action: "login",
    email,
    password
  });

  if (result.success && result.user) {
    return result.user;
  }

  result = await callScript(url, {
    action: "register",
    email,
    password,
    name: "Business Owner"
  });

  if (result.success && result.user) {
    return result.user;
  }

  throw new Error(result.error || "Could not login or register to Sheet.");
};

export const saveTransactionsToSheet = async (url: string, userId: string, transactions: Transaction[]) => {
  const payload = {
    action: "saveTransactions",
    userId,
    transactions: transactions.map(t => ({
      transaction_id: t.id,
      date: t.date,
      description: t.description,
      amount: t.amount,
      category: t.category,
      type: t.type,
      notes: "Synced via Cipher Finance"
    }))
  };

  const result = await callScript(url, payload);
  if (!result.success) throw new Error(result.error || "Failed to save transactions.");
  return result;
};

export const saveRulesToSheet = async (url: string, userId: string, rules: CategorizationRule[]) => {
  const payload = {
    action: "saveRules",
    userId,
    rules: rules.map(r => ({
      rule_id: r.id,
      keyword: r.keyword,
      category: r.targetCategory
    }))
  };

  const result = await callScript(url, payload);
  return result;
};

export const fetchTransactionsFromSheet = async (url: string, userId: string): Promise<Transaction[]> => {
  const result = await callScript(url, {
    action: "getTransactions",
    userId
  });

  if (!result.success) return [];

  return result.data.map((t: any) => ({
    id: t.transaction_id || `sheet-${Date.now()}-${Math.random()}`,
    date: t.date,
    description: t.description,
    amount: Number(t.amount),
    type: t.type as TransactionType,
    category: t.category,
    originalDescription: t.description
  }));
};

export const fetchRulesFromSheet = async (url: string, userId: string): Promise<CategorizationRule[]> => {
  const result = await callScript(url, {
    action: "getRules",
    userId
  });

  if (!result.success) return [];

  return result.data.map((r: any) => ({
    id: r.rule_id || `rule-${Math.random()}`,
    keyword: r.keyword,
    targetCategory: r.category
  }));
};