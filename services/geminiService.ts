
import { Transaction, TransactionType, DEFAULT_CATEGORIES } from "../types";

const categoriesStr = DEFAULT_CATEGORIES.join(", ");

const SYSTEM_INSTRUCTION = `Expert financial analyst. Extract transactions from bank statements/receipts to JSON. 
Date (YYYY-MM-DD), Description, Amount (positive), Type (income/expense). 
Categories ONLY from: [${categoriesStr}]. 

CRITICAL: If a transaction looks like a significant asset purchase (e.g., "New Computer", "Truck", "Machinery") or a loan/debt activity (e.g., "SBA Loan", "Mortgage Pay"), categorize it into the most specific Asset or Liability category available. Guess logically based on typical business operations.`;

// Helper: proxy all Gemini calls via Netlify Function
const callGeminiProxy = async (body: any) => {
  const res = await fetch('/.netlify/functions/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Gemini proxy error: ${res.status} ${text}`);
  }
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
};


const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function withRetry<T>(fn: () => Promise<T>, retries = 2, baseDelay = 3000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const errorMsg = error.message?.toLowerCase() || "";
    const isRateLimit = error.status === 429 || error.message?.includes('429') || errorMsg.includes('rate limit') || errorMsg.includes('quota');

    if (retries > 0 && isRateLimit) {
      await delay(baseDelay);
      return withRetry(fn, retries - 1, baseDelay * 2);
    }
    
    if (errorMsg.includes("requested entity was not found")) {
      console.error("Cipher Finance: API key selection issue or project configuration error.");
    }
    
    throw error;
  }
}

export const readFileAsBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      } else {
        reject(new Error("Failed to read file"));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
};

export const parseDocumentWithGemini = async (
  file: File, 
  base64Data: string
): Promise<Transaction[]> => {
  return withRetry(async () => {
    const mimeType = file.type || 'image/jpeg';
    const response = await callGeminiProxy({
      action: 'parseDocument',
      file: { mimeType, base64: base64Data },
      systemInstruction: SYSTEM_INSTRUCTION,
    });

    const rawData = response.data;
    if (!rawData) throw new Error('Empty response from model');

    return rawData.map((item: any) => ({
      id: `ai-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      date: item.date,
      description: item.description,
      amount: Math.abs(item.amount),
      type: item.type?.toLowerCase() === 'income' ? TransactionType.INCOME : TransactionType.EXPENSE,
      category: item.category,
      originalDescription: item.description,
    }));
  });
};


export const autoFillProfileData = async (entityName: string): Promise<{
  description: string;
  type: 'VENDOR' | 'CLIENT';
  tags: string[];
  keywords: string[];
  defaultCategory: string;
  sources: { title: string; uri: string }[];
}> => {
  return withRetry(async () => {
    const response = await callGeminiProxy({ action: 'autoFill', entityName, categories: categoriesStr });
    const data = response.data || {};
    return {
      description: data.description || "",
      type: data.type === 'CLIENT' ? 'CLIENT' : 'VENDOR',
      tags: data.tags || [],
      keywords: data.keywords || [entityName],
      defaultCategory: data.defaultCategory || "Uncategorized",
      sources: data.sources || []
    };
  });
};


export const generateFinancialNarrative = async (summary: any): Promise<string> => {
  return withRetry(async () => {
    const response = await callGeminiProxy({ action: 'generateNarrative', summary });
    return response.text || "Financial narrative could not be generated at this time.";
  });
};
