import type { ShiftWithWorker, SaleWithDetails, Profile } from './index';

export interface ShiftItemSoldSummary {
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface GeneratedSingleShiftReport {
  shift: ShiftWithWorker;
  worker: Profile | null;
  workerName: string;
  workerRole: string;
  isActive: boolean;
  startDate: Date;
  endDate: Date | null;
  durationLabel: string;
  dateLabel: string;
  timeLabel: string;
  
  // Financials
  openingCash: number;
  cashSales: number;
  posSales: number;
  transferSales: number;
  totalSales: number;
  expectedCash: number;
  actualEndingCash: number | null;
  discrepancy: number | null;
  reconciliationStatus: 'BALANCED' | 'SHORTAGE' | 'EXCESS' | 'PENDING';
  
  // Data sanity
  paymentMismatch: boolean;
  
  // Transactions & items
  transactions: SaleWithDetails[];
  totalTransactions: number;
  itemsSold: ShiftItemSoldSummary[];
  totalItemsCount: number;
  
  // Meta
  generatedAt: Date;
}
