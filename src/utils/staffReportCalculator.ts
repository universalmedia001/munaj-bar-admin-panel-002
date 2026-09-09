import type {
  Profile,
  SaleWithDetails,
  ShiftWithWorker,
  Product,
  StaffReportFilter,
  StaffReportPeriod,
  GeneratedStaffReport,
  WorkerPerformanceSummary,
  TopProductRow,
  DailyPerformanceRow,
  WeeklyPerformanceRow,
  MonthlyPerformanceRow,
  ShiftHistoryRow,
  ShiftReconciliationStatus,
} from '../types';
import { formatDate, formatTime } from './formatters';

/**
 * Calculates start and end Date boundaries with complete 00:00:00.000 to 23:59:59.999 inclusion
 */
export function getPeriodDateRange(
  period: StaffReportPeriod,
  customStart?: string,
  customEnd?: string
): { startDate: Date; endDate: Date; periodLabel: string } {
  const now = new Date();

  let startDate: Date;
  let endDate: Date;
  let periodLabel = '';

  switch (period) {
    case 'today': {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      periodLabel = `Today (${formatDate(startDate.toISOString())})`;
      break;
    }
    case 'yesterday': {
      const yDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      startDate = new Date(yDate.getFullYear(), yDate.getMonth(), yDate.getDate(), 0, 0, 0, 0);
      endDate = new Date(yDate.getFullYear(), yDate.getMonth(), yDate.getDate(), 23, 59, 59, 999);
      periodLabel = `Yesterday (${formatDate(startDate.toISOString())})`;
      break;
    }
    case 'this_week': {
      // Find Monday of current week (day 1; in JS Sunday is 0)
      const day = now.getDay();
      const diffToMonday = (day === 0 ? -6 : 1) - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMonday);
      startDate = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      endDate = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate(), 23, 59, 59, 999);
      periodLabel = `This Week (${formatDate(startDate.toISOString())} — ${formatDate(endDate.toISOString())})`;
      break;
    }
    case 'last_7_days': {
      const past7 = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      startDate = new Date(past7.getFullYear(), past7.getMonth(), past7.getDate(), 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      periodLabel = `Last 7 Days (${formatDate(startDate.toISOString())} — ${formatDate(endDate.toISOString())})`;
      break;
    }
    case 'this_month': {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), lastDayOfMonth.getDate(), 23, 59, 59, 999);
      periodLabel = `This Month (${formatDate(startDate.toISOString())} — ${formatDate(endDate.toISOString())})`;
      break;
    }
    case 'last_30_days': {
      const past30 = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
      startDate = new Date(past30.getFullYear(), past30.getMonth(), past30.getDate(), 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      periodLabel = `Last 30 Days (${formatDate(startDate.toISOString())} — ${formatDate(endDate.toISOString())})`;
      break;
    }
    case 'this_year': {
      startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      periodLabel = `This Year ${now.getFullYear()} (${formatDate(startDate.toISOString())} — ${formatDate(endDate.toISOString())})`;
      break;
    }
    case 'all_time': {
      startDate = new Date(2020, 0, 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear() + 1, 11, 31, 23, 59, 59, 999);
      periodLabel = 'All Time (Complete History)';
      break;
    }
    case 'custom': {
      if (customStart && customEnd) {
        const [sy, sm, sd] = customStart.split('-').map(Number);
        const [ey, em, ed] = customEnd.split('-').map(Number);
        const s = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
        const e = new Date(ey, em - 1, ed, 23, 59, 59, 999);

        if (s.getTime() <= e.getTime()) {
          startDate = s;
          endDate = e;
        } else {
          // Normalize if flipped
          startDate = e;
          endDate = s;
        }
      } else {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      }
      periodLabel = `${formatDate(startDate.toISOString())} — ${formatDate(endDate.toISOString())}`;
      break;
    }
    default: {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      periodLabel = `${formatDate(startDate.toISOString())} — ${formatDate(endDate.toISOString())}`;
    }
  }

  return { startDate, endDate, periodLabel };
}

/**
 * Calculates complete staff performance report from Supabase records
 */
export function generateStaffPerformanceReport({
  filter,
  sales,
  shifts,
  workers,
}: {
  filter: StaffReportFilter;
  sales: SaleWithDetails[];
  shifts: ShiftWithWorker[];
  workers: Profile[];
  products?: Product[];
}): GeneratedStaffReport {
  const { startDate, endDate, periodLabel } = getPeriodDateRange(
    filter.period,
    filter.startDate,
    filter.endDate
  );

  const startMs = startDate.getTime();
  const endMs = endDate.getTime();

  // Find target worker if individual report
  const targetWorker =
    filter.reportType === 'individual'
      ? workers.find((w) => w.id === filter.workerId) || null
      : null;

  // Filter completed sales within date range and worker constraint
  const completedSales = sales.filter((s) => {
    if (s.status !== 'completed') return false;
    const saleTime = new Date(s.created_at).getTime();
    if (saleTime < startMs || saleTime > endMs) return false;

    if (filter.reportType === 'individual') {
      return s.worker_id === filter.workerId;
    }
    return true;
  });

  // Calculate Executive Summary Totals
  const totalRevenue = completedSales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
  const totalGrossRevenue = completedSales.reduce(
    (acc, s) => acc + (Number(s.subtotal) || Number(s.total) || 0),
    0
  );
  const totalDiscounts = completedSales.reduce((acc, s) => acc + (Number(s.discount) || 0), 0);
  const totalTransactions = completedSales.length;

  let totalItemsSold = 0;
  completedSales.forEach((s) => {
    if (s.items && s.items.length > 0) {
      s.items.forEach((item) => {
        totalItemsSold += Number(item.quantity) || 0;
      });
    }
  });

  const averageTicket = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

  // Payment Breakdown
  const cashSales = completedSales
    .filter((s) => s.payment_method === 'cash')
    .reduce((acc, s) => acc + (Number(s.total) || 0), 0);

  const posSales = completedSales
    .filter((s) => s.payment_method === 'pos')
    .reduce((acc, s) => acc + (Number(s.total) || 0), 0);

  const transferSales = completedSales
    .filter((s) => s.payment_method === 'transfer')
    .reduce((acc, s) => acc + (Number(s.total) || 0), 0);

  const paymentBreakdown = {
    cash: cashSales,
    pos: posSales,
    transfer: transferSales,
    total: cashSales + posSales + transferSales,
  };

  // Top Products Sold
  const productSalesMap: { [name: string]: { name: string; quantity: number; revenue: number } } = {};
  completedSales.forEach((s) => {
    s.items?.forEach((it) => {
      const pName = it.product_name || 'Item';
      if (!productSalesMap[pName]) {
        productSalesMap[pName] = { name: pName, quantity: 0, revenue: 0 };
      }
      productSalesMap[pName].quantity += Number(it.quantity) || 0;
      productSalesMap[pName].revenue += Number(it.total) || 0;
    });
  });

  const topProducts: TopProductRow[] = Object.values(productSalesMap)
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
    .map((p, idx) => ({
      rank: idx + 1,
      productName: p.name,
      quantity: p.quantity,
      revenue: p.revenue,
    }));

  // Daily Performance Breakdown
  const dailyMap: {
    [key: string]: { dateKey: string; dateLabel: string; ordersCount: number; itemsSoldCount: number; revenue: number; timestamp: number };
  } = {};

  completedSales.forEach((s) => {
    const d = new Date(s.created_at);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dateLabel = formatDate(s.created_at);

    if (!dailyMap[dateKey]) {
      dailyMap[dateKey] = {
        dateKey,
        dateLabel,
        ordersCount: 0,
        itemsSoldCount: 0,
        revenue: 0,
        timestamp: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(),
      };
    }

    dailyMap[dateKey].ordersCount += 1;
    let itemsInSale = 0;
    s.items?.forEach((it) => {
      itemsInSale += Number(it.quantity) || 0;
    });
    dailyMap[dateKey].itemsSoldCount += itemsInSale;
    dailyMap[dateKey].revenue += Number(s.total) || 0;
  });

  const dailyBreakdown: DailyPerformanceRow[] = Object.values(dailyMap)
    .sort((a, b) => b.timestamp - a.timestamp) // newest first
    .map((d) => ({
      dateKey: d.dateKey,
      dateLabel: d.dateLabel,
      ordersCount: d.ordersCount,
      itemsSoldCount: d.itemsSoldCount,
      revenue: d.revenue,
    }));

  // Weekly Performance Breakdown
  const weeklyMap: { [key: string]: { weekLabel: string; ordersCount: number; revenue: number; sortKey: number } } = {};
  completedSales.forEach((s) => {
    const d = new Date(s.created_at);
    // Find week start (Monday)
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    const wMon = new Date(d);
    wMon.setDate(d.getDate() + diff);
    const wSun = new Date(wMon);
    wSun.setDate(wMon.getDate() + 6);

    const weekLabel = `${wMon.getDate()} ${wMon.toLocaleString('en-GB', { month: 'short' })} — ${wSun.getDate()} ${wSun.toLocaleString('en-GB', { month: 'short' })}`;
    const sortKey = wMon.getTime();

    if (!weeklyMap[weekLabel]) {
      weeklyMap[weekLabel] = { weekLabel, ordersCount: 0, revenue: 0, sortKey };
    }
    weeklyMap[weekLabel].ordersCount += 1;
    weeklyMap[weekLabel].revenue += Number(s.total) || 0;
  });

  const weeklyBreakdown: WeeklyPerformanceRow[] = Object.values(weeklyMap)
    .sort((a, b) => b.sortKey - a.sortKey)
    .map((w) => ({
      weekLabel: w.weekLabel,
      ordersCount: w.ordersCount,
      revenue: w.revenue,
    }));

  // Monthly Performance Breakdown
  const monthlyMap: {
    [key: string]: { monthKey: string; monthLabel: string; ordersCount: number; itemsSoldCount: number; revenue: number; sortKey: number };
  } = {};

  completedSales.forEach((s) => {
    const d = new Date(s.created_at);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = d.toLocaleString('en-GB', { month: 'short', year: 'numeric' }).toUpperCase();
    const sortKey = new Date(d.getFullYear(), d.getMonth(), 1).getTime();

    if (!monthlyMap[monthKey]) {
      monthlyMap[monthKey] = {
        monthKey,
        monthLabel,
        ordersCount: 0,
        itemsSoldCount: 0,
        revenue: 0,
        sortKey,
      };
    }

    monthlyMap[monthKey].ordersCount += 1;
    let itemsInSale = 0;
    s.items?.forEach((it) => {
      itemsInSale += Number(it.quantity) || 0;
    });
    monthlyMap[monthKey].itemsSoldCount += itemsInSale;
    monthlyMap[monthKey].revenue += Number(s.total) || 0;
  });

  const monthlyBreakdown: MonthlyPerformanceRow[] = Object.values(monthlyMap)
    .sort((a, b) => b.sortKey - a.sortKey)
    .map((m) => ({
      monthKey: m.monthKey,
      monthLabel: m.monthLabel,
      ordersCount: m.ordersCount,
      itemsSoldCount: m.itemsSoldCount,
      revenue: m.revenue,
    }));

  // Shift Performance and Reconciliation
  const filteredShifts = shifts.filter((sh) => {
    const shiftTime = new Date(sh.started_at).getTime();
    if (shiftTime < startMs || shiftTime > endMs) return false;

    if (filter.reportType === 'individual') {
      return sh.worker_id === filter.workerId;
    }
    return true;
  });

  let totalOpeningFloats = 0;
  let totalExpectedCash = 0;
  let totalActualCash = 0;
  let totalCashDifference = 0;

  filteredShifts.forEach((sh) => {
    totalOpeningFloats += Number(sh.opening_cash) || 0;
    totalExpectedCash += Number(sh.expected_cash) || 0;
    totalActualCash += Number(sh.ending_cash) || 0;

    let diff = Number(sh.cash_difference);
    if (isNaN(diff) || diff === null) {
      if (sh.ending_cash !== null && sh.expected_cash !== null) {
        diff = Number(sh.ending_cash) - Number(sh.expected_cash);
      } else {
        diff = 0;
      }
    }
    totalCashDifference += diff;
  });

  let overallShiftStatus: ShiftReconciliationStatus = 'BALANCED';
  if (totalCashDifference < -0.01) {
    overallShiftStatus = 'SHORTAGE';
  } else if (totalCashDifference > 0.01) {
    overallShiftStatus = 'EXCESS';
  }

  const shiftReconciliation = {
    totalShifts: filteredShifts.length,
    totalOpeningFloats,
    totalExpectedCash,
    totalActualCash,
    totalDifference: totalCashDifference,
    status: overallShiftStatus,
  };

  // Shift History Rows
  const shiftHistory: ShiftHistoryRow[] = filteredShifts.map((sh) => {
    const workerObj = workers.find((w) => w.id === sh.worker_id) || sh.worker;
    const workerName = workerObj?.full_name || 'Worker';

    let diff = Number(sh.cash_difference);
    if (isNaN(diff) || diff === null) {
      if (sh.ending_cash !== null && sh.expected_cash !== null) {
        diff = Number(sh.ending_cash) - Number(sh.expected_cash);
      } else {
        diff = 0;
      }
    }

    let status: ShiftReconciliationStatus = 'BALANCED';
    if (diff < -0.01) status = 'SHORTAGE';
    else if (diff > 0.01) status = 'EXCESS';

    return {
      id: sh.id,
      dateLabel: `${formatDate(sh.started_at)} ${formatTime(sh.started_at)}`,
      workerName,
      openingCash: Number(sh.opening_cash) || 0,
      expectedCash: Number(sh.expected_cash) || 0,
      actualEndingCash: Number(sh.ending_cash) || 0,
      difference: diff,
      status,
      shiftStatus: sh.status,
      startedAt: sh.started_at,
      endedAt: sh.ended_at,
    };
  });

  // All Workers Performance Breakdown (every worker evaluated in this period)
  const workerBreakdown: WorkerPerformanceSummary[] = workers.map((w) => {
    const workerCompletedSales = sales.filter((s) => {
      if (s.status !== 'completed') return false;
      const t = new Date(s.created_at).getTime();
      return t >= startMs && t <= endMs && s.worker_id === w.id;
    });

    const wRevenue = workerCompletedSales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
    const wGross = workerCompletedSales.reduce(
      (acc, s) => acc + (Number(s.subtotal) || Number(s.total) || 0),
      0
    );
    const wDiscounts = workerCompletedSales.reduce((acc, s) => acc + (Number(s.discount) || 0), 0);
    const wOrders = workerCompletedSales.length;

    let wItems = 0;
    workerCompletedSales.forEach((s) => {
      s.items?.forEach((it) => {
        wItems += Number(it.quantity) || 0;
      });
    });

    const wAvgTicket = wOrders > 0 ? wRevenue / wOrders : 0;

    const wCash = workerCompletedSales
      .filter((s) => s.payment_method === 'cash')
      .reduce((acc, s) => acc + (Number(s.total) || 0), 0);

    const wPos = workerCompletedSales
      .filter((s) => s.payment_method === 'pos')
      .reduce((acc, s) => acc + (Number(s.total) || 0), 0);

    const wTransfer = workerCompletedSales
      .filter((s) => s.payment_method === 'transfer')
      .reduce((acc, s) => acc + (Number(s.total) || 0), 0);

    // Worker shifts in period
    const wShifts = shifts.filter((sh) => {
      const t = new Date(sh.started_at).getTime();
      return t >= startMs && t <= endMs && sh.worker_id === w.id;
    });

    let wOpeningFloats = 0;
    let wExpectedCash = 0;
    let wActualEndingCash = 0;
    let wCashDifference = 0;

    wShifts.forEach((sh) => {
      wOpeningFloats += Number(sh.opening_cash) || 0;
      wExpectedCash += Number(sh.expected_cash) || 0;
      wActualEndingCash += Number(sh.ending_cash) || 0;
      let diff = Number(sh.cash_difference);
      if (isNaN(diff) || diff === null) {
        if (sh.ending_cash !== null && sh.expected_cash !== null) {
          diff = Number(sh.ending_cash) - Number(sh.expected_cash);
        } else {
          diff = 0;
        }
      }
      wCashDifference += diff;
    });

    let wStatus: ShiftReconciliationStatus = 'BALANCED';
    if (wCashDifference < -0.01) wStatus = 'SHORTAGE';
    else if (wCashDifference > 0.01) wStatus = 'EXCESS';

    const percentageOfTotalRevenue = totalRevenue > 0 ? (wRevenue / totalRevenue) * 100 : 0;

    return {
      worker: w,
      rank: 1,
      ordersCount: wOrders,
      itemsSoldCount: wItems,
      grossRevenue: wGross,
      discounts: wDiscounts,
      netRevenue: wRevenue,
      averageTicket: wAvgTicket,
      cashSales: wCash,
      posSales: wPos,
      transferSales: wTransfer,
      shiftsCount: wShifts.length,
      openingFloats: wOpeningFloats,
      expectedCash: wExpectedCash,
      actualEndingCash: wActualEndingCash,
      cashDifference: wCashDifference,
      reconciliationStatus: wStatus,
      percentageOfTotalRevenue,
    };
  });

  // Sort workers by revenue descending and assign rank
  workerBreakdown.sort((a, b) => b.netRevenue - a.netRevenue || b.ordersCount - a.ordersCount);
  workerBreakdown.forEach((w, idx) => {
    w.rank = idx + 1;
  });

  return {
    reportType: filter.reportType,
    targetWorker,
    period: filter.period,
    periodLabel,
    startDate,
    endDate,
    generatedAt: new Date(),
    totalStaffCount: workers.length,
    totalRevenue,
    totalGrossRevenue,
    totalDiscounts,
    totalTransactions,
    totalItemsSold,
    averageTicket,
    paymentBreakdown,
    shiftReconciliation,
    topProducts,
    dailyBreakdown,
    weeklyBreakdown,
    monthlyBreakdown,
    workerBreakdown,
    shiftHistory,
    transactions: completedSales.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ),
  };
}
