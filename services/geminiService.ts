
import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, TransactionType, DEFAULT_CATEGORIES } from "../types";

const categoriesStr = DEFAULT_CATEGORIES.join(", ");

const SYSTEM_INSTRUCTION = `Expert analyst. Extract transactions from docs to JSON. 
Date (YYYY-MM-DD), Description, Amount (positive), Type (income/expense). 
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
 * Enhanced wrapper that handles retries for rate limits.
 * Adheres to guidelines by using process.env.API_KEY exclusively and directly.
 */
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
    
    // Check for specific error to log key selection issue if billing/project is missing
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
    // Create new GoogleGenAI instance right before making an API call to ensure it uses the up-to-date key.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const mimeType = file.type || 'image/jpeg';
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { 
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: "Extract all transactions into the specified JSON format." }
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
  keywordMatch: string;
  defaultCategory: string;
  sources: { title: string; uri: string }[];
}> => {
  return withRetry(async () => {
    // Create new GoogleGenAI instance right before making an API call.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Using gemini-3-flash-preview for search grounding.
    const searchResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Search for information about "${entityName}". Determine:
      1. What the business does.
      2. If they are a VENDOR or CLIENT.
      3. 3-4 industry tags.
      4. Bank statement keyword.
      5. Which of these categories fits them best: [${categoriesStr}]`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const searchContext = searchResponse.text;
    const chunks = searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = chunks
      .filter((c: any) => !!c.web)
      .map((c: any) => ({
        title: c.web.title || "Reference",
        uri: c.web.uri || "#"
      }));

    const formatResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Based on this research: "${searchContext}", create a JSON profile for "${entityName}".
      Select the best defaultCategory from this list ONLY: [${categoriesStr}].`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            type: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            keywordMatch: { type: Type.STRING },
            defaultCategory: { type: Type.STRING },
          },
          required: ["description", "type", "tags", "keywordMatch", "defaultCategory"]
        }
      },
    });

    const data = JSON.parse(formatResponse.text || "{}");
    return {
      description: data.description || "",
      type: data.type === 'CLIENT' ? 'CLIENT' : 'VENDOR',
      tags: data.tags || [],
      keywordMatch: data.keywordMatch || entityName,
      defaultCategory: data.defaultCategory || "Uncategorized",
      sources
    };
  });
};

export const generateFinancialNarrative = async (summary: any): Promise<string> => {
  return withRetry(async () => {
    // Create new GoogleGenAI instance right before making an API call.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `As a financial analyst, write a Management Discussion and Analysis (MD&A) for a business with the following summary:
    Total Income: $${summary.totalIncome.toFixed(2)}
    Total Expenses: $${summary.totalExpense.toFixed(2)}
    Net Operating Profit: $${summary.netProfit.toFixed(2)}
    Top Operating Expenses: ${summary.topExpenses.join(', ')}
    
    The tone should be professional, insightful, and suitable for a bank loan officer review. 
    Comment on profitability, potential for debt service, and expense control efficiency.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are a senior commercial credit analyst. Provide 3-4 professional paragraphs.",
      }
    });

    return response.text || "Financial narrative could not be generated at this time.";
  });
};
