# Cipher Finance | AI-Driven Loan Readiness Dashboard

Cipher Finance is a high-performance financial intelligence platform designed to transform raw bank statements and financial documents into lender-ready reports. Using Gemini 2.0 Flash for document extraction and Supabase for cloud-scale data persistence, it helps business owners prepare for high-stakes bank loan interviews.

## 🚀 Key Features

- **AI Document Extraction**: Upload PDF or image-based bank statements. Gemini automatically identifies dates, descriptions, amounts, and logical categories.
- **Lender-Ready Reports**: Generate professional Profit & Loss statements and Balance Sheets with "Print-First" CSS optimization.
- **AI Loan Narrative**: Generate an AI-powered Management Discussion and Analysis (MD&A) memo that summarizes business viability and debt-service capability.
- **Cloud Synchronization**: Full integration with Supabase. Supports unlimited record fetching (bypassing default 1000-row limits) through recursive pagination.
- **Automation Rules**: Define keyword-based rules to automatically categorize repeat vendors and income sources.
- **Entity Profiles**: Track long-term relationships and spending trends with specific vendors or clients.

## 🛠️ Technical Stack

- **Frontend**: React 19, Tailwind CSS, Lucide React.
- **AI Engine**: `@google/genai` (Gemini 2.0 Flash Experimental).
- **Backend/DB**: `@supabase/supabase-js`.
- **Visualization**: `recharts` for financial health trends and expense breakdowns.

## 💻 Getting Started

### Prerequisites
- Node.js (v18+)
- Netlify CLI (`npm install -g netlify-cli`)

### Installation
1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Setup Environment**:
   Create a `.env` file in the root directory:
   ```env
   GEMINI_API_KEY=your_google_gemini_key_here
   ```
3. **Run Locally**:
   Use Netlify Dev to run both the frontend and the backend functions simultaneously:
   ```bash
   netlify dev
   ```
   - The app will open at `http://localhost:8888`.
   - API calls will be proxied correctly to the local function runner.

## ⚙️ Configuration

### 1. Gemini API Key
The application requires a Google Gemini API key to process documents. **Important:** keep this key in server-side environment variables (e.g., Netlify/Vercel environment settings), not in client-side code or committed files. The repo includes a Netlify function to proxy Gemini calls securely (see `netlify/functions/gemini.js`).
- Set `GEMINI_API_KEY` in your hosting provider's secret store (Netlify Site > Site settings > Build & deploy > Environment > Environment variables).
- The client calls the serverless endpoint which proxies requests to Gemini (`/.netlify/functions/gemini`).
- If your key may have been exposed, rotate it immediately and remove any commits/builds that contained the key.

### 2. Supabase Setup
To enable persistent storage, click **"Link Supabase"** in the header and provide:
- **Project URL**: Found in your Supabase Project Settings > API.
- **Anon Public Key**: Found in your Supabase Project Settings > API.

### 3. Database Schema
Ensure your Supabase project has the following tables:
- `transactions`: (id, date, description, amount, type, category, original_description, document_id)
- `rules`: (id, keyword, target_category)
- `profiles`: (id, name, type, notes)
- `categories`: (id, name)

## 🖨️ Printing Instructions
For the best results when presenting to a bank:
1. Navigate to the **Loan Pack** tab.
2. Click **AI Loan Memo** to generate your narrative.
3. Use the **Print Full Package** button. The interface is specifically designed to hide digital UI elements and format financial statements for 8.5x11 paper.

---
*Built for precision. Designed for capital.*