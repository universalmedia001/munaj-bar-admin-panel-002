import type { Database, UserRole, PaymentMethod, ShiftStatus, SaleStatus, StockMovementType, NotificationType } from './database';

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Category = Database['public']['Tables']['categories']['Row'];
export type Product = Database['public']['Tables']['products']['Row'];
export type StockMovement = Database['public']['Tables']['stock_movements']['Row'];
export type Shift = Database['public']['Tables']['shifts']['Row'];
export type Sale = Database['public']['Tables']['sales']['Row'];
export type SaleItem = Database['public']['Tables']['sale_items']['Row'];
export type ReceiptPrint = Database['public']['Tables']['receipt_prints']['Row'];
export type AppNotification = Database['public']['Tables']['notifications']['Row'];
export type ActivityLog = Database['public']['Tables']['activity_logs']['Row'];
export type BusinessSettings = Database['public']['Tables']['business_settings']['Row'];

export { UserRole, PaymentMethod, ShiftStatus, SaleStatus, StockMovementType, NotificationType };

export interface ProductWithCategory extends Product {
  category?: Category | null;
}

export interface SaleWithDetails extends Sale {
  worker?: Profile | null;
  shift?: Shift | null;
  items?: SaleItem[];
  receipt_prints?: ReceiptPrint[];
}

export interface ShiftWithWorker extends Shift {
  worker?: Profile | null;
  sales_count?: number;
  total_sales_amount?: number;
  cash_sales_amount?: number;
  pos_sales_amount?: number;
  transfer_sales_amount?: number;
}

export interface StockMovementWithDetails extends StockMovement {
  product?: Product | null;
  creator?: Profile | null;
}

export interface WorkerSummary extends Profile {
  active_shift?: Shift | null;
  today_sales_count?: number;
  today_sales_total?: number;
  last_activity_time?: string | null;
}

export interface DashboardMetrics {
  todayRevenue: number;
  todayTransactionsCount: number;
  todayCashSales: number;
  todayPosSales: number;
  todayTransferSales: number;
  activeShiftsCount: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export interface SalesFilter {
  timeRange: 'today' | 'yesterday' | 'week' | 'month' | 'custom';
  startDate?: string;
  endDate?: string;
  workerId?: string;
  paymentMethod?: PaymentMethod | 'all';
  status?: SaleStatus | 'all';
  searchQuery?: string;
}

export interface StockAdjustmentInput {
  productId: string;
  quantity: number;
  type: 'restock' | 'adjustment' | 'damage' | 'correction';
  reason: string;
}

export interface WorkerBranding {
  site_name: string;
  primary_color: string;
  updated_at?: string;
}

export const DEFAULT_WORKER_SITE_NAME = 'MUNAJ BAR';
export const DEFAULT_WORKER_PRIMARY_COLOR = '#B7FF00';
export const DEFAULT_OPENING_CASH_FLOAT = 50000;

/**
 * Determines whether a worker profile has been permanently deleted.
 */
export function isWorkerDeleted(
  profile?: { full_name?: string | null; email?: string | null; status?: string | null; is_active?: boolean | null } | null
): boolean {
  if (!profile) return false;
  if (profile.full_name?.startsWith('[DELETED]') || profile.full_name?.startsWith('[Deleted Staff]')) return true;
  if (profile.email?.includes('@munajbar.local') || profile.email?.startsWith('deleted_')) return true;
  if ((profile as any).status === 'deleted' || (profile as any).is_deleted === true) return true;
  return false;
}

/**
 * Determines whether a shift record has been archived or soft-deleted.
 */
export function isShiftArchived(
  shift?: {
    status?: string | null;
    notes?: string | null;
    is_archived?: boolean | null;
    deleted_at?: string | null;
  } | null
): boolean {
  if (!shift) return false;
  if (shift.status === 'archived') return true;
  if ((shift as any).is_archived === true) return true;
  if ((shift as any).deleted_at) return true;
  if (shift.notes && (shift.notes.includes('[ARCHIVED]') || shift.notes.includes('[DELETED]'))) return true;
  return false;
}

/**
 * Formats a worker's display name for tables and receipts, indicating if they are deleted.
 */
export function formatWorkerDisplayName(
  profile?: { full_name?: string | null } | null
): string {
  if (!profile || !profile.full_name) return 'Staff';
  const name = profile.full_name;
  if (name.startsWith('[DELETED]') || name.startsWith('[Deleted Staff]')) {
    const clean = name.replace(/^\[DELETED\]\s*/i, '').replace(/^\[Deleted Staff\]\s*/i, '').trim();
    return `${clean} (Deleted Staff)`;
  }
  return name;
}

export * from './staffReports';
export * from './shiftReport';
