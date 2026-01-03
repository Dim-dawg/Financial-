// Netlify Function: proxied Gemini API handler
// Expects: POST { action: 'parseDocument'|'autoFill'|'generateNarrative', ... }

// Configuration: Switch to 'gemini-1.5-flash' for stability, or keep 'gemini-2.0-flash-exp' for latest features.
// Note: Gemini 3.0 is not yet public.
const MODEL_NAME = 'gemini-2.0-flash-exp';

export const handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Missing GEMINI_API_KEY on server' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const action = body.action;

  // Support a local dev/mock mode so tests don't require a real Gemini key or @google/genai installed.
  // Only mock if the key explicitly starts with 'test_'. We allow real API calls in local dev (Netlify Dev).
  const isDevMock = (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.startsWith('test_'));
  if (isDevMock) {
    // Return safe mock responses for local testing
    if (action === 'parseDocument') {
      const sample = [{ date: '2025-01-01', description: 'Sample Transaction', amount: 100.0, type: 'expense', category: 'Uncategorized' }];
      return { statusCode: 200, body: JSON.stringify({ data: sample }) };
    }

    if (action === 'autoFill') {
      const sample = { description: `${body.entityName || 'Entity'} - Mocked`, type: 'VENDOR', tags: ['mock'], keywords: [body.entityName || 'Entity'], defaultCategory: 'Uncategorized', sources: [] };
      return { statusCode: 200, body: JSON.stringify({ data: sample }) };
    }

    if (action === 'generateNarrative') {
      const text = `Mocked MD&A: Total Income $${body.summary?.totalIncome || 0}, Net Profit $${body.summary?.netProfit || 0}.`;
      return { statusCode: 200, body: JSON.stringify({ text }) };
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Unknown action (mock mode)' }) };
  }

  try {
    const { GoogleGenAI, Type } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: key });

    if (action === 'parseDocument') {
      const { file, systemInstruction } = body;
      const mimeType = file?.mimeType || 'image/jpeg';
      const base64 = file?.base64;
      if (!base64) return { statusCode: 400, body: JSON.stringify({ error: 'Missing file.base64' }) };

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
          required: ['date','description','amount','type','category']
        }
      };

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: {
          parts: [
            { inlineData: { mimeType, data: base64 } },
            { text: 'Extract all transactions into the specified JSON format.' }
          ]
        },
        config: {
          systemInstruction: systemInstruction || '',
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        }
      });

      return { statusCode: 200, body: JSON.stringify({ data: JSON.parse(response.text || '[]') }) };
    }

    if (action === 'autoFill') {
      const { entityName, categories } = body;
      if (!entityName) return { statusCode: 400, body: JSON.stringify({ error: 'Missing entityName' }) };

      const searchResponse = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Search for information about "${entityName}". Provide short factual context and sources.`,
        config: { tools: [{ googleSearch: {} }] }
      });

      const searchContext = searchResponse.text || '';

      const formatResponse = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Based on this research: "${searchContext}", create a JSON profile for "${entityName}". Select the best defaultCategory from this list ONLY: [${categories}]`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              description: { type: Type.STRING },
              type: { type: Type.STRING },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } },
              keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
              defaultCategory: { type: Type.STRING },
              sources: { type: Type.ARRAY, items: { type: Type.OBJECT } }
            },
            required: ['description','type','tags','keywords','defaultCategory']
          }
        }
      });

      const data = JSON.parse(formatResponse.text || '{}');
      return { statusCode: 200, body: JSON.stringify({ data }) };
    }

    if (action === 'generateNarrative') {
      const { summary } = body;
      if (!summary) return { statusCode: 400, body: JSON.stringify({ error: 'Missing summary' }) };

      const prompt = `As a financial analyst, write a Management Discussion and Analysis (MD&A) for a business with the following summary:\nTotal Income: $${summary.totalIncome.toFixed(2)}\nTotal Expenses: $${summary.totalExpense.toFixed(2)}\nNet Operating Profit: $${summary.netProfit.toFixed(2)}\nTop Operating Expenses: ${summary.topExpenses.join(', ')}\n\nThe tone should be professional, insightful, and suitable for a bank loan officer review.`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: { systemInstruction: 'You are a senior commercial credit analyst. Provide 3-4 professional paragraphs.' }
      });

      return { statusCode: 200, body: JSON.stringify({ text: response.text || '' }) };
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Unknown action' }) };
  } catch (err) {
    console.error('Gemini function error', err);
    return { statusCode: 500, body: JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }) };
  }
};
