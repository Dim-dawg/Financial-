# Cipher Finance | AI-Driven Loan Readiness Dashboard

Cipher Finance is a high-performance financial intelligence platform designed to transform raw bank statements and financial documents into lender-ready reports. Using Gemini 3 Flash for document extraction and Supabase for cloud-scale data persistence, it helps business owners prepare for high-stakes bank loan interviews.

## 🚀 Key Features

- **AI Document Extraction**: Upload PDF or image-based bank statements. Gemini automatically identifies dates, descriptions, amounts, and logical categories.
- **Lender-Ready Reports**: Generate professional Profit & Loss statements and Balance Sheets with "Print-First" CSS optimization.
- **AI Loan Narrative**: Generate an AI-powered Management Discussion and Analysis (MD&A) memo that summarizes business viability and debt-service capability.
- **Cloud Synchronization**: Full integration with Supabase. Supports unlimited record fetching (bypassing default 1000-row limits) through recursive pagination.
- **Automation Rules**: Define keyword-based rules to automatically categorize repeat vendors and income sources.
- **Entity Profiles**: Track long-term relationships and spending trends with specific vendors or clients.

## 🛠️ Technical Stack

- **Frontend**: React 19, Tailwind CSS, Lucide React.
- **AI Engine**: `@google/genai` (Gemini 3 Pro/Flash).
- **Backend/DB**: `@supabase/supabase-js`.
- **Visualization**: `recharts` for financial health trends and expense breakdowns.

## ⚙️ Configuration

### 1. Gemini API Key
The application requires a Google Gemini API key to process documents.
- Click the **Key** icon in the header to open the AI Studio key selection dialog.
- The app uses `gemini-3-flash-preview` for high-speed extraction and `gemini-3-pro-preview` for complex financial reasoning.

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