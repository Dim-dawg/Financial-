
import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, TransactionType, DEFAULT_CATEGORIES } from "../types";

const categoriesStr = DEFAULT_CATEGORIES.join(", ");

const SYSTEM_INSTRUCTION = `Expert analyst. Extract transactions from docs to JSON. 
Date (YYYY-MM-DD), Description, Amount (positive), Type (INCOME/EXPENSE). 
Categories ONLY from: [${categoriesStr}]. Guess logically (e.g., Starbucks=Meals).`;

const RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      date: { type: Type.STRING },
      description: { type: Type.STRING },
      amount: { type: Type.NUMBER },
      type: { type: Type.STRING },
      category: { type: Type.STRING },
    },
    required: ["date", "description", "amount", "type", "category"],
  },
};

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

/**
 * Executes an AI task with retry logic to handle rate limits gracefully.
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 2, baseDelay = 4000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const errorMsg = error.message?.toLowerCase() || "";
    
    // Check for specific Gemini errors
    const isRateLimit = error.message?.includes('429') || errorMsg.includes('rate limit');
    const isEntityNotFound = errorMsg.includes('requested entity was not found');
    const isForbidden = error.message?.includes('403') || errorMsg.includes('permission denied');

    if (isEntityNotFound) {
      throw new Error("ENTITY_NOT_FOUND");
    }

    if (retries > 0 && (isRateLimit || isForbidden)) {
      console.warn(`API bottleneck, retrying in ${baseDelay}ms...`);
      await delay(baseDelay);
      return withRetry(fn, retries - 1, baseDelay * 2);
    }
    
    if (isRateLimit) throw new Error("RATE_LIMIT_EXCEEDED");
    if (isForbidden) throw new Error("FORBIDDEN_ACCESS");

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
    // Create new instance to ensure latest key is used
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const mimeType = file.type || 'image/jpeg';
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { 
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: "Extract all transactions to JSON schema." }
        ] 
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    const jsonStr = response.text;
    if (!jsonStr) throw new Error("Empty response from model");

    const rawData = JSON.parse(jsonStr);
    return rawData.map((item: any) => ({
      id: `ai-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      date: item.date,
      description: item.description,
      amount: Math.abs(item.amount),
      type: item.type === 'INCOME' ? TransactionType.INCOME : TransactionType.EXPENSE,
      category: item.category,
      originalDescription: item.description,
    }));
  });
};
