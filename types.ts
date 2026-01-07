
export enum TransactionType {
  INCOME = 'income',
  EXPENSE = 'expense',
}

export enum AccountType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  CURRENT_ASSET = 'CURRENT_ASSET',
  FIXED_ASSET = 'FIXED_ASSET',
  CURRENT_LIABILITY = 'CURRENT_LIABILITY',
  LONG_TERM_LIAB = 'LONG_TERM_LIAB',
  EQUITY = 'EQUITY',
  // Deprecated generic types for backward compatibility logic
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
}

export interface Category {
  id: string;
  name: string;
  accountType?: AccountType;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  categoryId?: string;
  originalDescription: string;
  documentId?: string;
  entityId?: string; 
  entityName?: string;
}

export interface EntityProfile {
  id: string;
  name: string;
  type: 'VENDOR' | 'CLIENT';
  description: string;
  tags: string[];
  keywords: string[];
  defaultCategoryId?: string;
  defaultCategory?: string;
  sources?: { title: string; uri: string }[];
}

export interface CategorizationRule {
  id: string;
  keyword: string;
  targetCategory: string;
  targetCategoryId?: string;
  targetType?: TransactionType;
}

export interface ProcessingStatus {
  id: string;
  fileName: string;
  fileType: string;
  data: string;
  status: 'pending' | 'processing' | 'completed' | 'error' | 'cancelled';
  message?: string;
  transactionCount?: number;
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

export interface SheetUser {
  id: string;
  email: string;
  name: string;
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
  'Equipment Purchase',
  'Vehicle Loan Payment',
  'Business Loan',
  'Computer Hardware',
];
