import type {
  ShiftWithWorker,
  SaleWithDetails,
  GeneratedSingleShiftReport,
  ShiftItemSoldSummary,
} from '../types';
import { formatDate, formatTime } from './formatters';

interface GenerateSingleShiftReportOptions {
  shift: ShiftWithWorker;
  sales: SaleWithDetails[];
}

export function generateSingleShiftReport({
  shift,
  sales,
}: GenerateSingleShiftReportOptions): GeneratedSingleShiftReport {
  // CRITICAL REQUIREMENT: Strict filtering by shifts.id = sales.shift_id
  const shiftSales = sales.filter(
    (s) => s.shift_id === shift.id && s.status === 'completed'
  );

  const isActive = shift.status === 'active';
  const startDate = new Date(shift.started_at);
  const endDate = shift.ended_at ? new Date(shift.ended_at) : null;

  const dateLabel = formatDate(shift.started_at);
  const timeLabel = `${formatTime(shift.started_at)} → ${
    shift.ended_at ? formatTime(shift.ended_at) : 'Present (Active)'
  }`;

  let durationLabel = 'Active Shift';
  if (endDate) {
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffMins = Math.max(1, Math.round(diffMs / (1000 * 60)));
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    durationLabel = hours > 0 ? `${hours}h ${mins}m` : `${mins} mins`;
  }

  // Financial aggregates
  let cashSales = 0;
  let posSales = 0;
  let transferSales = 0;
  let totalSales = 0;

  // Item aggregation
  const itemMap: { [productName: string]: { quantity: number; total: number; unitPrices: number[] } } = {};
  let totalItemsCount = 0;

  shiftSales.forEach((sale) => {
    const saleTotal = Number(sale.total) || 0;
    totalSales += saleTotal;

    const pm = (sale.payment_method || '').toLowerCase();
    if (pm === 'cash') {
      cashSales += saleTotal;
    } else if (pm === 'pos') {
      posSales += saleTotal;
    } else if (pm === 'transfer') {
      transferSales += saleTotal;
    }

    // Process sale items
    if (sale.items && Array.isArray(sale.items)) {
      sale.items.forEach((item) => {
        const pName = item.product_name || 'Bar Item';
        const qty = Number(item.quantity) || 1;
        const lineTotal = Number(item.total) || (Number(item.unit_price) || 0) * qty;
        const uPrice = Number(item.unit_price) || (qty > 0 ? lineTotal / qty : 0);

        totalItemsCount += qty;

        if (!itemMap[pName]) {
          itemMap[pName] = { quantity: 0, total: 0, unitPrices: [] };
        }
        itemMap[pName].quantity += qty;
        itemMap[pName].total += lineTotal;
        itemMap[pName].unitPrices.push(uPrice);
      });
    }
  });

  const itemsSold: ShiftItemSoldSummary[] = Object.entries(itemMap).map(([productName, data]) => {
    const avgPrice = data.quantity > 0 ? data.total / data.quantity : data.unitPrices[0] || 0;
    return {
      productName,
      quantity: data.quantity,
      unitPrice: avgPrice,
      total: data.total,
    };
  });

  // Sort items by revenue desc
  itemsSold.sort((a, b) => b.total - a.total);

  // Check data consistency
  const paymentSum = cashSales + posSales + transferSales;
  const paymentMismatch = Math.abs(totalSales - paymentSum) > 0.05;

  // Reconciliation
  const openingCash = Number(shift.opening_cash) || 0;
  const expectedCash =
    shift.expected_cash !== null && shift.expected_cash !== undefined
      ? Number(shift.expected_cash)
      : openingCash + cashSales;

  const actualEndingCash =
    !isActive && shift.ending_cash !== null && shift.ending_cash !== undefined
      ? Number(shift.ending_cash)
      : null;

  let discrepancy: number | null = null;
  let reconciliationStatus: 'BALANCED' | 'SHORTAGE' | 'EXCESS' | 'PENDING' = 'PENDING';

  if (!isActive) {
    if (shift.cash_difference !== null && shift.cash_difference !== undefined) {
      discrepancy = Number(shift.cash_difference);
    } else if (actualEndingCash !== null) {
      discrepancy = actualEndingCash - expectedCash;
    } else {
      discrepancy = 0;
    }

    if (Math.abs(discrepancy) < 0.01) {
      reconciliationStatus = 'BALANCED';
    } else if (discrepancy < 0) {
      reconciliationStatus = 'SHORTAGE';
    } else {
      reconciliationStatus = 'EXCESS';
    }
  }

  const worker = shift.worker || null;
  const workerName = worker?.full_name || 'Attendant';
  const workerRole = (worker?.role || 'Staff').toUpperCase();

  return {
    shift,
    worker,
    workerName,
    workerRole,
    isActive,
    startDate,
    endDate,
    durationLabel,
    dateLabel,
    timeLabel,

    openingCash,
    cashSales,
    posSales,
    transferSales,
    totalSales,
    expectedCash,
    actualEndingCash,
    discrepancy,
    reconciliationStatus,

    paymentMismatch,

    transactions: shiftSales,
    totalTransactions: shiftSales.length,
    itemsSold,
    totalItemsCount,

    generatedAt: new Date(),
  };
}
