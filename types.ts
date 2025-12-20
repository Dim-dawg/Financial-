
export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  originalDescription: string;
  documentId?: string; // Links transaction to source document
  entityId?: string; 
}

export interface EntityProfile {
  id: string;
  name: string;
  type: 'VENDOR' | 'CLIENT';
  description: string;
  tags: string[];
  keywordMatch: string;
}

export interface CategorizationRule {
  id: string;
  keyword: string;
  targetCategory: string;
  targetType?: TransactionType;
}

export interface ProcessingStatus {
  id: string;
  fileName: string;
  fileType: string;
  data: string; // Base64 data for review/preview
  status: 'pending' | 'processing' | 'completed' | 'error' | 'cancelled';
  message?: string;
  transactionCount?: number;
}

export interface SheetUser {
  user_id: string;
  email: string;
  name: string;
}

export interface TransactionFilter {
  startDate: string;
  endDate: string;
  category: string;
  minAmount: string;
  maxAmount: string;
  search: string;
}

export interface BalanceSheetAdjustment {
  id: string;
  name: string;
  amount: number;
  type: 'ASSET' | 'LIABILITY';
}

export enum FileType {
  PDF = 'application/pdf',
  CSV = 'text/csv',
  PNG = 'image/png',
  JPEG = 'image/jpeg',
}

export const DEFAULT_CATEGORIES = [
  'Sales Revenue',
  'Services Income',
  'Rent',
  'Utilities',
  'Payroll',
  'Office Supplies',
  'Travel',
  'Professional Fees',
  'Bank Fees',
  'Inventory',
  'Marketing',
  'Insurance',
  'Repairs & Maintenance',
  'Uncategorized',
];
