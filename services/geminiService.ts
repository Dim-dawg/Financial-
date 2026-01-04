
import { Transaction, TransactionType, DEFAULT_CATEGORIES } from "../types";

const categoriesStr = DEFAULT_CATEGORIES.join(", ");

const SYSTEM_INSTRUCTION = `Act as a Data Normalization Engine. Your task is to process bank statement transactions and group them by identifying the core "Merchant Entity" or "Income Source" within the raw text.

### OBJECTIVE:
Group transactions that are functionally the same, even if the raw description has minor variations (dates, transaction IDs, or bank codes).

### STRICT MATCHING RULES:
1. STRIP VARIABLE NOISE: Ignore unique identifiers like "A 9202820", "IFT INC BB", "TRSF", or specific dates/times.
2. GROUPING PRIORITY: If two descriptions share the same 4-5 leading words or the same unique brand name (e.g., "Atlantic Bank", "Dimitri Camron"), they MUST be assigned the exact same 'cleaned_description'.
3. EXACT MATCHING: If the user says "same description," ensure the 'cleaned_description' is character-for-character identical for recurring vendors.
4. CATEGORIZATION: Use conservative categories. Do not guess. If it says "Transfer," categorize as 'Internal Transfer' unless a specific vendor is clear.

### JSON OUTPUT SCHEMA:
Return only a JSON array of objects:
{
  "date": "YYYY-MM-DD",
  "original_description": "Full raw text",
  "cleaned_description": "The normalized entity name (e.g., 'Atlantic Bank' instead of 'Atlantic Bank A/C 123')",
  "amount": number,
  "category": "Accounting Category",
  "is_recurring": boolean
}`;

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
      description: item.cleaned_description,
      amount: Math.abs(item.amount),
      type: item.amount >= 0 ? TransactionType.INCOME : TransactionType.EXPENSE,
      category: item.category,
      originalDescription: item.original_description,
      is_recurring: item.is_recurring,
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
