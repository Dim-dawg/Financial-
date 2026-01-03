// Simple local tests to invoke the Netlify function handler directly without Netlify CLI.
process.env.GEMINI_API_KEY = 'test_local';

const fn = require('../netlify/functions/gemini.js');

async function runTest(action, body) {
  const event = { httpMethod: 'POST', body: JSON.stringify({ action, ...body }) };
  const res = await fn.handler(event, {});
  console.log('---');
  console.log('Action:', action);
  console.log('Result:', res);
}

(async () => {
  await runTest('parseDocument', { file: { mimeType: 'image/jpeg', base64: '...' } });
  await runTest('autoFill', { entityName: 'Coffee Shop' });
  await runTest('generateNarrative', { summary: { totalIncome: 1000, totalExpense: 200, netProfit: 800, topExpenses: ['Rent', 'Payroll'] } });
})();
