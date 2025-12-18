
import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, TransactionType, DEFAULT_CATEGORIES } from "../types";

// Initialize the Google GenAI SDK with the API key from environment variables
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const categoriesStr = DEFAULT_CATEGORIES.join(", ");

const SYSTEM_INSTRUCTION = `
You are an expert financial analyst at Cipher Finance. 
Your task is to extract transaction data from bank statements (images, PDFs, or CSV text) for business financial reporting.
Normalize all data into a JSON structure.

Rules:
1. Extract the Date, Description, and Amount for every transaction.
2. Determine if it is an INCOME (Credit/Deposit) or EXPENSE (Debit/Withdrawal).
3. Assign a business category based on the description. You MUST choose the best fit from this exact list: [${categoriesStr}].
4. Infer the category if it is not obvious (e.g., "Shell" -> "Travel", "Starbucks" -> "Meals"). Only use "Uncategorized" if absolutely impossible to guess.
5. Ensure the date is in YYYY-MM-DD format.
6. Ensure the amount is a positive number.
`;

const RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      date: { type: Type.STRING, description: "YYYY-MM-DD" },
      description: { type: Type.STRING },
      amount: { type: Type.NUMBER },
      type: { type: Type.STRING, description: "Must be INCOME or EXPENSE" },
      category: { type: Type.STRING },
    },
    required: ["date", "description", "amount", "type", "category"],
  },
};

/**
 * Helper function to read a File object as a base64 encoded string.
 * This is exported to satisfy the import requirement in App.tsx.
 */
export const readFileAsBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      } else {
        reject(new Error("Failed to read file as base64 string"));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
};

/**
 * Parses financial documents using Gemini AI to extract structured transaction data.
 * Fixes: Declares 'response' correctly, returns a Promise<Transaction[]>, and uses correct property access for response text.
 */
export const parseDocumentWithGemini = async (
  file: File, 
  base64Data: string
): Promise<Transaction[]> => {
  try {
    const mimeType = file.type;
    
    // Construct the parts for multimodal input
    const parts = [
      {
        inlineData: {
          mimeType: mimeType,
          data: base64Data,
        },
      },
      {
        text: "Analyze this document and extract all financial transactions. Return strictly JSON based on the provided schema.",
      },
    ];

    // Call Gemini API to generate structured content
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    // Access the text property directly (it is not a method)
    const jsonStr = response.text;
    if (!jsonStr) {
      throw new Error("Gemini AI returned an empty response text.");
    }

    const rawData = JSON.parse(jsonStr);
    
    // Map the extracted raw data to the application's Transaction interface
    return rawData.map((item: any) => ({
      id: `ai-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      date: item.date,
      description: item.description,
      amount: item.amount,
      type: item.type === "INCOME" ? TransactionType.INCOME : TransactionType.EXPENSE,
      category: item.category,
      originalDescription: item.description,
    }));
  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    throw error;
  }
};
