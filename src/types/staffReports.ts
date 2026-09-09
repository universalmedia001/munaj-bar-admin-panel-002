import type { Profile, SaleWithDetails } from './index';

export type StaffReportType = 'individual' | 'all_workers';

export type StaffReportPeriod =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_7_days'
  | 'this_month'
  | 'last_30_days'
  | 'this_year'
  | 'all_time'
  | 'custom';

export interface StaffReportFilter {
  reportType: StaffReportType;
  workerId: string; // for individual worker
  period: StaffReportPeriod;
  startDate: string; // YYYY-MM-DD for custom
  endDate: string; // YYYY-MM-DD for custom
}

export type ShiftReconciliationStatus = 'BALANCED' | 'SHORTAGE' | 'EXCESS';

export interface WorkerPerformanceSummary {
  worker: Profile;
  rank: number;
  ordersCount: number;
  itemsSoldCount: number;
  grossRevenue: number;
  discounts: number;
  netRevenue: number;
  averageTicket: number;
  cashSales: number;
  posSales: number;
  transferSales: number;
  shiftsCount: number;
  openingFloats: number;
  expectedCash: number;
  actualEndingCash: number;
  cashDifference: number;
  reconciliationStatus: ShiftReconciliationStatus;
  percentageOfTotalRevenue: number;
}

export interface TopProductRow {
  rank: number;
  productName: string;
  quantity: number;
  revenue: number;
}

export interface DailyPerformanceRow {
  dateKey: string;
  dateLabel: string;
  ordersCount: number;
  itemsSoldCount: number;
  revenue: number;
}

export interface WeeklyPerformanceRow {
  weekLabel: string;
  ordersCount: number;
  revenue: number;
}

export interface MonthlyPerformanceRow {
  monthKey: string;
  monthLabel: string;
  ordersCount: number;
  itemsSoldCount: number;
  revenue: number;
}

export interface ShiftHistoryRow {
  id: string;
  dateLabel: string;
  workerName: string;
  openingCash: number;
  expectedCash: number;
  actualEndingCash: number;
  difference: number;
  status: ShiftReconciliationStatus;
  shiftStatus: string;
  startedAt: string;
  endedAt: string | null;
}

export type SubmittedReportStatus = 'SUBMITTED' | 'VIEWED' | 'VERIFIED' | 'DISCREPANCY';

export interface StaffSubmittedReport {
  id: string;
  worker_id: string;
  worker_name: string;
  worker_role?: string;
  period: StaffReportPeriod;
  period_label: string;
  start_date: string;
  end_date: string;
  sales_total: number;
  transactions_count: number;
  items_count: number;
  cash_sales: number;
  pos_sales: number;
  transfer_sales: number;
  average_sale: number;
  status: SubmittedReportStatus;
  created_at: string;
  submitted_at: string;
  viewed_at?: string | null;
  verified_at?: string | null;
  shift_id?: string | null;
  notes?: string;
  raw_metadata?: Record<string, any>;
}

export interface ReportVerificationResult {
  isVerified: boolean;
  hasDiscrepancy: boolean;
  status: 'VERIFIED' | 'REQUIRES_REVIEW';
  dbSalesTotal: number;
  submittedSalesTotal: number;
  salesDifference: number;
  dbTransactionsCount: number;
  submittedTransactionsCount: number;
  transactionsDifference: number;
  dbItemsCount: number;
  submittedItemsCount: number;
  itemsDifference: number;
  dbCashSales: number;
  submittedCashSales: number;
  cashDifference: number;
  dbPosSales: number;
  submittedPosSales: number;
  posDifference: number;
  dbTransferSales: number;
  submittedTransferSales: number;
  transferDifference: number;
  message: string;
}

export interface GeneratedStaffReport {
  reportType: StaffReportType;
  targetWorker: Profile | null;
  period: StaffReportPeriod;
  periodLabel: string;
  startDate: Date;
  endDate: Date;
  generatedAt: Date;
  
  // Executive Summary Totals
  totalStaffCount: number;
  totalRevenue: number;
  totalGrossRevenue: number;
  totalDiscounts: number;
  totalTransactions: number;
  totalItemsSold: number;
  averageTicket: number;

  // Payment Breakdown
  paymentBreakdown: {
    cash: number;
    pos: number;
    transfer: number;
    total: number;
  };

  // Shift Performance & Reconciliation
  shiftReconciliation: {
    totalShifts: number;
    totalOpeningFloats: number;
    totalExpectedCash: number;
    totalActualCash: number;
    totalDifference: number;
    status: ShiftReconciliationStatus;
  };

  // Detailed lists & tables
  topProducts: TopProductRow[];
  dailyBreakdown: DailyPerformanceRow[];
  weeklyBreakdown: WeeklyPerformanceRow[];
  monthlyBreakdown: MonthlyPerformanceRow[];
  workerBreakdown: WorkerPerformanceSummary[];
  shiftHistory: ShiftHistoryRow[];
  transactions: SaleWithDetails[];
}
